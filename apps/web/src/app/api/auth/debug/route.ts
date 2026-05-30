/**
 * Diagnóstico completo do Better Auth + Google OAuth.
 * GET /api/auth/debug
 */
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const betterAuthUrl = process.env.BETTER_AUTH_URL;
  const authUrl = process.env.AUTH_URL;
  const appUrlEnv = process.env.NEXT_PUBLIC_CREATE_APP_URL;
  const dbUrl = process.env.DATABASE_URL;

  // Mirrors auth.ts resolution logic — strip trailing slash
  const resolvedBaseUrl = (betterAuthUrl ?? authUrl ?? appUrlEnv ?? req.nextUrl.origin).replace(
    /\/+$/,
    ''
  );

  const issues: string[] = [];
  if (!clientId) issues.push('GOOGLE_CLIENT_ID não está definido');
  if (!clientSecret) issues.push('GOOGLE_CLIENT_SECRET não está definido');
  if (!betterAuthUrl && !authUrl && !appUrlEnv) {
    issues.push(
      'BETTER_AUTH_URL não está definido — adicione nas secrets com o valor: https://cantos-ia.created.app'
    );
  }
  if (!dbUrl) issues.push('DATABASE_URL não está definido');

  const clientIdFormatOk = clientId?.endsWith('.apps.googleusercontent.com');
  if (clientId && !clientIdFormatOk) {
    issues.push('GOOGLE_CLIENT_ID deve terminar em ".apps.googleusercontent.com"');
  }

  const callbackUrl = `${resolvedBaseUrl}/api/auth/callback/google`;

  // 1) Test DB connectivity
  let dbTest: Record<string, unknown> = {};
  try {
    await sql`SELECT 1 as ping`;
    dbTest = { ok: true, message: '✅ Conexão com banco OK' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    dbTest = { ok: false, error: msg };
    issues.push(`Banco de dados inacessível: ${msg}`);
  }

  // 2) Test writing to verification table (what Better Auth does during OAuth)
  let verificationWriteTest: Record<string, unknown> = {};
  try {
    const testId = `debug-test-${Date.now()}`;
    await sql`
      INSERT INTO verification (id, identifier, value, "expiresAt")
      VALUES (${testId}, 'debug-test', 'debug-value', NOW() + INTERVAL '1 minute')
    `;
    await sql`DELETE FROM verification WHERE id = ${testId}`;
    verificationWriteTest = { ok: true, message: '✅ Escrita na tabela verification OK' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    verificationWriteTest = { ok: false, error: msg };
    issues.push(`Falha ao escrever na tabela verification: ${msg}`);
  }

  // 3) Test the actual Better Auth sign-in/social endpoint via HTTP
  // Use relative callbackURL (Better Auth rejects absolute URLs from different origins)
  let socialSignInTest: Record<string, unknown> = {};
  try {
    const origin = req.nextUrl.origin;
    const res = await fetch(`${origin}/api/auth/sign-in/social`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        Referer: origin,
      },
      body: JSON.stringify({ provider: 'google', callbackURL: '/' }),
      redirect: 'manual',
    });
    const body = await res.text().catch(() => '(empty)');
    socialSignInTest = {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      body: body.slice(0, 800),
      ok: res.status === 302 || (res.status >= 200 && res.status < 400),
      interpretation:
        res.status === 302
          ? '✅ Sucesso — Better Auth redirecionando para o Google!'
          : res.status === 200
            ? '✅ OK'
            : `❌ Erro ${res.status} — veja body acima`,
    };
    if ((res.status !== 302 && res.status < 200) || res.status >= 400) {
      issues.push(`socialSignIn retornou ${res.status}: ${body.slice(0, 200)}`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack?.split('\n').slice(0, 6).join('\n') : undefined;
    socialSignInTest = { ok: false, error: msg, stack };
  }

  return NextResponse.json({
    status: issues.length === 0 ? '✅ Tudo OK' : '⚠️ Problemas encontrados',
    issues,
    config: {
      GOOGLE_CLIENT_ID: clientId
        ? `${clientId.slice(0, 20)}… ${clientIdFormatOk ? '✅ formato válido' : '❌ formato INVÁLIDO'}`
        : '❌ NÃO DEFINIDO',
      GOOGLE_CLIENT_SECRET: clientSecret ? '✅ Definido' : '❌ NÃO DEFINIDO',
      BETTER_AUTH_URL:
        betterAuthUrl ?? '❌ NÃO DEFINIDO (importante: defina como https://cantos-ia.created.app)',
      AUTH_URL: authUrl ?? '(não definido)',
      NEXT_PUBLIC_CREATE_APP_URL: appUrlEnv ?? '(não definido)',
      resolvedBaseUrl: resolvedBaseUrl,
      DATABASE_URL: dbUrl ? '✅ Definido' : '❌ NÃO DEFINIDO',
    },
    expectedGoogleCallbackUrl: callbackUrl,
    tests: {
      dbConnectivity: dbTest,
      verificationTableWrite: verificationWriteTest,
      socialSignIn: socialSignInTest,
    },
    fix: '⚠️ Adicione BETTER_AUTH_URL=https://cantos-ia.created.app nas Secrets do projeto',
  });
}
