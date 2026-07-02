import { NextRequest, NextResponse } from 'next/server';
import { importWorldCupFrom365Scores } from '@/lib/pipeline/worldCupScores365Importer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

async function readPayload(response: Response) {
  try { return await response.json(); } catch { return { raw: await response.text().catch(() => '') }; }
}
async function call(origin: string, path: string) {
  const startedAt = Date.now();
  const response = await fetch(`${origin}${path}`, { cache: 'no-store' });
  return { ok: response.ok, status: response.status, durationMs: Date.now() - startedAt, payload: await readPayload(response), url: `${origin}${path}` };
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const dryRun = request.nextUrl.searchParams.get('dryRun') !== 'false';
  const step = request.nextUrl.searchParams.get('step') ?? 'tick';
  const startedAt = Date.now();
  const steps: Array<{ name: string; ok: boolean; durationMs?: number; detail: unknown }> = [];

  if (step === 'scores365') {
    const t0 = Date.now();
    try {
      const scores365 = await importWorldCupFrom365Scores();
      steps.push({ name: '365Scores fallback completo', ok: true, durationMs: Date.now() - t0, detail: scores365 });
    } catch (error) {
      steps.push({ name: '365Scores fallback completo', ok: false, durationMs: Date.now() - t0, detail: { error: error instanceof Error ? error.message : 'Erro ao importar 365Scores.' } });
    }
  } else if (step === 'backfill') {
    const backfill = await call(origin, '/api/world-cup/fifa-match-id-backfill?dryRun=false&pendingOnly=true&limit=80').catch((error) => ({ ok: false, status: 0, durationMs: 0, payload: { error: error instanceof Error ? error.message : 'Erro no backfill FIFA.' }, url: '' }));
    steps.push({ name: 'Backfill fifa_match_id oficial', ok: backfill.ok, durationMs: backfill.durationMs, detail: backfill.payload });
  } else if (step === 'pmsr') {
    const pmsr = await call(origin, `/api/world-cup/fifa-sync-latest?dryRun=${dryRun ? 'true' : 'false'}&limit=2&mode=both&forceMissing=true`).catch((error) => ({ ok: false, status: 0, durationMs: 0, payload: { error: error instanceof Error ? error.message : 'Erro no PMSR FIFA.' }, url: '' }));
    steps.push({ name: 'FIFA oficial PMSR/latest', ok: pmsr.ok, durationMs: pmsr.durationMs, detail: pmsr.payload });
  } else if (step === 'repair') {
    const repair = await call(origin, `/api/world-cup/fifa-repair-pending?dryRun=${dryRun ? 'true' : 'false'}`).catch((error) => ({ ok: false, status: 0, durationMs: 0, payload: { error: error instanceof Error ? error.message : 'Erro no reparo Match Centre.' }, url: '' }));
    steps.push({ name: 'Reparo incremental Match Centre', ok: repair.ok, durationMs: repair.durationMs, detail: repair.payload });
  } else {
    const backfill = await call(origin, '/api/world-cup/fifa-match-id-backfill?dryRun=false&pendingOnly=true&limit=80').catch((error) => ({ ok: false, status: 0, durationMs: 0, payload: { error: error instanceof Error ? error.message : 'Erro no backfill FIFA.' }, url: '' }));
    steps.push({ name: 'Backfill fifa_match_id oficial', ok: backfill.ok, durationMs: backfill.durationMs, detail: backfill.payload });

    const repair = await call(origin, `/api/world-cup/fifa-repair-pending?dryRun=${dryRun ? 'true' : 'false'}`).catch((error) => ({ ok: false, status: 0, durationMs: 0, payload: { error: error instanceof Error ? error.message : 'Erro no reparo Match Centre.' }, url: '' }));
    steps.push({ name: 'Reparo incremental Match Centre', ok: repair.ok, durationMs: repair.durationMs, detail: repair.payload });
  }

  const status = await call(origin, '/api/world-cup/fifa-status').catch((error) => ({ ok: false, status: 0, durationMs: 0, payload: { error: error instanceof Error ? error.message : 'Erro no status.' }, url: '' }));
  steps.push({ name: 'Status final', ok: status.ok, durationMs: status.durationMs, detail: status.payload });

  return NextResponse.json({
    success: steps.some((item) => item.ok),
    dryRun,
    step,
    strategy: 'Execução incremental anti-timeout: o padrão roda apenas backfill + 1 reparo + status. 365Scores e PMSR pesado rodam em etapas separadas.',
    manualSteps: {
      tick: `${origin}/api/world-cup/fifa-complete-auto-sync?dryRun=false`,
      scores365: `${origin}/api/world-cup/fifa-complete-auto-sync?dryRun=false&step=scores365`,
      pmsr: `${origin}/api/world-cup/fifa-complete-auto-sync?dryRun=false&step=pmsr`,
      repair: `${origin}/api/world-cup/fifa-complete-auto-sync?dryRun=false&step=repair`,
      status: `${origin}/api/world-cup/fifa-status`,
    },
    durationMs: Date.now() - startedAt,
    steps,
    lastUpdated: new Date().toISOString(),
  }, { status: steps.some((item) => item.ok) ? 200 : 500 });
}
