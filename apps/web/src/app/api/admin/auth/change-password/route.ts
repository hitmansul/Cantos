import { NextRequest, NextResponse } from 'next/server';
import argon2 from 'argon2';
import sql from '@/app/api/utils/sql';
import { getAdminSession } from '@/app/api/utils/adminAuth';
import { signAdminToken, ADMIN_COOKIE_NAME, ADMIN_COOKIE_MAX_AGE } from '@/app/api/utils/adminJwt';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          error:
            'Banco de dados nao configurado. Configure DATABASE_URL na Vercel para alterar a senha admin.',
        },
        { status: 503 }
      );
    }

    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Sessao admin expirada. Entre novamente.' }, { status: 401 });
    }

    const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
    const newPassword = body.newPassword?.trim();

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'A nova senha deve ter pelo menos 8 caracteres.' },
        { status: 400 }
      );
    }

    const sessionAdminId = Number(session.id);
    const admins = Number.isFinite(sessionAdminId)
      ? await sql`
          SELECT id, email, admin_password_hash, must_change_password
          FROM admin_users
          WHERE id = ${sessionAdminId} AND is_active = 1
        `
      : await sql`
          SELECT id, email, admin_password_hash, must_change_password
          FROM admin_users
          WHERE email = ${session.email} AND is_active = 1
        `;

    if (admins.length === 0) {
      return NextResponse.json({ error: 'Administrador nao encontrado.' }, { status: 404 });
    }

    const admin = admins[0] as {
      id: number;
      email: string;
      admin_password_hash: string | null;
      must_change_password: number;
    };

    const changingTemporaryPassword = admin.must_change_password === 1;
    if (!changingTemporaryPassword) {
      if (!body.currentPassword || !admin.admin_password_hash) {
        return NextResponse.json({ error: 'Informe a senha atual.' }, { status: 400 });
      }

      const currentPasswordOk = await argon2.verify(admin.admin_password_hash, body.currentPassword);
      if (!currentPasswordOk) {
        return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 401 });
      }
    }

    const hash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await sql`
      UPDATE admin_users
      SET admin_password_hash = ${hash},
          must_change_password = 0,
          updated_at = NOW()::text
      WHERE id = ${admin.id}
    `;

    const token = signAdminToken({
      adminId: admin.id,
      email: admin.email,
      mustChangePassword: false,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ADMIN_COOKIE_MAX_AGE,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[admin/auth/change-password]', error);
    return NextResponse.json({ error: 'Erro interno ao alterar senha.' }, { status: 500 });
  }
}
