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
    const data = (await scores365Get('/web/games/results/', {
      competitions: competition.id.toString(),
    })) as {
      games?: Array<{
        id: number;
        statusId: number;
        statusText: string;
        startTime: string;
        roundNum?: number;
        roundName?: string;
        homeCompetitor: {
          id: number;
          name: string;
          score?: number;
          symbolicName?: string;
          color?: string;
        };
        awayCompetitor: {
          id: number;
          name: string;
          score?: number;
          symbolicName?: string;
          color?: string;
        };
      }>;
    };

    if (!data.games) {
      return NextResponse.json({ competition: league, matches: [], message: 'No results found' });
    }

    const matches = data.games
      .map((game) => ({
        id: game.id,
        status: game.statusId,
        statusText: game.statusText,
        startTime: game.startTime,
        round: game.roundNum,
        roundName: game.roundName,
        homeTeam: {
          id: game.homeCompetitor.id,
          name: game.homeCompetitor.name,
          shortName: game.homeCompetitor.symbolicName,
          score: game.homeCompetitor.score || 0,
          color: game.homeCompetitor.color,
        },
        awayTeam: {
          id: game.awayCompetitor.id,
          name: game.awayCompetitor.name,
          shortName: game.awayCompetitor.symbolicName,
          score: game.awayCompetitor.score || 0,
          color: game.awayCompetitor.color,
        },
      }))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    return NextResponse.json({
      competition: league,
      competitionName: competition.name,
      country: competition.country,
      matches,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('365Scores results error:', error);
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
  }
}
