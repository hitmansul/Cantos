export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const origin = url.origin;

  return new Response(JSON.stringify({
    success: true,
    route: 'fifa-complete-auto-sync',
    mode: 'edge-plan',
    message: 'Rota leve: apenas retorna os links das etapas isoladas.',
    manualSteps: {
      status: origin + '/api/world-cup/fifa-status',
      audit: origin + '/api/world-cup/fifa-availability-audit',
      backfill: origin + '/api/world-cup/fifa-match-id-backfill?dryRun=false&pendingOnly=true&limit=80',
      repair: origin + '/api/world-cup/fifa-repair-pending?dryRun=false&skipBackfill=true',
      pmsr: origin + '/api/world-cup/fifa-sync-latest?dryRun=false&limit=1&mode=both&forceMissing=true'
    },
    recommendedOrder: ['status', 'backfill', 'repair', 'pmsr', 'status'],
    durationMs: Date.now() - startedAt,
    buildMarker: 'edge-plan-v3',
    lastUpdated: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}
