import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorized(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  // O GitHub Actions pode executar sem segredo configurado. Quando um token for
  // enviado, ele ainda precisa coincidir com o CRON_SECRET da Vercel.
  if (!authorization) return true;
  if (!secret) return true;
  return authorization === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const centralUrl = new URL('/api/live/central', request.nextUrl.origin);
  centralUrl.searchParams.set('refresh', '1');
  centralUrl.searchParams.set('history', '0');
  centralUrl.searchParams.set('collector', 'cron');
  centralUrl.searchParams.set('t', String(Date.now()));

  try {
    const response = await fetch(centralUrl, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    const payload = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          startedAt,
          finishedAt: new Date().toISOString(),
          error: typeof payload.error === 'string' ? payload.error : 'Falha ao acionar o Motor Central',
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      matches: typeof payload.count === 'number' ? payload.count : 0,
      lastUpdated: payload.lastUpdated ?? null,
      refreshQueued: payload.refreshQueued ?? false,
      engine: payload.engine ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Falha desconhecida no coletor',
      },
      { status: 500 }
    );
  }
}
