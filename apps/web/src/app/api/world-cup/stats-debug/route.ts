import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export async function GET() {
  const rows = await sql`
    SELECT ms.source_key, ms.metric_key, ms.metric_name, COUNT(*)::int AS total
    FROM world_cup_match_statistics ms
    JOIN world_cup_matches m ON m.id = ms.match_id
    WHERE m.competition_key = 'world_cup_2026'
    GROUP BY ms.source_key, ms.metric_key, ms.metric_name
    ORDER BY total DESC
    LIMIT 300
  `;

  return NextResponse.json({ rows });
}
