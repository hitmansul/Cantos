export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return new Response(JSON.stringify({
    success: true,
    job: 'fifa-auto-sync',
    message: 'Cron leve. O processamento incremental principal está em /api/world-cup/provider-sync.',
    providerSync: origin + '/api/world-cup/provider-sync',
    buildMarker: 'auto-sync-light-v1',
    lastUpdated: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}
