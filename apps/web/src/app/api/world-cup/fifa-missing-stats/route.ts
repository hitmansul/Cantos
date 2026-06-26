import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';

const WORLD_CUP_2026_KEY = 'world_cup_2026';

type Row = {
  id: number | string;
  fixture_key: string;
  home_team_name: string;
  away_team_name: string;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
  kickoff_at: string | null;
  referee: string | null;
  total_stats: number;
  fifa_stats: number;
  other_stats: number;
};

function finished(status: unknown) {
  const value = String(status ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ['fim', 'final', 'finished', 'ft', 'encerrado'].some((term) => value.includes(term));
}

export async function GET() {
  try {
    const rows = (await sql`
      SELECT
        m.id,
        m.fixture_key,
        m.home_team_name,
        m.away_team_name,
        m.home_score,
        m.away_score,
        m.status,
        m.kickoff_at,
        m.referee,
        COUNT(ms.id)::int AS total_stats,
        COUNT(ms.id) FILTER (WHERE ms.source_key = 'fifa')::int AS fifa_stats,
        COUNT(ms.id) FILTER (WHERE ms.source_key <> 'fifa')::int AS other_stats
      FROM world_cup_matches m
      LEFT JOIN world_cup_match_statistics ms ON ms.match_id = m.id
      WHERE m.competition_key = ${WORLD_CUP_2026_KEY}
      GROUP BY m.id
      ORDER BY m.kickoff_at DESC NULLS LAST, m.id DESC
      LIMIT 200
    `) as Row[];

    const completed = rows.filter((row) => finished(row.status) || row.home_score !== null || row.away_score !== null);
    const missingFifa = completed.filter((row) => row.fifa_stats === 0);
    const missingAllStats = completed.filter((row) => row.total_stats === 0);

    return NextResponse.json({
      success: true,
      competition: WORLD_CUP_2026_KEY,
      summary: {
        completedMatches: completed.length,
        withFifaStats: completed.filter((row) => row.fifa_stats > 0).length,
        missingFifaStats: missingFifa.length,
        missingAllStats: missingAllStats.length,
      },
      priority: 'FIFA first. This audit shows finished matches that still need FIFA PMSR/PDF import into world_cup_match_statistics.',
      missingFifa,
      missingAllStats,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao auditar estatísticas FIFA.' },
      { status: 500 }
    );
  }
}
