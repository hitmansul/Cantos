import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import sql from '@/app/api/utils/sql';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ isAdmin: false }, { status: 401 });
    }

    const userId = session.user.id;
    const email = session.user.email;

    // Check by user_id first (fast path), then fall back to email
    // This handles the case where legacy rows have user_id = 'pending_xxx'
    let result = await sql`
      SELECT * FROM admin_users WHERE user_id = ${userId} AND is_active = 1
    `;

    if (result.length === 0 && email) {
      // Fall back: match by email — also update user_id so next login is faster
      const byEmail = await sql`
        SELECT * FROM admin_users WHERE email = ${email} AND is_active = 1
      `;
      if (byEmail.length > 0) {
        // Backfill the real user_id so future lookups use the fast path
        await sql`
          UPDATE admin_users SET user_id = ${userId}
          WHERE email = ${email} AND is_active = 1
        `;
        result = byEmail;
      }
    }

    return NextResponse.json({ isAdmin: result.length > 0, user: session.user });
  } catch (error) {
    console.error('Admin check error:', error);
    return NextResponse.json({ isAdmin: false }, { status: 500 });
  }
}
