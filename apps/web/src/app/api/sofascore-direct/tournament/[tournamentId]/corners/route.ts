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
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params;
  const { searchParams } = new URL(request.url);
  const seasonId = searchParams.get('seasonId') || '58766';

  try {
    // Get standings to get all team IDs
    const standingsUrl = `${SOFASCORE_BASE}/unique-tournament/${tournamentId}/season/${seasonId}/standings/total`;
    const standingsResponse = await fetch(standingsUrl, { headers: HEADERS });

    if (!standingsResponse.ok) {
      throw new Error(`Failed to fetch standings: ${standingsResponse.status}`);
    }

    const standingsData = (await standingsResponse.json()) as {
      standings?: Array<{ rows: Array<{ team: { id: number; name: string } }> }>;
    };
    const standings = standingsData.standings;

    if (!standings || standings.length === 0) {
      return NextResponse.json({ error: 'No standings found' }, { status: 404 });
    }

    const teams = standings[0].rows.map((row) => ({
      id: row.team.id,
      name: row.team.name,
    }));

    const cornerStats = [];

    for (const team of teams.slice(0, 20)) {
      try {
        const statsUrl = `${SOFASCORE_BASE}/team/${team.id}/unique-tournament/${tournamentId}/season/${seasonId}/statistics/overall`;
        const statsResponse = await fetch(statsUrl, { headers: HEADERS });

        if (statsResponse.ok) {
          const statsData = (await statsResponse.json()) as { statistics?: Record<string, number> };
          const stats = statsData.statistics;

          if (stats) {
            const matches = Number(stats.matches) || 0;
            const corners = Number(stats.corners) || 0;
            const cornersAgainst = Number(stats.cornersAgainst) || 0;
            cornerStats.push({
              team: team.name,
              teamId: team.id,
              matches,
              corners,
              cornersAgainst,
              avgCorners: matches > 0 ? Math.round((corners / matches) * 10) / 10 : 0,
              avgCornersAgainst: matches > 0 ? Math.round((cornersAgainst / matches) * 10) / 10 : 0,
              avgTotalCorners:
                matches > 0 ? Math.round(((corners + cornersAgainst) / matches) * 10) / 10 : 0,
            });
          }
        }
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        console.error(`Failed to fetch stats for ${team.name}`);
      }
    }

    cornerStats.sort((a, b) => b.avgCorners - a.avgCorners);

    return NextResponse.json({
      tournamentId: parseInt(tournamentId),
      seasonId: parseInt(seasonId),
      teams: cornerStats,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sofascore tournament corners error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch corner stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
