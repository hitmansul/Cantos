import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { getWorldCupDatabaseSummary, WORLD_CUP_2026_KEY } from '@/lib/persistence/worldCupRepository';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = await getWorldCupDatabaseSummary();
    const recentMatches = await sql`
      SELECT
        m.home_team_name,
        m.away_team_name,
        m.home_score,
        m.away_score,
        m.status,
        m.kickoff_at,
        m.source_key,
        COUNT(ms.id)::int AS statistics_count
      FROM world_cup_matches m
      LEFT JOIN world_cup_match_statistics ms ON ms.match_id = m.id
      WHERE m.competition_key = ${WORLD_CUP_2026_KEY}
      GROUP BY m.id
      ORDER BY m.kickoff_at DESC NULLS LAST, m.id DESC
      LIMIT 10
    `;

    return NextResponse.json({
      success: true,
      worldCup: {
        summary,
        recentMatches,
        readiness: {
          squads: Number(summary?.players ?? 0) > 0,
          matches: Number(summary?.matches ?? 0) > 0,
          matchStatistics: Number(summary?.match_statistics ?? 0) > 0,
          standings: Number(summary?.standings ?? 0) > 0,
          playerStatistics: Number(summary?.player_statistics ?? 0) > 0,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao consultar contexto da IA.' },
      { status: 500 }
    );
  }
}
