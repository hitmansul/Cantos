import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const team1 = searchParams.get('team1');
  const team2 = searchParams.get('team2');

  if (!team1 || !team2) {
    return NextResponse.json({ error: 'Both team1 and team2 are required' }, { status: 400 });
  }

  const result = await sql`
    SELECT * FROM head_to_head
    WHERE (team1 = ${team1} AND team2 = ${team2}) OR (team1 = ${team2} AND team2 = ${team1})
  `;

  if (result.length === 0) {
    return NextResponse.json({ error: 'H2H not found' }, { status: 404 });
  }

  return NextResponse.json(result[0]);
}
