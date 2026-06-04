import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { getAdminSession } from '@/app/api/utils/adminAuth';
import { ensureAdminSchema, ensureAdminUser } from '@/app/api/utils/adminSchema';

export async function GET(request: NextRequest) {
  if (!(await getAdminSession(request)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureAdminSchema();
  const admins =
    await sql`
      SELECT id, user_id, email, is_active, created_at
      FROM admin_users
      ORDER BY LOWER(email)
    `;
  return NextResponse.json(admins);
}

export async function POST(request: NextRequest) {
  const adminUser = await getAdminSession(request);
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  await ensureAdminSchema();
  const existing = await sql`
    SELECT id, email, is_active
    FROM admin_users
    WHERE LOWER(email) = ${email}
    LIMIT 1
  `;
  if (existing.length > 0) {
    await sql`
      UPDATE admin_users
      SET is_active = 1, updated_at = ${new Date().toISOString()}
      WHERE id = ${(existing[0] as { id: number }).id}
    `;
    return NextResponse.json({
      success: true,
      alreadyExisted: true,
      admin: existing[0],
      message: 'Admin ja estava cadastrado e foi mantido ativo.',
    });
  }

  const admin = await ensureAdminUser(email);
  return NextResponse.json({ success: true, admin });
}
