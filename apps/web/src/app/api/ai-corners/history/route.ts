import { NextRequest, NextResponse } from 'next/server';
import { apiFootballGet, isApiFootballConfigured } from '@/app/api/utils/apiFootball';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TeamSearchItem = { team?: { id?: number; name?: string; logo?: string } };
type FixtureItem = {
  fixture?: { id?: number; date?: string };
  league?: { name?: string };
  teams?: { home?: { id?: number; name?: string }; away?: { id?: number; name?: string } };
};
type StatisticEntry = {
  team?: { id?: number; name?: string };
  statistics?: Array<{ type?: string; value?: number | string | null }>;
};

type CornerSample = {
  fixtureId: number;
  date: string;
  opponent: string;
  venue: 'home' | 'away';
  cornersFor: number;
  cornersAgainst: number;
  league: string;
};

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function numeric(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function cornersOf(entry: StatisticEntry | undefined): number | null {
  const item = entry?.statistics?.find((stat) => normalize(stat.type ?? '') === 'cornerkicks');
  return numeric(item?.value);
}

async function resolveTeam(query: string) {
  const payload = await apiFootballGet<TeamSearchItem[]>('/teams', {
    params: { search: query },
    revalidate: 86_400,
  });
  const items = payload?.response ?? [];
  const target = normalize(query);
  return items.find((item) => normalize(item.team?.name ?? '') === target) ?? items[0] ?? null;
}

async function mapFixtureToSample(item: FixtureItem, teamId: number): Promise<CornerSample | null> {
  const fixtureId = item.fixture?.id;
  if (!fixtureId) return null;

  const statisticsPayload = await apiFootballGet<StatisticEntry[]>('/fixtures/statistics', {
    params: { fixture: fixtureId },
    revalidate: 86_400,
    timeoutMs: 15_000,
  });
  const statistics = statisticsPayload?.response ?? [];
  const own = statistics.find((entry) => entry.team?.id === teamId);
  const rival = statistics.find((entry) => entry.team?.id !== teamId);
  const cornersFor = cornersOf(own);
  const cornersAgainst = cornersOf(rival);

  // Não transforma ausência de cobertura em zero, pois isso distorceria a projeção.
  if (cornersFor === null || cornersAgainst === null) return null;

  const isHome = item.teams?.home?.id === teamId;
  return {
    fixtureId,
    date: item.fixture?.date ?? '',
    opponent: isHome ? item.teams?.away?.name ?? '' : item.teams?.home?.name ?? '',
    venue: isHome ? 'home' : 'away',
    cornersFor,
    cornersAgainst,
    league: item.league?.name ?? '',
  };
}

async function loadSamples(teamId: number, limit: number): Promise<CornerSample[]> {
  // Busca uma janela maior, pois algumas competições não oferecem estatísticas de escanteios.
  const fixturesPayload = await apiFootballGet<FixtureItem[]>('/fixtures', {
    params: { team: teamId, last: 25, status: 'FT' },
    revalidate: 1_800,
    timeoutMs: 15_000,
  });

  const fixtures = (fixturesPayload?.response ?? [])
    .filter((item) => item.fixture?.id)
    .sort((a, b) => new Date(b.fixture?.date ?? 0).getTime() - new Date(a.fixture?.date ?? 0).getTime());

  const collected: CornerSample[] = [];
  const batchSize = 5;

  for (let index = 0; index < fixtures.length && collected.length < limit; index += batchSize) {
    const batch = fixtures.slice(index, index + batchSize);
    const results = await Promise.all(batch.map((fixture) => mapFixtureToSample(fixture, teamId)));
    collected.push(...results.filter((sample): sample is CornerSample => sample !== null));
  }

  return collected.slice(0, limit);
}

export async function GET(request: NextRequest) {
  const home = request.nextUrl.searchParams.get('home')?.trim() ?? '';
  const away = request.nextUrl.searchParams.get('away')?.trim() ?? '';
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') ?? 5), 3), 8);

  if (!home || !away) return NextResponse.json({ ok: false, error: 'Informe mandante e visitante.' }, { status: 400 });
  if (!isApiFootballConfigured()) return NextResponse.json({ ok: false, configured: false, error: 'API-Football não configurada.' }, { status: 503 });

  try {
    const [homeResolved, awayResolved] = await Promise.all([resolveTeam(home), resolveTeam(away)]);
    const homeId = homeResolved?.team?.id;
    const awayId = awayResolved?.team?.id;
    if (!homeId || !awayId) return NextResponse.json({ ok: false, error: 'Não foi possível localizar uma das equipes.' }, { status: 404 });

    const [homeSamples, awaySamples] = await Promise.all([loadSamples(homeId, limit), loadSamples(awayId, limit)]);
    if (homeSamples.length < 3 || awaySamples.length < 3) {
      return NextResponse.json({
        ok: false,
        code: 'INSUFFICIENT_HISTORY',
        error: `Foram encontrados ${homeSamples.length} jogos de ${homeResolved?.team?.name ?? home} e ${awaySamples.length} jogos de ${awayResolved?.team?.name ?? away} com escanteios. São necessários pelo menos 3 por equipe.`,
        homeSamples,
        awaySamples,
        counts: { home: homeSamples.length, away: awaySamples.length },
      }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      configured: true,
      teams: {
        home: { id: homeId, name: homeResolved?.team?.name ?? home, logo: homeResolved?.team?.logo ?? null },
        away: { id: awayId, name: awayResolved?.team?.name ?? away, logo: awayResolved?.team?.logo ?? null },
      },
      homeSamples,
      awaySamples,
      sampleCount: Math.min(homeSamples.length, awaySamples.length),
      fetchedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } });
  } catch (error) {
    console.error('[ai-corners/history] failed', error);
    return NextResponse.json({ ok: false, error: 'Não foi possível carregar o histórico automático.' }, { status: 500 });
  }
}
