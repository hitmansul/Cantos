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
  const run365 = request.nextUrl.searchParams.get('scores365') !== 'false';
  const steps: Array<{ name: string; ok: boolean; durationMs?: number; detail: unknown }> = [];
  const startedAt = Date.now();

  let scores365: unknown = { skipped: true };
  if (run365) {
    const t0 = Date.now();
    try {
      scores365 = await importWorldCupFrom365Scores();
      steps.push({ name: '365Scores fallback completo', ok: true, durationMs: Date.now() - t0, detail: scores365 });
    } catch (error) {
      scores365 = { success: false, error: error instanceof Error ? error.message : 'Erro ao importar 365Scores.' };
      steps.push({ name: '365Scores fallback completo', ok: false, durationMs: Date.now() - t0, detail: scores365 });
    }
  }

  const backfill = await call(origin, '/api/world-cup/fifa-match-id-backfill?dryRun=false&pendingOnly=true&limit=80').catch((error) => ({ ok: false, status: 0, durationMs: 0, payload: { error: error instanceof Error ? error.message : 'Erro no backfill FIFA.' }, url: '' }));
  steps.push({ name: 'Backfill fifa_match_id oficial', ok: backfill.ok, durationMs: backfill.durationMs, detail: backfill.payload });

  const pmsr = await call(origin, `/api/world-cup/fifa-sync-latest?dryRun=${dryRun ? 'true' : 'false'}&limit=5&mode=both&forceMissing=true`).catch((error) => ({ ok: false, status: 0, durationMs: 0, payload: { error: error instanceof Error ? error.message : 'Erro no PMSR FIFA.' }, url: '' }));
  steps.push({ name: 'FIFA oficial PMSR/latest', ok: pmsr.ok, durationMs: pmsr.durationMs, detail: pmsr.payload });

  const repair = await call(origin, `/api/world-cup/fifa-repair-pending?dryRun=${dryRun ? 'true' : 'false'}`).catch((error) => ({ ok: false, status: 0, durationMs: 0, payload: { error: error instanceof Error ? error.message : 'Erro no reparo Match Centre.' }, url: '' }));
  steps.push({ name: 'Reparo incremental Match Centre', ok: repair.ok, durationMs: repair.durationMs, detail: repair.payload });

  const status = await call(origin, '/api/world-cup/fifa-status').catch((error) => ({ ok: false, status: 0, durationMs: 0, payload: { error: error instanceof Error ? error.message : 'Erro no status.' }, url: '' }));
  steps.push({ name: 'Status final', ok: status.ok, durationMs: status.durationMs, detail: status.payload });

  return NextResponse.json({
    success: steps.some((step) => step.ok),
    dryRun,
    strategy: 'Arquitetura final: 365Scores garante cobertura completa; FIFA é prioridade oficial quando PMSR/Match Centre estiver disponível; execução incremental evita timeout na Vercel.',
    notes: [
      '365Scores é fallback operacional para não deixar partidas sem dados.',
      'FIFA continua sendo fonte prioritária e substitui/complementa quando publicar estatísticas oficiais.',
      'O reparo Match Centre processa no máximo uma partida por execução para preservar memória do Chromium.',
    ],
    durationMs: Date.now() - startedAt,
    steps,
    nextManualRun: `${origin}/api/world-cup/fifa-complete-auto-sync?dryRun=false`,
    statusUrl: `${origin}/api/world-cup/fifa-status`,
    lastUpdated: new Date().toISOString(),
  }, { status: steps.some((step) => step.ok) ? 200 : 500 });
}
