import { NextRequest, NextResponse } from 'next/server';
import { SCORES365_COMPETITIONS, scores365Get } from '@/app/api/utils/scores365';

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
  homeTeam: { id: number; name: string; shortName?: string };
  awayTeam: { id: number; name: string; shortName?: string };
}

const STATIC_UPCOMING_MATCHES: Record<string, NormalizedUpcomingMatch[]> = {
  champions_league: [
    {
      id: 2047742,
      startTime: '2026-05-30T16:00:00+00:00',
      roundName: 'Final',
      homeTeam: { id: 1644, name: 'Paris Saint-Germain', shortName: 'PSG' },
      awayTeam: { id: 42, name: 'Arsenal', shortName: 'Arsenal' },
    },
  ],
};

function normalizeGame(game: Raw365UpcomingGame): NormalizedUpcomingMatch {
  return {
    id: game.id,
    startTime: game.startTime,
    round: game.roundNum,
    roundName: game.roundName,
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

function isFutureOrLive(startTime: string, statusId?: number, now = Date.now()): boolean {
  if (statusId === 2) return true;
  const timestamp = Date.parse(startTime);
  return Number.isFinite(timestamp) && timestamp >= now;
}

function mergeStaticUpcoming(
  league: string,
  matches: NormalizedUpcomingMatch[],
  now = Date.now()
): NormalizedUpcomingMatch[] {
  const merged = new Map<number, NormalizedUpcomingMatch>();
  for (const match of matches) {
    merged.set(match.id, match);
  }

  for (const match of STATIC_UPCOMING_MATCHES[league] ?? []) {
    if (isFutureOrLive(match.startTime, undefined, now)) {
      merged.set(match.id, match);
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
        gamesData.games
          .filter((game) => isFutureOrLive(game.startTime, game.statusId, now))
          .map(normalizeGame),
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
        matches: mergeStaticUpcoming(league, [], now),
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

    const matches = mergeStaticUpcoming(league, Array.from(matchesMap.values()), now);

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
