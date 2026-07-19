import { NextRequest, NextResponse } from 'next/server';
import { apiFootballGet } from '@/app/api/utils/apiFootball';
import { getMatchStatistics } from '@/lib/statistics/matchStatisticsEngine';
import { persistHistoricalMatch } from '@/lib/persistence/historicalFootballRepository';
import { PersistentDatabaseNotConfiguredError } from '@/lib/persistence/database';

type FixtureResponse = Array<{
  fixture?: {
    id?: number;
    date?: string;
    referee?: string | null;
    status?: { short?: string; long?: string };
    venue?: { name?: string | null };
  };
  league?: { id?: number; name?: string; season?: number; round?: string; country?: string };
  teams?: {
    home?: { id?: number; name?: string; logo?: string };
    away?: { id?: number; name?: string; logo?: string };
  };
  goals?: { home?: number | null; away?: number | null };
}>;

const FINISHED = new Set(['FT', 'AET', 'PEN']);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const fixtureId = String(body?.fixtureId ?? '').trim();
    const force = Boolean(body?.force);

    if (!/^\d+$/.test(fixtureId)) {
      return NextResponse.json({ error: 'fixtureId inválido' }, { status: 400 });
    }

    const fixturePayload = await apiFootballGet<FixtureResponse>('/fixtures', {
      params: { id: fixtureId },
      revalidate: 0,
    });
    const item = fixturePayload?.response?.[0];
    if (!item?.fixture?.id || !item.teams?.home?.name || !item.teams?.away?.name) {
      return NextResponse.json({ error: 'Partida não encontrada na API-Football' }, { status: 404 });
    }

    const status = item.fixture.status?.short ?? 'unknown';
    if (!force && !FINISHED.has(status)) {
      return NextResponse.json(
        { error: 'Somente partidas encerradas são importadas automaticamente', fixtureId, status },
        { status: 409 },
      );
    }

    const statistics = await getMatchStatistics(fixtureId);
    const result = await persistHistoricalMatch({
      fixtureId,
      competitionKey: item.league?.id ? `api-football:${item.league.id}` : null,
      competitionName: item.league?.name ?? null,
      season: item.league?.season ? String(item.league.season) : null,
      roundName: item.league?.round ?? null,
      status,
      kickoffAt: item.fixture.date ?? null,
      venue: item.fixture.venue?.name ?? null,
      referee: item.fixture.referee ?? null,
      home: {
        id: item.teams.home.id ? String(item.teams.home.id) : '',
        name: item.teams.home.name,
        logo: item.teams.home.logo ?? null,
        country: item.league?.country ?? null,
        score: item.goals?.home ?? null,
      },
      away: {
        id: item.teams.away.id ? String(item.teams.away.id) : '',
        name: item.teams.away.name,
        logo: item.teams.away.logo ?? null,
        country: item.league?.country ?? null,
        score: item.goals?.away ?? null,
      },
      sourcePayload: item,
    }, statistics);

    return NextResponse.json({ ok: true, source: statistics.source, coverage: statistics.coverage, ...result });
  } catch (error) {
    console.error('[history/import-fixture] error:', error);
    if (error instanceof PersistentDatabaseNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao importar partida' }, { status: 500 });
  }
}
