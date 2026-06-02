import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import argon2 from 'argon2';
import { signAdminToken, ADMIN_COOKIE_NAME, ADMIN_COOKIE_MAX_AGE } from '@/app/api/utils/adminJwt';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          error:
            'Banco de dados nao configurado. Configure DATABASE_URL na Vercel para usar o admin.',
        },
        { status: 503 }
      );
    }

    const body = (await req.json()) as { email?: string; password?: string };

    if (!body.email || !body.password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    const admins = await sql`
      SELECT id, email, admin_password_hash, must_change_password
      FROM admin_users
      WHERE email = ${body.email.toLowerCase().trim()} AND is_active = 1
    `;

    // Generic error to avoid email enumeration
    const INVALID = NextResponse.json({ error: 'Email ou senha inválidos' }, { status: 401 });

    if (admins.length === 0) return INVALID;

    const admin = admins[0] as {
      id: number;
      email: string;
      admin_password_hash: string | null;
      must_change_password: number;
    };

    if (!admin.admin_password_hash) {
      return NextResponse.json(
        {
          error:
            'Senha não configurada ainda. Acesse /admin/setup para definir uma senha de acesso.',
        },
        { status: 401 }
      );
    }

    const valid = await argon2.verify(admin.admin_password_hash, body.password);
    if (!valid) return INVALID;

    const mustChange = admin.must_change_password === 1;
    const token = signAdminToken({
      adminId: admin.id,
      email: admin.email,
      mustChangePassword: mustChange,
    });

    const res = NextResponse.json({
      success: true,
      mustChangePassword: mustChange,
      // Always go to /admin — the admin page will show a banner if mustChangePassword is true
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
    console.error('[admin/auth/login]', err);
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('admin_users') || message.includes('relation')) {
      return NextResponse.json(
        {
          error:
            'Tabela de administradores nao encontrada. Execute a configuracao/migracao do banco antes de logar.',
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
