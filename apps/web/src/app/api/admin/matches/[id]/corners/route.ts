import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { isAdmin } from '@/app/api/utils/adminAuth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const {
    home_corners,
    away_corners,
    referee,
    home_yellow_cards,
    away_yellow_cards,
    home_red_cards,
    away_red_cards,
    home_shots,
    away_shots,
    home_shots_on_target,
    away_shots_on_target,
  } = body;

  const fields: string[] = [
    'home_corners = $1',
    'away_corners = $2',
    'is_completed = 1',
    'updated_at = CURRENT_TIMESTAMP',
  ];
  const values: unknown[] = [home_corners, away_corners];
  let paramCount = 2;

  if (referee !== undefined) {
    paramCount++;
    fields.push(`referee = COALESCE($${paramCount}, referee)`);
    values.push(referee || null);
  }
  if (home_yellow_cards !== undefined) {
    paramCount++;
    fields.push(`home_yellow_cards = COALESCE($${paramCount}, home_yellow_cards)`);
    values.push(home_yellow_cards ?? null);
  }
  if (away_yellow_cards !== undefined) {
    paramCount++;
    fields.push(`away_yellow_cards = COALESCE($${paramCount}, away_yellow_cards)`);
    values.push(away_yellow_cards ?? null);
  }
  if (home_red_cards !== undefined) {
    paramCount++;
    fields.push(`home_red_cards = COALESCE($${paramCount}, home_red_cards)`);
    values.push(home_red_cards ?? null);
  }
  if (away_red_cards !== undefined) {
    paramCount++;
    fields.push(`away_red_cards = COALESCE($${paramCount}, away_red_cards)`);
    values.push(away_red_cards ?? null);
  }
  if (home_shots !== undefined) {
    paramCount++;
    fields.push(`home_shots = COALESCE($${paramCount}, home_shots)`);
    values.push(home_shots ?? null);
  }
  if (away_shots !== undefined) {
    paramCount++;
    fields.push(`away_shots = COALESCE($${paramCount}, away_shots)`);
    values.push(away_shots ?? null);
  }
  if (home_shots_on_target !== undefined) {
    paramCount++;
    fields.push(`home_shots_on_target = COALESCE($${paramCount}, home_shots_on_target)`);
    values.push(home_shots_on_target ?? null);
  }
  if (away_shots_on_target !== undefined) {
    paramCount++;
    fields.push(`away_shots_on_target = COALESCE($${paramCount}, away_shots_on_target)`);
    values.push(away_shots_on_target ?? null);
  }

  paramCount++;
  values.push(id);
  await sql(`UPDATE upcoming_matches SET ${fields.join(', ')} WHERE id = $${paramCount}`, values);

  return NextResponse.json({ success: true });
}
