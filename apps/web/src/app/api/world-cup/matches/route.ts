import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { WORLD_CUP_2026_KEY } from '@/lib/persistence/worldCupRepository';

export const dynamic = 'force-dynamic';

type MatchRow = {
  id: number;
  fixture_key: string;
  fifa_match_id: string | null;
  scores365_event_id: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  group_name: string | null;
  round_name: string | null;
  status: string | null;
  kickoff_at: string | null;
  home_score: number | null;
  away_score: number | null;
  source_key: string | null;
  source_updated_at: string | null;
  statistics_count: number;
};

function toInteger(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), max);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = toInteger(searchParams.get('limit'), 150, 500);

    const rows = (await sql`
      SELECT
        m.id,
        m.fixture_key,
        m.fifa_match_id,
        m.scores365_event_id,
        m.home_team_name,
        m.away_team_name,
        m.group_name,
        m.round_name,
        m.status,
        m.kickoff_at,
        m.home_score,
        m.away_score,
        m.source_key,
        m.source_updated_at,
        COUNT(ms.id)::int AS statistics_count
      FROM world_cup_matches m
      LEFT JOIN world_cup_match_statistics ms ON ms.match_id = m.id
      WHERE m.competition_key = ${WORLD_CUP_2026_KEY}
      GROUP BY m.id
      ORDER BY m.kickoff_at ASC NULLS LAST, m.id ASC
      LIMIT ${limit}
    `) as MatchRow[];

    return NextResponse.json({ success: true, count: rows.length, matches: rows, lastUpdated: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao consultar partidas da Copa.' },
      { status: 500 }
    );
  }
}
