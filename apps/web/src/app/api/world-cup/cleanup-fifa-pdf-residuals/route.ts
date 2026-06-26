import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';

const WORLD_CUP_2026_KEY = 'world_cup_2026';

export async function GET(request: NextRequest) {
  try {
    const dryRun = request.nextUrl.searchParams.get('dryRun') !== 'false';
    const limit = Math.max(1, Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 200), 500));

    const residuals = await sql`
      SELECT
        m.id,
        m.fixture_key,
        m.home_team_name,
        m.away_team_name,
        COUNT(ms.id)::int AS stats_count
      FROM world_cup_matches m
      LEFT JOIN world_cup_match_statistics ms ON ms.match_id = m.id
      WHERE m.competition_key = ${WORLD_CUP_2026_KEY}
        AND m.fixture_key LIKE 'fifa:pdf:%'
      GROUP BY m.id
      ORDER BY m.id DESC
      LIMIT ${limit}
    `;

    let deletedStats = 0;
    let deletedMatches = 0;

    if (!dryRun) {
      for (const row of residuals as Array<{ id: number; stats_count: number }>) {
        await sql`DELETE FROM world_cup_match_statistics WHERE match_id = ${row.id}`;
        await sql`DELETE FROM world_cup_matches WHERE id = ${row.id}`;
        deletedStats += Number(row.stats_count ?? 0);
        deletedMatches += 1;
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      scope: 'Somente Copa do Mundo 2026. Remove apenas resíduos fifa:pdf:* que não pertencem à agenda real scores365.',
      residualsFound: residuals.length,
      deletedMatches,
      deletedStats,
      residuals,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro ao limpar resíduos fifa:pdf.' }, { status: 500 });
  }
}
