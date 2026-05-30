import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { isAdmin } from '@/app/api/utils/adminAuth';

export async function GET(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const teams = await sql`SELECT * FROM teams ORDER BY league, name`;
  return NextResponse.json(teams);
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const { id, name, short_name, league } = body;

  if (id) {
    await sql`UPDATE teams SET name = ${name}, short_name = ${short_name}, league = ${league}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
  } else {
    await sql`INSERT INTO teams (name, short_name, league) VALUES (${name}, ${short_name}, ${league})`;
  }

  return NextResponse.json({ success: true });
}
