import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { isAdmin } from '@/app/api/utils/adminAuth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await sql`DELETE FROM upcoming_matches WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}

// PATCH: update fields of a match (e.g. change the league tag)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  // Build dynamic SET clause
  const allowed = [
    'league',
    'home_team',
    'away_team',
    'match_date',
    'match_time',
    'round',
    'referee',
  ] as const;
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  for (const field of allowed) {
    if (body[field] !== undefined) {
      setClauses.push(`${field} = $${paramIdx++}`);
      values.push(body[field]);
    }
  }
  if (setClauses.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }
  setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const query = `UPDATE upcoming_matches SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`;
  await sql(query, values);

  return NextResponse.json({ success: true });
}
