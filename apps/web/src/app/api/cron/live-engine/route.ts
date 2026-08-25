import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL('/api/live/central', request.nextUrl.origin);
  url.searchParams.set('refresh', '1');
  url.searchParams.set('history', '0');

  const response = await fetch(url, { cache: 'no-store' });
  const payload = await response.json().catch(() => ({ matches: [], error: 'Resposta inválida do motor ao vivo' }));

  return NextResponse.json(
    {
      ok: response.ok,
      refreshedAt: new Date().toISOString(),
      count: Array.isArray(payload.matches) ? payload.matches.length : 0,
      engine: payload.engine ?? null,
      error: payload.error ?? null,
    },
    { status: response.ok ? 200 : response.status }
  );
}
