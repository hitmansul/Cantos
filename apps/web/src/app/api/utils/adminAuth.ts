/**
 * Shared admin authentication helper.
 * Priority 1 — admin JWT cookie (custom email/password login).
 * Priority 2 — better-auth Google session (fallback).
 */
import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import sql from '@/app/api/utils/sql';
import { verifyAdminToken, ADMIN_COOKIE_NAME } from '@/app/api/utils/adminJwt';
import { ensureAdminSchema } from '@/app/api/utils/adminSchema';

export async function getAdminSession(request: NextRequest) {
  await ensureAdminSchema();

  // ── 1. Check custom admin JWT cookie ────────────────────────────────────
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (token) {
    const payload = verifyAdminToken(token);
    if (payload) {
      // Verify still active in DB
      const rows = await sql`
        SELECT id, email, must_change_password
        FROM admin_users
        WHERE id = ${payload.adminId} AND is_active = 1
      `;
      if (rows.length > 0) {
        const admin = rows[0] as { id: number; email: string; must_change_password: number };
        return {
          id: String(admin.id),
          email: admin.email ?? payload.email,
          name: admin.email ?? payload.email,
          mustChangePassword: admin.must_change_password === 1,
        };
      }
    }
  }

  // ── 2. Fall back to better-auth session (Google OAuth) ──────────────────
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return null;

    const userId = session.user.id;
    const email = session.user.email;

    // Fast path: match by user_id
    let result = await sql`
      SELECT id, must_change_password FROM admin_users WHERE user_id = ${userId} AND is_active = 1
    `;

    if (result.length === 0 && email) {
      // Fallback: match by email (handles pending_xxx legacy rows)
      const byEmail = await sql`
        SELECT id, must_change_password FROM admin_users WHERE email = ${email} AND is_active = 1
      `;
      if (byEmail.length > 0) {
        // Backfill real user_id for next time
        await sql`UPDATE admin_users SET user_id = ${userId} WHERE email = ${email} AND is_active = 1`;
        result = byEmail;
      }
    }

    if (result.length === 0) return null;
    const admin = result[0] as { must_change_password?: number };
    return {
      ...session.user,
      mustChangePassword: admin.must_change_password === 1,
    };
  } catch {
    return null;
  }
}

export async function isAdmin(request: NextRequest): Promise<boolean> {
  // Allow internal cron calls
  const cronHeader = request.headers.get('x-admin-cron');
  if (cronHeader && process.env.CRON_SECRET && cronHeader === process.env.CRON_SECRET) {
    return true;
  }
  return (await getAdminSession(request)) !== null;
}
