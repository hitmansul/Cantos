import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { WORLD_CUP_2026_KEY } from '@/lib/persistence/worldCupRepository';

export const dynamic = 'force-dynamic';

type StatRow = {
  match_id: number;
  home_team_name: string | null;
  away_team_name: string | null;
  home_score: number | null;
  away_score: number | null;
  kickoff_at: string | null;
  group_name: string | null;
  team_name: string | null;
  period: string | null;
  metric_key: string | null;
  metric_name: string | null;
  value_numeric: number | null;
  value_text: string | null;
  source_key: string | null;
  source_updated_at: string | null;
};

function toInteger(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), max);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = toInteger(searchParams.get('limit'), 300, 1000);

    const rows = (await sql`
      SELECT
        m.id AS match_id,
        m.home_team_name,
        m.away_team_name,
        m.home_score,
        m.away_score,
        m.kickoff_at,
        m.group_name,
        t.name AS team_name,
        ms.period,
        ms.metric_key,
        ms.metric_name,
        ms.value_numeric,
        ms.value_text,
        ms.source_key,
        ms.source_updated_at
      FROM world_cup_match_statistics ms
      JOIN world_cup_matches m ON m.id = ms.match_id
      JOIN world_cup_teams t ON t.id = ms.team_id
      WHERE m.competition_key = ${WORLD_CUP_2026_KEY}
      ORDER BY m.kickoff_at DESC NULLS LAST, m.id DESC, ms.metric_key, t.name
      LIMIT ${limit}
    `) as StatRow[];

    return NextResponse.json({ success: true, count: rows.length, stats: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao consultar estatisticas da Copa.' },
      { status: 500 }
    );
  }
}
