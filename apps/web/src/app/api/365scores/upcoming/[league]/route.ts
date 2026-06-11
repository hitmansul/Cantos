import { NextRequest, NextResponse } from 'next/server';
import { SCORES365_COMPETITIONS, scores365Get } from '@/app/api/utils/scores365';
import { apiFootballGet, isApiFootballConfigured } from '@/app/api/utils/apiFootball';

interface Raw365UpcomingGame {
  id: number;
  startTime: string;
  statusId?: number;
  statusText?: string;
  roundNum?: number;
  roundName?: string;
  homeCompetitor: { id: number; name: string; symbolicName?: string };
  awayCompetitor: { id: number; name: string; symbolicName?: string };
}

interface NormalizedUpcomingMatch {
  id: number;
  startTime: string;
  round?: number;
  roundName?: string;
  statusId?: number;
  statusText?: string;
  referee?: string | null;
  homeTeam: { id: number; name: string; shortName?: string };
  awayTeam: { id: number; name: string; shortName?: string };
}

interface ApiFootballFixture {
  fixture: {
    id: number;
    date: string;
    referee?: string | null;
    status?: {
      short?: string;
      long?: string;
      elapsed?: number | null;
    };
  };
  league?: {
    round?: string;
  };
  teams: {
    home: { id?: number; name: string; code?: string | null };
    away: { id?: number; name: string; code?: string | null };
  };
}

const STATIC_UPCOMING_MATCHES: Record<string, NormalizedUpcomingMatch[]> = {
  copa_do_mundo: [
    {
      id: 4627856,
      startTime: '2026-06-13T22:00:00+00:00',
      roundName: 'Fase de Grupos',
      homeTeam: { id: 2379, name: 'Brasil', shortName: 'BRA' },
      awayTeam: { id: 5093, name: 'Marrocos', shortName: 'MAR' },
    },
    {
      id: 900619,
      startTime: '2026-06-20T00:30:00+00:00',
      roundName: 'Fase de Grupos',
      homeTeam: { id: 2379, name: 'Brasil', shortName: 'BRA' },
      awayTeam: { id: 5094, name: 'Haiti', shortName: 'HAI' },
    },
    {
      id: 900624,
      startTime: '2026-06-24T22:00:00+00:00',
      roundName: 'Fase de Grupos',
      homeTeam: { id: 5095, name: 'Escócia', shortName: 'SCO' },
      awayTeam: { id: 2379, name: 'Brasil', shortName: 'BRA' },
    },
  ],
  champions_league: [
    {
      id: 2047742,
      startTime: '2026-05-30T16:00:00+00:00',
      roundName: 'Final',
      homeTeam: { id: 1644, name: 'Paris Saint-Germain', shortName: 'PSG' },
      awayTeam: { id: 42, name: 'Arsenal', shortName: 'Arsenal' },
    },
  ],
  brasileirao_b: [
    {
      id: 72060501,
      startTime: '2026-06-05T23:00:00+00:00',
      roundName: 'Rodada 12',
      homeTeam: { id: 0, name: 'Operário-PR', shortName: 'OPER' },
      awayTeam: { id: 0, name: 'Juventude', shortName: 'JUV' },
    },
    {
      id: 72060601,
      startTime: '2026-06-06T14:00:00+00:00',
      roundName: 'Rodada 12',
      homeTeam: { id: 0, name: 'Criciúma', shortName: 'CRI' },
      awayTeam: { id: 0, name: 'Londrina', shortName: 'LON' },
    },
    {
      id: 72060701,
      startTime: '2026-06-07T19:00:00+00:00',
      roundName: 'Rodada 12',
      homeTeam: { id: 0, name: 'CRB', shortName: 'CRB' },
      awayTeam: { id: 0, name: 'São Bernardo-SP', shortName: 'SBE' },
    },
    {
      id: 72060801,
      startTime: '2026-06-08T23:00:00+00:00',
      roundName: 'Rodada 12',
      homeTeam: { id: 0, name: 'Vila Nova', shortName: 'VNO' },
      awayTeam: { id: 0, name: 'Botafogo-SP', shortName: 'BOT' },
    },
    {
      id: 72060802,
      startTime: '2026-06-08T23:00:00+00:00',
      roundName: 'Rodada 12',
      homeTeam: { id: 0, name: 'América-MG', shortName: 'AME' },
      awayTeam: { id: 0, name: 'Atlético-GO', shortName: 'ACG' },
    },
    {
      id: 72060901,
      startTime: '2026-06-09T22:00:00+00:00',
      roundName: 'Rodada 12',
      homeTeam: { id: 0, name: 'Ponte Preta', shortName: 'PON' },
      awayTeam: { id: 0, name: 'Cuiabá', shortName: 'CUI' },
    },
    {
      id: 72060902,
      startTime: '2026-06-09T22:00:00+00:00',
      roundName: 'Rodada 12',
      homeTeam: { id: 0, name: 'Náutico', shortName: 'NAU' },
      awayTeam: { id: 0, name: 'Fortaleza', shortName: 'FOR' },
    },
    {
      id: 72061001,
      startTime: '2026-06-10T23:00:00+00:00',
      roundName: 'Rodada 12',
      homeTeam: { id: 0, name: 'Goiás', shortName: 'GOI' },
      awayTeam: { id: 0, name: 'Novorizontino', shortName: 'NOV' },
    },
    {
      id: 72061002,
      startTime: '2026-06-10T23:00:00+00:00',
      roundName: 'Rodada 12',
      homeTeam: { id: 0, name: 'Ceará', shortName: 'CEA' },
      awayTeam: { id: 0, name: 'Avaí', shortName: 'AVA' },
    },
    {
      id: 72061201,
      startTime: '2026-06-12T00:00:00+00:00',
      roundName: 'Rodada 12',
      homeTeam: { id: 0, name: 'Sport Recife', shortName: 'SPT' },
      awayTeam: { id: 0, name: 'Athletic Club', shortName: 'ATH' },
    },
    {
      id: 72061202,
      startTime: '2026-06-12T22:00:00+00:00',
      roundName: 'Rodada 13',
      homeTeam: { id: 0, name: 'Atlético-GO', shortName: 'ACG' },
      awayTeam: { id: 0, name: 'CRB', shortName: 'CRB' },
    },
  ],
};

function normalizeGame(game: Raw365UpcomingGame): NormalizedUpcomingMatch {
  return {
    id: game.id,
    startTime: game.startTime,
    round: game.roundNum,
    roundName: game.roundName,
    statusId: game.statusId,
    statusText: game.statusText,
    homeTeam: {
      id: game.homeCompetitor.id,
      name: game.homeCompetitor.name,
      shortName: game.homeCompetitor.symbolicName,
    },
    awayTeam: {
      id: game.awayCompetitor.id,
      name: game.awayCompetitor.name,
      shortName: game.awayCompetitor.symbolicName,
    },
  };
}

function apiFootballStatusId(status?: ApiFootballFixture['fixture']['status']): number | undefined {
  const short = status?.short?.toUpperCase();
  if (!short) return undefined;
  if (['1H', '2H', 'HT', 'ET', 'P', 'BT', 'INT', 'LIVE'].includes(short)) return 2;
  if (['NS', 'TBD'].includes(short)) return 1;
  if (['FT', 'AET', 'PEN'].includes(short)) return 3;
  return undefined;
}

function normalizeApiFootballFixture(fixture: ApiFootballFixture): NormalizedUpcomingMatch {
  return {
    id: fixture.fixture.id,
    startTime: fixture.fixture.date,
    roundName: fixture.league?.round,
    statusId: apiFootballStatusId(fixture.fixture.status),
    statusText: fixture.fixture.status?.long ?? fixture.fixture.status?.short,
    referee: fixture.fixture.referee ?? null,
    homeTeam: {
      id: fixture.teams.home.id ?? fixture.fixture.id * 10 + 1,
      name: fixture.teams.home.name,
      shortName: fixture.teams.home.code ?? undefined,
    },
    awayTeam: {
      id: fixture.teams.away.id ?? fixture.fixture.id * 10 + 2,
      name: fixture.teams.away.name,
      shortName: fixture.teams.away.code ?? undefined,
    },
  };
}

async function apiFootballWorldCupMatches(now = Date.now()): Promise<NormalizedUpcomingMatch[]> {
  if (!isApiFootballConfigured()) return [];

  const data = await apiFootballGet<ApiFootballFixture[]>('/fixtures', {
    params: {
      league: 1,
      season: 2026,
      from: '2026-06-11',
      to: '2026-07-19',
      timezone: 'America/Sao_Paulo',
    },
    revalidate: 600,
    timeoutMs: 12_000,
  });

  return (data?.response ?? [])
    .map(normalizeApiFootballFixture)
    .filter((match) => isFutureLiveOrToday(match.startTime, match.statusId, now));
}

function isFutureOrLive(startTime: string, statusId?: number, now = Date.now()): boolean {
  if (statusId === 2) return true;
  const timestamp = Date.parse(startTime);
  return Number.isFinite(timestamp) && timestamp >= now;
}

function startOfBrazilDayMs(now = Date.now()): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now));

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return now;

  return Date.parse(`${year}-${month}-${day}T00:00:00-03:00`);
}

function isFutureLiveOrToday(startTime: string, statusId?: number, now = Date.now()): boolean {
  if (isFutureOrLive(startTime, statusId, now)) return true;
  const timestamp = Date.parse(startTime);
  return Number.isFinite(timestamp) && timestamp >= startOfBrazilDayMs(now);
}

function compact(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function matchKey(match: NormalizedUpcomingMatch): string {
  const date = Number.isFinite(Date.parse(match.startTime))
    ? new Date(match.startTime).toISOString().slice(0, 10)
    : match.startTime.slice(0, 10);
  return [
    date,
    compact(match.homeTeam.name),
    compact(match.awayTeam.name),
  ].join('|');
}

function mergeStaticUpcoming(
  league: string,
  matches: NormalizedUpcomingMatch[],
  now = Date.now()
): NormalizedUpcomingMatch[] {
  const merged = new Map<number, NormalizedUpcomingMatch>();
  const seenByMatch = new Set<string>();
  for (const match of matches) {
    merged.set(match.id, match);
    seenByMatch.add(matchKey(match));
  }

  for (const match of STATIC_UPCOMING_MATCHES[league] ?? []) {
    const key = matchKey(match);
    if (isFutureLiveOrToday(match.startTime, undefined, now) && !seenByMatch.has(key)) {
      merged.set(match.id, match);
      seenByMatch.add(key);
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ league: string }> }
) {
  const { league } = await params;
  const competition = SCORES365_COMPETITIONS[league];

  if (!competition) {
    return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
  }

  try {
    const now = Date.now();
    let apiFootballMatches: NormalizedUpcomingMatch[] = [];
    if (league === 'copa_do_mundo') {
      try {
        apiFootballMatches = await apiFootballWorldCupMatches(now);
      } catch (error) {
        console.error('API-Football World Cup upcoming error:', error);
      }
    }

    // Primary: use /web/games/ endpoint to get all upcoming matches directly
    const gamesData = (await scores365Get('/web/games/', {
      competitions: competition.id.toString(),
      statuses: '1,2', // 1=scheduled, 2=live
    })) as {
      games?: Raw365UpcomingGame[];
    };

    if (gamesData.games && gamesData.games.length > 0) {
      const matches = mergeStaticUpcoming(
        league,
        [
          ...gamesData.games
          .filter((game) => isFutureOrLive(game.startTime, game.statusId, now))
          .map(normalizeGame),
          ...apiFootballMatches,
        ],
        now
      );

      return NextResponse.json({
        competition: league,
        competitionName: competition.name,
        country: competition.country,
        matches,
        lastUpdated: new Date().toISOString(),
      });
    }

    // Fallback: extract nextMatch from standings rows
    const data = (await scores365Get('/web/standings/', {
      competitions: competition.id.toString(),
    })) as {
      standings?: Array<{
        rows: Array<{
          competitor: { id: number; name: string };
          nextMatch?: {
            id: number;
            startTime: string;
            statusId?: number;
            roundNum?: number;
            roundName?: string;
            homeCompetitor: { id: number; name: string; symbolicName?: string };
            awayCompetitor: { id: number; name: string; symbolicName?: string };
          };
        }>;
      }>;
    };

    if (!data.standings || data.standings.length === 0) {
      return NextResponse.json({
        competition: league,
        competitionName: competition.name,
        country: competition.country,
        matches: mergeStaticUpcoming(league, apiFootballMatches, now),
        lastUpdated: new Date().toISOString(),
      });
    }

    const matchesMap = new Map<
      number,
      {
        id: number;
        startTime: string;
        round?: number;
        roundName?: string;
        homeTeam: { id: number; name: string; shortName?: string };
        awayTeam: { id: number; name: string; shortName?: string };
      }
    >();

    for (const standing of data.standings) {
      for (const row of standing.rows) {
        if (row.nextMatch) {
          const match = row.nextMatch;
          if (isFutureOrLive(match.startTime, match.statusId, now) && !matchesMap.has(match.id)) {
            matchesMap.set(match.id, {
              id: match.id,
              startTime: match.startTime,
              round: match.roundNum,
              roundName: match.roundName,
              homeTeam: {
                id: match.homeCompetitor.id,
                name: match.homeCompetitor.name,
                shortName: match.homeCompetitor.symbolicName,
              },
              awayTeam: {
                id: match.awayCompetitor.id,
                name: match.awayCompetitor.name,
                shortName: match.awayCompetitor.symbolicName,
              },
            });
          }
        }
      }
    }

    const matches = mergeStaticUpcoming(
      league,
      [...Array.from(matchesMap.values()), ...apiFootballMatches],
      now
    );

    return NextResponse.json({
      competition: league,
      competitionName: competition.name,
      country: competition.country,
      matches,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('365Scores upcoming error:', error);
    return NextResponse.json({ error: 'Failed to fetch upcoming matches' }, { status: 500 });
  }
}
