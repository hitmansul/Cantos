/**
 * Admin password setup endpoint — supports both manual and auto-generated temp passwords.
 * Protected by CRON_SECRET to prevent abuse.
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import sql from '@/app/api/utils/sql';
import argon2 from 'argon2';
import { ensureAdminUser } from '@/app/api/utils/adminSchema';

function generateTempPassword(): string {
  // 12-char alphanumeric without ambiguous chars (0/O, 1/I/l)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(12);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('');
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          error:
            'Banco de dados nao configurado. Configure DATABASE_URL na Vercel para definir a senha admin.',
        },
        { status: 503 }
      );
    }

    const body = (await req.json()) as {
      secret?: string;
      password?: string;
      email?: string;
      generateTemp?: boolean;
    };

    if (!body.secret || body.secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // When generateTemp=true, create a random password; otherwise use the supplied one
    const isTemp = body.generateTemp === true;
    const plainPassword = isTemp ? generateTempPassword() : body.password;

    if (!plainPassword || plainPassword.length < 8) {
      return NextResponse.json(
        { error: 'Senha deve ter pelo menos 8 caracteres' },
        { status: 400 }
      );
    }

    const email = (body.email ?? 'hitmansul@gmail.com').toLowerCase().trim();

    await ensureAdminUser(email);

    const admins = await sql`
      SELECT id, email FROM admin_users WHERE email = ${email} AND is_active = 1
    `;

    if (admins.length === 0) {
      return NextResponse.json({ error: `Admin não encontrado: ${email}` }, { status: 404 });
    }

    const admin = admins[0] as { id: number; email: string };

    const hash = await argon2.hash(plainPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await sql`
      UPDATE admin_users
      SET admin_password_hash = ${hash},
          must_change_password = ${isTemp ? 1 : 0},
          updated_at = NOW()::text
      WHERE id = ${admin.id}
    `;

    return NextResponse.json({
      success: true,
      email: admin.email,
      isTemp,
      ...(isTemp ? { tempPassword: plainPassword } : {}),
      message: isTemp
        ? 'Senha temporária gerada! Entre com ela e você será obrigado a criar uma nova.'
        : 'Senha configurada com sucesso! Acesse /admin/login para entrar.',
    });
  } catch (err) {
    console.error('[admin/auth/setup]', err);
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('admin_users') || message.includes('relation')) {
      return NextResponse.json(
        {
          error:
            'Tabela de administradores nao encontrada. Execute a configuracao/migracao do banco antes de definir senha.',
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
