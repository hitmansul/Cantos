import { NextRequest, NextResponse } from 'next/server';

const SOFASCORE_BASE = 'https://api.sofascore.com/api/v1';
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: 'https://www.sofascore.com/',
  Origin: 'https://www.sofascore.com',
  'Cache-Control': 'no-cache',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId') || '325';
  const seasonId = searchParams.get('seasonId') || '58766';

  try {
    const url = `${SOFASCORE_BASE}/team/${teamId}/unique-tournament/${tournamentId}/season/${seasonId}/statistics/overall`;
    const response = await fetch(url, { headers: HEADERS });

    if (!response.ok) {
      throw new Error(`Sofascore API error ${response.status}`);
    }

    const data = (await response.json()) as { statistics?: Record<string, number> };
    const stats = data.statistics;

    if (!stats) {
      return NextResponse.json({ error: 'No statistics found' }, { status: 404 });
    }

    const matches = Number(stats.matches) || 0;
    const corners = Number(stats.corners) || 0;
    const cornersAgainst = Number(stats.cornersAgainst) || 0;

    return NextResponse.json({
      teamId: parseInt(teamId),
      tournamentId: parseInt(tournamentId),
      seasonId: parseInt(seasonId),
      matches,
      corners,
      cornersAgainst,
      avgCorners: matches > 0 ? Math.round((corners / matches) * 10) / 10 : 0,
      avgCornersAgainst: matches > 0 ? Math.round((cornersAgainst / matches) * 10) / 10 : 0,
      avgTotalCorners:
        matches > 0 ? Math.round(((corners + cornersAgainst) / matches) * 10) / 10 : 0,
      shots: Number(stats.shots) || 0,
      shotsOnTarget: Number(stats.shotsOnTarget) || 0,
      possession: Number(stats.averageBallPossession) || 0,
      goalsScored: Number(stats.goalsScored) || 0,
      goalsConceded: Number(stats.goalsConceded) || 0,
    });
  } catch (error) {
    console.error('Sofascore team corners error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch corner statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
