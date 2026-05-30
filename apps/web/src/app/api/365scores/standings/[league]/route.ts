import { NextRequest, NextResponse } from 'next/server';
import { SCORES365_COMPETITIONS, scores365Get } from '@/app/api/utils/scores365';

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
    const data = (await scores365Get('/web/standings/', {
      competitions: competition.id.toString(),
    })) as {
      standings?: Array<{
        name?: string;
        groups?: Array<{ num: number; name: string }>;
        rows: Array<{
          groupNum?: number;
          position: number;
          competitor: {
            id: number;
            name: string;
            symbolicName?: string;
            color?: string;
            imageVersion?: number;
          };
          gamePlayed: number;
          gamesWon: number;
          gamesEven: number;
          gamesLost: number;
          for: number;
          against: number;
          ratio: number;
          points: number;
          recentForm?: string[];
          detailedRecentForm?: Array<{
            id: number;
            startTime: string;
            homeCompetitor: { name: string; score: number };
            awayCompetitor: { name: string; score: number };
            outcome: number;
          }>;
          nextMatch?: {
            id: number;
            startTime: string;
            homeCompetitor: { id: number; name: string };
            awayCompetitor: { id: number; name: string };
          };
        }>;
      }>;
    };

    if (!data.standings || data.standings.length === 0) {
      return NextResponse.json({
        competition: league,
        standings: [],
        groups: [],
        message: 'No standings found',
      });
    }

    // Validate that returned data matches expected competition (IDs can change each season)
    if (competition.expectedTeams && competition.expectedTeams.length > 0) {
      const returnedTeamNames = data.standings[0]?.rows.map((r) => r.competitor.name) ?? [];
      const hasExpectedTeam = competition.expectedTeams.some((expected) =>
        returnedTeamNames.some(
          (name) =>
            name.toLowerCase().includes(expected.toLowerCase()) ||
            expected.toLowerCase().includes(name.toLowerCase())
        )
      );
      if (!hasExpectedTeam && returnedTeamNames.length > 0) {
        // Just log — don't block. The ID may be slightly off but still useful.
        console.warn(
          `[365Scores] Possible ID drift for ${league} (id=${competition.id}): returned=${returnedTeamNames.slice(0, 3).join(', ')}`
        );
      }
    }

    // Support multiple groups (e.g. Copa Libertadores has 8 groups)
    const groups = data.standings.map((standing) => ({
      name: standing.name || 'Classificação',
      rows: standing.rows.map((row) => ({
        position: row.position,
        team: {
          id: row.competitor.id,
          name: row.competitor.name,
          shortName: row.competitor.symbolicName,
          color: row.competitor.color,
          imageVersion: row.competitor.imageVersion,
        },
        played: row.gamePlayed,
        won: row.gamesWon,
        drawn: row.gamesEven,
        lost: row.gamesLost,
        goalsFor: row.for,
        goalsAgainst: row.against,
        goalDiff: row.ratio,
        points: row.points,
        form: row.recentForm || [],
        recentMatches: (row.detailedRecentForm || []).slice(0, 5).map((m) => ({
          id: m.id,
          date: m.startTime,
          home: m.homeCompetitor.name,
          away: m.awayCompetitor.name,
          homeScore: m.homeCompetitor.score,
          awayScore: m.awayCompetitor.score,
          result: m.outcome === 1 ? 'W' : m.outcome === 2 ? 'D' : 'L',
        })),
        nextMatch: row.nextMatch
          ? {
              id: row.nextMatch.id,
              date: row.nextMatch.startTime,
              home: row.nextMatch.homeCompetitor.name,
              away: row.nextMatch.awayCompetitor.name,
            }
          : null,
      })),
    }));

    // For backwards compatibility, also return flat standings from first group
    const standings = groups[0]?.rows ?? [];

    return NextResponse.json({
      competition: league,
      competitionName: competition.name,
      country: competition.country,
      tableName: data.standings[0]?.name,
      standings,
      groups,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('365Scores standings error:', error);
    return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 });
  }
}
