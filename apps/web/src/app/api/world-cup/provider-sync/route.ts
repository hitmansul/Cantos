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

export async function GET(request: Request) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const origin = url.origin;
  const step = url.searchParams.get('step') ?? 'status';

  if (step === 'status') {
    const status = await callWithTimeout(origin + '/api/world-cup/fifa-status', 9000);
    return NextResponse.json({
      success: true,
      route: 'provider-sync',
      mode: 'status-only-safe-tick',
      policy: 'FIFA first; 365Scores/API fallback remains available, but heavy imports run in isolated endpoints.',
      status,
      nextSteps: {
        backfill: origin + '/api/world-cup/provider-sync?step=backfill',
        repair: origin + '/api/world-cup/provider-sync?step=repair',
        pmsr: origin + '/api/world-cup/provider-sync?step=pmsr'
      },
      buildMarker: 'provider-sync-v2-status-safe',
      durationMs: Date.now() - startedAt,
      lastUpdated: new Date().toISOString()
    });
  }

  if (step === 'backfill') {
    const backfill = await callWithTimeout(origin + '/api/world-cup/fifa-match-id-backfill?dryRun=false&pendingOnly=true&limit=20', 18000);
    return NextResponse.json({ success: backfill.ok, route: 'provider-sync', step, backfill, durationMs: Date.now() - startedAt, lastUpdated: new Date().toISOString() }, { status: backfill.ok ? 200 : 207 });
  }

  if (step === 'repair') {
    const repair = await callWithTimeout(origin + '/api/world-cup/fifa-repair-pending?dryRun=false&skipBackfill=true', 28000);
    return NextResponse.json({ success: repair.ok, route: 'provider-sync', step, repair, durationMs: Date.now() - startedAt, lastUpdated: new Date().toISOString() }, { status: repair.ok ? 200 : 207 });
  }

  if (step === 'pmsr') {
    const pmsr = await callWithTimeout(origin + '/api/world-cup/fifa-sync-latest?dryRun=false&limit=1&mode=both&forceMissing=true', 28000);
    return NextResponse.json({ success: pmsr.ok, route: 'provider-sync', step, pmsr, durationMs: Date.now() - startedAt, lastUpdated: new Date().toISOString() }, { status: pmsr.ok ? 200 : 207 });
  }

  return NextResponse.json({ success: false, error: 'step inválido', allowed: ['status', 'backfill', 'repair', 'pmsr'] }, { status: 400 });
}
