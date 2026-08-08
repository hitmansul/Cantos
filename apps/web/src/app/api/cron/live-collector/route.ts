import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorized(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (!authorization) return true;
  if (!secret) return true;
  return authorization === `Bearer ${secret}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCentral(url: URL) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  });
  const payload = await response.json() as Record<string, unknown>;
  return { response, payload };
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
    const initial = await fetchCentral(centralUrl);

    if (!initial.response.ok) {
      return NextResponse.json(
        {
          ok: false,
          startedAt,
          finishedAt: new Date().toISOString(),
          error: typeof initial.payload.error === 'string' ? initial.payload.error : 'Falha ao acionar o Motor Central',
        },
        { status: initial.response.status }
      );
    }

    const previousUpdatedAt = typeof initial.payload.lastUpdated === 'string' ? initial.payload.lastUpdated : null;
    let confirmedPayload = initial.payload;
    let collectionConfirmed = initial.payload.refreshQueued === false && previousUpdatedAt !== null;

    if (!collectionConfirmed) {
      for (let attempt = 1; attempt <= 12; attempt += 1) {
        await sleep(5_000);

        const verifyUrl = new URL('/api/live/central', request.nextUrl.origin);
        verifyUrl.searchParams.set('history', '0');
        verifyUrl.searchParams.set('collectorCheck', '1');
        verifyUrl.searchParams.set('t', String(Date.now()));

        const verification = await fetchCentral(verifyUrl);
        if (!verification.response.ok) continue;

        confirmedPayload = verification.payload;
        const currentUpdatedAt = typeof verification.payload.lastUpdated === 'string'
          ? verification.payload.lastUpdated
          : null;

        if (currentUpdatedAt && currentUpdatedAt !== previousUpdatedAt) {
          collectionConfirmed = true;
          break;
        }
      }
    }

    if (!collectionConfirmed) {
      return NextResponse.json(
        {
          ok: false,
          startedAt,
          finishedAt: new Date().toISOString(),
          error: 'O Motor Central respondeu, mas nenhuma nova coleta foi confirmada no período de verificação.',
          previousUpdatedAt,
          lastUpdated: confirmedPayload.lastUpdated ?? null,
          matches: typeof confirmedPayload.count === 'number' ? confirmedPayload.count : 0,
          engine: confirmedPayload.engine ?? null,
        },
        { status: 504 }
      );
    }

    return NextResponse.json({
      ok: true,
      collectionConfirmed: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      matches: typeof confirmedPayload.count === 'number' ? confirmedPayload.count : 0,
      previousUpdatedAt,
      lastUpdated: confirmedPayload.lastUpdated ?? null,
      refreshQueued: confirmedPayload.refreshQueued ?? false,
      engine: confirmedPayload.engine ?? null,
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
