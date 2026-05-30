import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(Date.now());
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get('league');
  const limitParam = Number(searchParams.get('limit') ?? '500');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 500) : 500;

  const today = todayInSaoPaulo();

  try {
    if (league) {
      const matches = await sql`
        SELECT * FROM upcoming_matches
        WHERE league = ${league}
          AND match_date >= ${today}
          AND (is_completed = 0 OR is_completed IS NULL)
        ORDER BY match_date, match_time
        LIMIT ${limit}
      `;
      return NextResponse.json(matches);
    }

    const matches = await sql`
      SELECT * FROM upcoming_matches
      WHERE match_date >= ${today}
        AND (is_completed = 0 OR is_completed IS NULL)
      ORDER BY match_date, match_time
      LIMIT ${limit}
    `;
    return NextResponse.json(matches);
  } catch (error) {
    console.error('stats/matches error:', error);
    return NextResponse.json([]);
  }
}
