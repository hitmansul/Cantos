import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { apiFootballGet } from '@/app/api/utils/apiFootball';
import { getMatchStatistics } from '@/lib/statistics/matchStatisticsEngine';
import { persistHistoricalMatch } from '@/lib/persistence/historicalFootballRepository';
import { PersistentDatabaseNotConfiguredError } from '@/lib/persistence/database';

type FixtureItem = {
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
};

type FixtureResponse = FixtureItem[];

const FINISHED = new Set(['FT', 'AET', 'PEN']);

function isAuthorized(request: NextRequest) {
  const secret = process.env.HISTORY_IMPORT_SECRET;
  if (!secret) return true;
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const header = request.headers.get('x-import-secret');
  return bearer === secret || header === secret;
}

function positiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const leagueId = String(body?.leagueId ?? '').trim();
    const season = String(body?.season ?? '').trim();
    const limit = positiveInteger(body?.limit, 10, 30);
    const refreshExisting = Boolean(body?.refreshExisting);

    if (!/^\d+$/.test(leagueId)) {
      return NextResponse.json({ error: 'leagueId inválido' }, { status: 400 });
    }
    if (!/^\d{4}$/.test(season)) {
      return NextResponse.json({ error: 'season inválida. Use o ano com quatro dígitos.' }, { status: 400 });
    }

    const fixturePayload = await apiFootballGet<FixtureResponse>('/fixtures', {
      params: { league: leagueId, season },
      revalidate: 0,
    });

    const finished = (fixturePayload?.response ?? [])
      .filter((item) => item.fixture?.id && FINISHED.has(item.fixture.status?.short ?? ''))
      .sort((a, b) => String(a.fixture?.date ?? '').localeCompare(String(b.fixture?.date ?? '')));

    const existingRows = await sql`
      SELECT fixture_id
      FROM football_matches
      WHERE competition_key = ${`api-football:${leagueId}`}
        AND season = ${season}
    `;
    const existing = new Set(existingRows.map((row) => String(row.fixture_id)));

    const pending = finished
      .filter((item) => refreshExisting || !existing.has(String(item.fixture?.id)))
      .slice(0, limit);

    const imported: Array<Record<string, unknown>> = [];
    const failed: Array<{ fixtureId: string; error: string }> = [];

    for (const item of pending) {
      const fixtureId = String(item.fixture?.id ?? '');
      try {
        if (!fixtureId || !item.teams?.home?.name || !item.teams?.away?.name) {
          throw new Error('Dados básicos da partida estão incompletos');
        }

        const statistics = await getMatchStatistics(fixtureId);
        const result = await persistHistoricalMatch({
          fixtureId,
          competitionKey: item.league?.id ? `api-football:${item.league.id}` : `api-football:${leagueId}`,
          competitionName: item.league?.name ?? null,
          season: item.league?.season ? String(item.league.season) : season,
          roundName: item.league?.round ?? null,
          status: item.fixture?.status?.short ?? 'FT',
          kickoffAt: item.fixture?.date ?? null,
          venue: item.fixture?.venue?.name ?? null,
          referee: item.fixture?.referee ?? null,
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

        imported.push({ ...result, source: statistics.source, coverage: statistics.coverage });
      } catch (error) {
        failed.push({
          fixtureId,
          error: error instanceof Error ? error.message : 'Falha desconhecida',
        });
      }
    }

    return NextResponse.json({
      ok: failed.length === 0,
      leagueId,
      season,
      totals: {
        returnedByApi: fixturePayload?.response?.length ?? 0,
        finished: finished.length,
        alreadyStored: existing.size,
        pendingBeforeLimit: finished.filter((item) => refreshExisting || !existing.has(String(item.fixture?.id))).length,
        selected: pending.length,
        imported: imported.length,
        failed: failed.length,
      },
      hasMore: finished.some((item) => !existing.has(String(item.fixture?.id))) && pending.length === limit,
      imported,
      failed,
    });
  } catch (error) {
    console.error('[history/import-competition] error:', error);
    if (error instanceof PersistentDatabaseNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao importar competição' },
      { status: 500 },
    );
  }
}
