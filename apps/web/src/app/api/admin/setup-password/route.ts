/**
 * Endpoint para configurar senha de acesso admin via email/senha.
 * Usa oslo/password (Argon2id) — a mesma lib interna do Better-auth.
 * Protegido pelo CRON_SECRET.
 *
 * POST /api/admin/setup-password
 * Body: { "secret": "...", "email": "...", "password": "..." }
 *
 * GET /api/admin/setup-password/status?secret=... — diagnóstico
 */
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret, email, password } = body as {
      secret?: string;
      email?: string;
      password?: string;
    };

    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized — CRON_SECRET inválido' }, { status: 401 });
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'email e password são obrigatórios' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Senha deve ter pelo menos 8 caracteres' },
        { status: 400 }
      );
    }

    // 1. Busca o usuário pelo email
    const users = await sql`SELECT id, email, name FROM "user" WHERE email = ${email}`;
    if (users.length === 0) {
      return NextResponse.json(
        { error: `Nenhum usuário encontrado com email: ${email}` },
        { status: 404 }
      );
    }

    const user = users[0] as { id: string; email: string; name: string };

    // 2. Gera o hash com Argon2id — o mesmo algoritmo que o Better-auth usa internamente
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(password);

    // 3. Verifica se já existe conta de credencial
    const existingCredential = await sql`
      SELECT id FROM account
      WHERE "userId" = ${user.id} AND "providerId" = 'credential'
    `;

    if (existingCredential.length > 0) {
      await sql`
        UPDATE account
        SET password = ${hashedPassword}, "updatedAt" = NOW()
        WHERE "userId" = ${user.id} AND "providerId" = 'credential'
      `;
    } else {
      const accountId = `cred-${user.id}`;
      await sql`
        INSERT INTO account (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
        VALUES (
          ${accountId},
          ${user.id},
          ${email},
          'credential',
          ${hashedPassword},
          NOW(),
          NOW()
        )
      `;
    }

    // 4. Garante que o registro admin aponta para o user_id correto
    const adminCheck = await sql`SELECT id FROM admin_users WHERE email = ${email}`;
    if (adminCheck.length === 0) {
      await sql`INSERT INTO admin_users (user_id, email, is_active) VALUES (${user.id}, ${email}, 1)`;
    } else {
      await sql`UPDATE admin_users SET user_id = ${user.id} WHERE email = ${email}`;
    }

    // 5. Confirma que a conta foi criada/atualizada
    const verifyAccount = await sql`
      SELECT id FROM account
      WHERE "userId" = ${user.id} AND "providerId" = 'credential'
    `;

    return NextResponse.json({
      success: true,
      message: `✅ Senha configurada para ${email}. Acesse /account/signin e faça login com email + senha.`,
      userId: user.id,
      credentialAccountCreated: verifyAccount.length > 0,
    });
  } catch (error) {
    console.error('Setup password error:', error);
    return NextResponse.json(
      {
        error: 'Falha ao configurar senha',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.slice(0, 500) : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');

  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({
      info: 'Passe ?secret=SEU_CRON_SECRET para ver diagnóstico',
      usage: 'POST com body { secret, email, password }',
    });
  }

  const accounts = await sql`
    SELECT id, "userId", "providerId",
      CASE WHEN password IS NULL THEN 'NULL' WHEN password = '' THEN 'EMPTY' ELSE 'SET' END as has_password,
      "createdAt"
    FROM account ORDER BY "createdAt"
  `;
  const users = await sql`SELECT id, email, name FROM "user" ORDER BY "createdAt"`;
  const admins = await sql`SELECT id, user_id, email, is_active FROM admin_users`;

  return NextResponse.json({ accounts, users, admins });
}
