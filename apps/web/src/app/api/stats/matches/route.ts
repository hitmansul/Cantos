import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get('league');

  // match_date é TEXT no Postgres — comparar com string YYYY-MM-DD evita erro de tipo
  const today = new Date().toISOString().split('T')[0];

  if (league) {
    const matches = await sql`
      SELECT * FROM upcoming_matches
      WHERE league = ${league} AND match_date >= ${today}
      ORDER BY match_date, match_time
    `;
    return NextResponse.json(matches);
  }

  const matches = await sql`
    SELECT * FROM upcoming_matches
    WHERE match_date >= ${today}
    ORDER BY match_date, match_time
    LIMIT 50
  `;
  return NextResponse.json(matches);
}
