/**
 * Endpoint de setup — usa o hasher INTERNO do better-auth para garantir
 * compatibilidade total com a verificação do sign-in.
 */
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { secret?: string; password?: string; email?: string };

  if (!body.secret || body.secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!body.password || body.password.length < 8) {
    return NextResponse.json({ error: 'password min 8 chars' }, { status: 400 });
  }

  const email = body.email ?? 'hitmansul@gmail.com';

  // 1. Busca usuário
  const users = await sql`SELECT id, email FROM "user" WHERE email = ${email}`;
  if (users.length === 0) {
    return NextResponse.json({ error: `User not found: ${email}` }, { status: 404 });
  }
  const userId = (users[0] as { id: string }).id;

  // 2. Usa o hasher INTERNO do better-auth (garante compatibilidade total)
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(body.password);

  // 3. Remove qualquer conta credential existente
  await sql`DELETE FROM account WHERE "userId" = ${userId} AND "providerId" = 'credential'`;

  // 4. Insere nova conta com hash gerado pelo próprio better-auth
  await sql`
    INSERT INTO account (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
    VALUES (
      ${'setup-' + userId},
      ${userId},
      ${userId},
      'credential',
      ${hash},
      NOW(),
      NOW()
    )
  `;

  // 5. Verifica no banco
  const accounts = await sql`
    SELECT id, "userId", "providerId", "accountId",
      CASE WHEN password IS NULL THEN 'NULL'
           ELSE LEFT(password, 40)
      END as hash_preview
    FROM account
    WHERE "userId" = ${userId}
    ORDER BY "createdAt"
  `;

  const credentialCreated = (accounts as { providerId: string }[]).some(
    (a) => a.providerId === 'credential'
  );

  return NextResponse.json({
    success: credentialCreated,
    userId,
    email,
    hashAlgorithmPrefix: hash.slice(0, 25),
    allAccountsForUser: accounts,
    message: credentialCreated
      ? 'Conta credential criada. Tente fazer login agora.'
      : 'FALHOU — conta não encontrada após INSERT.',
  });
}
