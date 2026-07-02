import { NextRequest, NextResponse } from 'next/server';
import { importWorldCupFrom365Scores } from '@/lib/pipeline/worldCupScores365Importer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

async function readPayload(response: Response) {
  try { return await response.json(); } catch { return { raw: await response.text().catch(() => '') }; }
}
async function call(origin: string, path: string, timeoutMs = 18000) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${origin}${path}`, { cache: 'no-store', signal: controller.signal });
    return { ok: response.ok, status: response.status, durationMs: Date.now() - startedAt, payload: await readPayload(response), url: `${origin}${path}` };
  } finally {
    clearTimeout(timer);
  }
}
function failed(name: string, error: unknown) {
  return { name, ok: false, durationMs: 0, detail: { error: error instanceof Error ? error.message : String(error) } };
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const dryRun = request.nextUrl.searchParams.get('dryRun') !== 'false';
  const step = request.nextUrl.searchParams.get('step') ?? 'plan';
  const startedAt = Date.now();
  const steps: Array<{ name: string; ok: boolean; durationMs?: number; detail: unknown }> = [];

  if (step === 'plan' || step === 'tick') {
    return NextResponse.json({
      success: true,
      dryRun,
      step,
      strategy: 'Anti-timeout definitivo: o endpoint padrão não executa tarefas pesadas. Ele apenas retorna o plano e os links das etapas isoladas.',
      reason: 'Chamadas internas longas para backfill/status/Chromium estavam causando 504 na Vercel. Cada etapa agora deve ser executada separadamente.',
      manualSteps: {
        backfill: `${origin}/api/world-cup/fifa-complete-auto-sync?dryRun=false&step=backfill`,
        repair: `${origin}/api/world-cup/fifa-complete-auto-sync?dryRun=false&step=repair`,
        pmsr: `${origin}/api/world-cup/fifa-complete-auto-sync?dryRun=false&step=pmsr`,
        scores365: `${origin}/api/world-cup/fifa-complete-auto-sync?dryRun=false&step=scores365`,
        status: `${origin}/api/world-cup/fifa-status`,
      },
      recommendedOrder: ['backfill', 'repair', 'pmsr', 'scores365', 'status'],
      durationMs: Date.now() - startedAt,
      lastUpdated: new Date().toISOString(),
    });
  }

  if (step === 'scores365') {
    const t0 = Date.now();
    try {
      const scores365 = await importWorldCupFrom365Scores();
      steps.push({ name: '365Scores fallback completo', ok: true, durationMs: Date.now() - t0, detail: scores365 });
    } catch (error) {
      steps.push(failed('365Scores fallback completo', error));
    }
  } else if (step === 'backfill') {
    const backfill = await call(origin, '/api/world-cup/fifa-match-id-backfill?dryRun=false&pendingOnly=true&limit=80', 15000).catch((error) => ({ ok: false, status: 0, durationMs: 0, payload: { error: error instanceof Error ? error.message : 'Erro/timeout no backfill FIFA.' }, url: '' }));
    steps.push({ name: 'Backfill fifa_match_id oficial', ok: backfill.ok, durationMs: backfill.durationMs, detail: backfill.payload });
  } else if (step === 'pmsr') {
    const pmsr = await call(origin, `/api/world-cup/fifa-sync-latest?dryRun=${dryRun ? 'true' : 'false'}&limit=1&mode=both&forceMissing=true`, 22000).catch((error) => ({ ok: false, status: 0, durationMs: 0, payload: { error: error instanceof Error ? error.message : 'Erro/timeout no PMSR FIFA.' }, url: '' }));
    steps.push({ name: 'FIFA oficial PMSR/latest', ok: pmsr.ok, durationMs: pmsr.durationMs, detail: pmsr.payload });
  } else if (step === 'repair') {
    const repair = await call(origin, `/api/world-cup/fifa-repair-pending?dryRun=${dryRun ? 'true' : 'false'}&skipBackfill=true`, 26000).catch((error) => ({ ok: false, status: 0, durationMs: 0, payload: { error: error instanceof Error ? error.message : 'Erro/timeout no reparo Match Centre.' }, url: '' }));
    steps.push({ name: 'Reparo incremental Match Centre', ok: repair.ok, durationMs: repair.durationMs, detail: repair.payload });
  } else {
    return NextResponse.json({ success: false, error: `step inválido: ${step}`, allowedSteps: ['plan', 'backfill', 'repair', 'pmsr', 'scores365'] }, { status: 400 });
  }

  return NextResponse.json({
    success: steps.some((item) => item.ok),
    dryRun,
    step,
    strategy: 'Execução isolada anti-timeout. Esta resposta não chama status final para evitar 504.',
    durationMs: Date.now() - startedAt,
    steps,
    next: `${origin}/api/world-cup/fifa-complete-auto-sync?dryRun=false`,
    lastUpdated: new Date().toISOString(),
  }, { status: steps.some((item) => item.ok) ? 200 : 500 });
}
