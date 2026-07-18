import { NextRequest, NextResponse } from 'next/server';
import { SCORES365_COMPETITIONS, scores365Get } from '@/app/api/utils/scores365';
import { apiFootballGet, isApiFootballConfigured } from '@/app/api/utils/apiFootball';
import { getBrazilCompetition } from '@/lib/football/competitionCatalog';

type NormalizedUpcomingMatch = {
  id: number;
  startTime: string;
  round?: number;
  roundName?: string;
  statusId?: number;
  statusText?: string;
  referee?: string | null;
  source?: 'api-football' | '365scores';
  homeTeam: { id: number; name: string; shortName?: string };
  awayTeam: { id: number; name: string; shortName?: string };
};

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    referee?: string | null;
    status?: { short?: string; long?: string };
  };
  league?: { round?: string };
  teams: {
    home: { id?: number; name: string; code?: string | null };
    away: { id?: number; name: string; code?: string | null };
  };
};

type Scores365Game = {
  id: number;
  startTime: string;
  statusId?: number;
  statusText?: string;
  roundNum?: number;
  roundName?: string;
  homeCompetitor: { id: number; name: string; symbolicName?: string };
  awayCompetitor: { id: number; name: string; symbolicName?: string };
};

function statusIdFromApiFootball(short?: string): number | undefined {
  const value = short?.toUpperCase();
  if (!value) return undefined;
  if (['NS', 'TBD'].includes(value)) return 1;
  if (['1H', '2H', 'HT', 'ET', 'P', 'BT', 'INT', 'LIVE'].includes(value)) return 2;
  if (['FT', 'AET', 'PEN'].includes(value)) return 3;
  return undefined;
}

function normalizeApiFootball(item: ApiFootballFixture): NormalizedUpcomingMatch {
  return {
    id: item.fixture.id,
    startTime: item.fixture.date,
    roundName: item.league?.round,
    statusId: statusIdFromApiFootball(item.fixture.status?.short),
    statusText: item.fixture.status?.long ?? item.fixture.status?.short,
    referee: item.fixture.referee ?? null,
    source: 'api-football',
    homeTeam: {
      id: item.teams.home.id ?? item.fixture.id * 10 + 1,
      name: item.teams.home.name,
      shortName: item.teams.home.code ?? undefined,
    },
    awayTeam: {
      id: item.teams.away.id ?? item.fixture.id * 10 + 2,
      name: item.teams.away.name,
      shortName: item.teams.away.code ?? undefined,
    },
  };
}

function normalize365(item: Scores365Game): NormalizedUpcomingMatch {
  return {
    id: item.id,
    startTime: item.startTime,
    round: item.roundNum,
    roundName: item.roundName,
    statusId: item.statusId,
    statusText: item.statusText,
    source: '365scores',
    homeTeam: {
      id: item.homeCompetitor.id,
      name: item.homeCompetitor.name,
      shortName: item.homeCompetitor.symbolicName,
    },
    awayTeam: {
      id: item.awayCompetitor.id,
      name: item.awayCompetitor.name,
      shortName: item.awayCompetitor.symbolicName,
    },
  };
}

function isUpcomingOrLive(match: NormalizedUpcomingMatch, now = Date.now()) {
  if (match.statusId === 2) return true;
  const time = Date.parse(match.startTime);
  return Number.isFinite(time) && time >= now - 3 * 60 * 60 * 1000;
}

function normalizeTeamName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|ec|club|clube|futebol|sport|sporting)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchKey(match: NormalizedUpcomingMatch) {
  const date = Number.isFinite(Date.parse(match.startTime))
    ? new Date(match.startTime).toISOString().slice(0, 10)
    : match.startTime.slice(0, 10);
  return `${date}|${normalizeTeamName(match.homeTeam.name)}|${normalizeTeamName(match.awayTeam.name)}`;
}

function mergeMatches(groups: NormalizedUpcomingMatch[][]) {
  const merged = new Map<string, NormalizedUpcomingMatch>();
  for (const group of groups) {
    for (const match of group) {
      if (!isUpcomingOrLive(match)) continue;
      const key = matchKey(match);
      const current = merged.get(key);
      if (!current || match.source === 'api-football') merged.set(key, match);
    }
  }
  return Array.from(merged.values()).sort(
    (a, b) => Date.parse(a.startTime) - Date.parse(b.startTime)
  );
}

function dateInBrazil(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

async function fetchApiFootballUpcoming(league: string) {
  const config = getBrazilCompetition(league);
  if (!config || !isApiFootballConfigured()) return [];
  try {
    const data = await apiFootballGet<ApiFootballFixture[]>('/fixtures', {
      params: {
        league: config.apiFootballLeagueId,
        season: config.season,
        from: dateInBrazil(-1),
        to: dateInBrazil(120),
        timezone: 'America/Sao_Paulo',
      },
      revalidate: 300,
      timeoutMs: 12_000,
    });
    return (data?.response ?? []).map(normalizeApiFootball).filter(isUpcomingOrLive);
  } catch (error) {
    console.error(`[upcoming] API-Football ${league}:`, error);
    return [];
  }
}

async function fetch365Upcoming(league: string) {
  const competition = SCORES365_COMPETITIONS[league];
  if (!competition) return [];
  try {
    const data = (await scores365Get('/web/games/', {
      competitions: competition.id.toString(),
      statuses: '1,2',
    })) as { games?: Scores365Game[] };
    return (data.games ?? []).map(normalize365).filter(isUpcomingOrLive);
  } catch (error) {
    console.error(`[upcoming] 365Scores ${league}:`, error);
    return [];
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ league: string }> }
) {
  const { league } = await params;
  const brazilConfig = getBrazilCompetition(league);
  const scoresConfig = SCORES365_COMPETITIONS[league];

  if (!brazilConfig && !scoresConfig) {
    return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
  }

  const [apiFootballMatches, scores365Matches] = await Promise.all([
    fetchApiFootballUpcoming(league),
    fetch365Upcoming(league),
  ]);

  const matches = mergeMatches([apiFootballMatches, scores365Matches]);
  const preferredSource = apiFootballMatches.length > 0 ? 'api-football' : scores365Matches.length > 0 ? '365scores' : null;

  return NextResponse.json({
    competition: league,
    competitionName: brazilConfig?.name ?? scoresConfig?.name ?? league,
    country: brazilConfig?.country ?? scoresConfig?.country ?? '',
    matches,
    count: matches.length,
    source: preferredSource,
    sourceCounts: {
      apiFootball: apiFootballMatches.length,
      scores365: scores365Matches.length,
    },
    lastUpdated: new Date().toISOString(),
    policy: 'competition-catalog-api-football-first-v1',
  });
}
