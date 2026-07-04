import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

async function readJson(response: Response) {
  try { return await response.json(); } catch { return { raw: await response.text().catch(() => '') }; }
}

async function callWithTimeout(url: string, timeoutMs: number) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    return { ok: response.ok, status: response.status, durationMs: Date.now() - startedAt, payload: await readJson(response) };
  } catch (error) {
    return { ok: false, status: 0, durationMs: Date.now() - startedAt, payload: { error: error instanceof Error ? error.message : 'timeout or fetch error' } };
  } finally {
    clearTimeout(timer);
  }
}

function shouldRunAgain(payload: unknown) {
  if (!payload || typeof payload !== 'object') return false;
  const record = payload as Record<string, unknown>;
  return record.shouldRunAgain === true || Number(record.remainingPending ?? 0) > 0;
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const origin = url.origin;
  const limit = url.searchParams.get('limit') ?? '6';
  const importUrl = origin + '/api/world-cup/import-365-pending?dryRun=false&auto=true&limit=' + encodeURIComponent(limit);
  const stats365 = await callWithTimeout(importUrl, 25000);
  return NextResponse.json({
    success: stats365.ok,
    route: 'provider-sync-safe',
    mode: 'automatic-safe-batch',
    stats365,
    shouldRunAgain: shouldRunAgain(stats365.payload),
    durationMs: Date.now() - startedAt,
    lastUpdated: new Date().toISOString()
  }, { status: stats365.ok ? 200 : 207 });
}
