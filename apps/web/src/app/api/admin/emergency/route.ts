/**
 * Emergency admin access endpoint.
 * Uses CRON_SECRET to bypass password — generates a session JWT directly.
 * Also hashes and saves a new password at the same time.
 * Use this when the normal setup flow fails.
 */
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import argon2 from 'argon2';
import { signAdminToken, ADMIN_COOKIE_NAME, ADMIN_COOKIE_MAX_AGE } from '@/app/api/utils/adminJwt';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      secret?: string;
      email?: string;
      newPassword?: string;
    };

    // Gate: CRON_SECRET required
    if (!body.secret || body.secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Secret inválido' }, { status: 401 });
    }

    const email = (body.email ?? 'hitmansul@gmail.com').toLowerCase().trim();
    const newPassword = body.newPassword;

    // Find admin
    const admins = await sql`
      SELECT id, email FROM admin_users WHERE email = ${email} AND is_active = 1
    `;

    if (admins.length === 0) {
      // Try to list all admins to help debug
      const all = await sql`SELECT id, email, is_active FROM admin_users`;
      return NextResponse.json(
        { error: `Admin não encontrado: ${email}`, allAdmins: all },
        { status: 404 }
      );
    }

    const admin = admins[0] as { id: number; email: string };

    // If a new password was provided, hash and save it
    if (newPassword && newPassword.length >= 8) {
      const hash = await argon2.hash(newPassword, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });

      const updateResult = await sql`
        UPDATE admin_users
        SET admin_password_hash = ${hash},
            must_change_password = 0,
            updated_at = ${new Date().toISOString()}
        WHERE id = ${admin.id}
        RETURNING id, email, must_change_password
      `;

      if (!updateResult || updateResult.length === 0) {
        return NextResponse.json({ error: 'UPDATE falhou — retornou 0 linhas' }, { status: 500 });
      }
    } else {
      // Just clear the must_change_password flag so login works
      await sql`
        UPDATE admin_users SET must_change_password = 0, updated_at = ${new Date().toISOString()}
        WHERE id = ${admin.id}
      `;
    }

    // Issue JWT and set cookie — admin is now logged in
    const token = signAdminToken({
      adminId: admin.id,
      email: admin.email,
      mustChangePassword: false,
    });

    const res = NextResponse.json({
      success: true,
      email: admin.email,
      message: newPassword
        ? 'Senha definida e sessão iniciada! Redirecionando para /admin…'
        : 'Sessão iniciada via CRON_SECRET! Redirecionando para /admin…',
      redirectTo: '/admin',
    });

    res.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ADMIN_COOKIE_MAX_AGE,
      path: '/',
    });

    return res;
  } catch (err) {
    console.error('[admin/emergency]', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erro interno: ${msg}` }, { status: 500 });
  }
}
