import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import sql from '@/app/api/utils/sql';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const existing = await sql`SELECT COUNT(*) as count FROM admin_users`;
    const count = Number((existing[0] as { count: number | string }).count);

    if (count > 0) {
      return NextResponse.json({ error: 'Admin already exists' }, { status: 400 });
    }

    await sql`
      INSERT INTO admin_users (user_id, email, is_active)
      VALUES (${session.user.id}, ${session.user.email}, 1)
    `;

    return NextResponse.json({ success: true, message: 'You are now an admin' });
  } catch (error) {
    console.error('Bootstrap error:', error);
    return NextResponse.json({ error: 'Failed to bootstrap admin' }, { status: 500 });
  }
}
