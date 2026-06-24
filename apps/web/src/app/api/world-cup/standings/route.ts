import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { WORLD_CUP_2026_KEY } from '@/lib/persistence/worldCupRepository';

export const dynamic = 'force-dynamic';

type StandingRow = {
  group_name: string | null;
  position: number | null;
  team_name: string | null;
  fifa_code: string | null;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  goals_for: number | null;
  goals_against: number | null;
  goal_difference: number | null;
  points: number | null;
  live_points: number | null;
  live_goal_difference: number | null;
  source_key: string | null;
  source_updated_at: string | null;
};

export async function GET() {
  try {
    const rows = (await sql`
      SELECT
        s.group_name,
        s.position,
        t.name AS team_name,
        t.fifa_code,
        s.played,
        s.won,
        s.drawn,
        s.lost,
        s.goals_for,
        s.goals_against,
        s.goal_difference,
        s.points,
        s.live_points,
        s.live_goal_difference,
        s.source_key,
        s.source_updated_at
      FROM world_cup_standings s
      JOIN world_cup_teams t ON t.id = s.team_id
      WHERE s.competition_key = ${WORLD_CUP_2026_KEY}
      ORDER BY
        COALESCE(s.group_name, ''),
        s.position NULLS LAST,
        s.points DESC NULLS LAST,
        s.goal_difference DESC NULLS LAST,
        s.goals_for DESC NULLS LAST,
        t.name
    `) as StandingRow[];

    const groups = rows.reduce<Record<string, StandingRow[]>>((acc, row) => {
      const group = row.group_name || 'Sem grupo';
      acc[group] = acc[group] ?? [];
      acc[group].push(row);
      return acc;
    }, {});

    return NextResponse.json({ success: true, count: rows.length, groups, standings: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao consultar classificacao da Copa.' },
      { status: 500 }
    );
  }
}
