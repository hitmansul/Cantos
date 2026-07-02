export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const origin = url.origin;
  const payload = {
    success: true,
    route: 'fifa-complete-auto-sync',
    mode: 'stable-lightweight-response',
    message: 'Esta rota não executa importação pesada. A sincronização automática roda por endpoints incrementais/cron.',
    manualSteps: {
      providerSync: origin + '/api/world-cup/provider-sync?dryRun=false',
      status: origin + '/api/world-cup/provider-sync/status',
      legacyStatus: origin + '/api/world-cup/fifa-status'
    },
    durationMs: Date.now() - startedAt,
    buildMarker: 'stable-lightweight-20260701',
    lastUpdated: new Date().toISOString()
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'x-cantos-build-marker': 'stable-lightweight-20260701'
    }
  });
}
