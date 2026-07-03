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
function savedCount(payload: unknown) {
  if (!payload || typeof payload !== 'object') return 0;
  const record = payload as Record<string, unknown>;
  return Number(record.totalSaved ?? record.savedValues ?? 0) || 0;
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const origin = url.origin;
  const step = url.searchParams.get('step') ?? 'status';

  if (step === 'status') {
    const status = await callWithTimeout(origin + '/api/world-cup/fifa-status', 9000);
    const coverage = await callWithTimeout(origin + '/api/world-cup/provider-coverage?limit=30', 12000);
    return NextResponse.json({
      success: true,
      route: 'provider-sync',
      mode: 'status-only-safe-tick',
      policy: '365Scores como fonte principal de estatisticas; FIFA como complemento oficial quando disponivel.',
      status,
      coverage,
      nextSteps: {
        stats365: origin + '/api/world-cup/provider-sync?step=stats365',
        repair: origin + '/api/world-cup/provider-sync?step=repair',
        all: origin + '/api/world-cup/provider-sync?step=all'
      },
      buildMarker: 'provider-sync-v3-365scores-primary',
      durationMs: Date.now() - startedAt,
      lastUpdated: new Date().toISOString()
    });
  }

  if (step === 'stats365') {
    const stats365 = await callWithTimeout(origin + '/api/world-cup/import-365-pending?dryRun=false&limit=10', 52000);
    return NextResponse.json({ success: stats365.ok, route: 'provider-sync', step, stats365, durationMs: Date.now() - startedAt, lastUpdated: new Date().toISOString() }, { status: stats365.ok ? 200 : 207 });
  }

  if (step === 'repair') {
    const repair = await callWithTimeout(origin + '/api/world-cup/fifa-repair-pending?dryRun=false&skipBackfill=true', 28000);
    return NextResponse.json({ success: repair.ok, route: 'provider-sync', step, repair, durationMs: Date.now() - startedAt, lastUpdated: new Date().toISOString() }, { status: repair.ok ? 200 : 207 });
  }

  if (step === 'all') {
    const stats365 = await callWithTimeout(origin + '/api/world-cup/import-365-pending?dryRun=false&limit=10', 52000);
    const statsSaved = savedCount(stats365.payload);
    const fifaRepair = statsSaved > 0 ? null : await callWithTimeout(origin + '/api/world-cup/fifa-repair-pending?dryRun=false&skipBackfill=true', 28000);
    return NextResponse.json({ success: stats365.ok || Boolean(fifaRepair?.ok), route: 'provider-sync', step, order: ['365Scores stats primary', 'FIFA complementary'], stats365, fifaRepair, durationMs: Date.now() - startedAt, lastUpdated: new Date().toISOString() }, { status: stats365.ok || fifaRepair?.ok ? 200 : 207 });
  }

  return NextResponse.json({ success: false, error: 'step invalido', allowed: ['status', 'stats365', 'repair', 'all'] }, { status: 400 });
}
