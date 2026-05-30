import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { getAdminSession } from '@/app/api/utils/adminAuth';

export async function GET(request: NextRequest) {
  if (!(await getAdminSession(request)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admins =
    await sql`SELECT id, user_id, email, is_active, created_at FROM admin_users ORDER BY created_at`;
  return NextResponse.json(admins);
}

export async function POST(request: NextRequest) {
  const adminUser = await getAdminSession(request);
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { email } = body;

  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  const existing = await sql`SELECT * FROM admin_users WHERE email = ${email}`;
  if (existing.length > 0)
    return NextResponse.json({ error: 'This email is already an admin' }, { status: 400 });

  await sql`INSERT INTO admin_users (user_id, email, is_active) VALUES (${'pending_' + Date.now()}, ${email}, 1)`;
  return NextResponse.json({ success: true });
}
