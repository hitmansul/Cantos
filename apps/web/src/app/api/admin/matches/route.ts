import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { isAdmin } from '@/app/api/utils/adminAuth';

export async function GET(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const matches = await sql`SELECT * FROM upcoming_matches ORDER BY match_date, match_time`;
  return NextResponse.json(matches);
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const { id, home_team, away_team, match_date, match_time, league, round, referee } = body;

  if (id) {
    await sql`
      UPDATE upcoming_matches SET
        home_team = ${home_team}, away_team = ${away_team},
        match_date = ${match_date}, match_time = ${match_time},
        league = ${league}, round = ${round}, referee = ${referee || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;
  } else {
    await sql`
      INSERT INTO upcoming_matches (home_team, away_team, match_date, match_time, league, round, referee)
      VALUES (${home_team}, ${away_team}, ${match_date}, ${match_time}, ${league}, ${round}, ${referee || null})
    `;
  }

  return NextResponse.json({ success: true });
}
