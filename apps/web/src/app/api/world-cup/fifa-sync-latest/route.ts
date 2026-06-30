import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function copyParams(request: NextRequest) {
  const params = new URLSearchParams(request.nextUrl.searchParams);
  if (!params.has('dryRun')) params.set('dryRun', 'false');
  if (!params.has('limit')) params.set('limit', '10');
  if (!params.has('mode')) params.set('mode', 'both');
  if (!params.has('onlyMissing')) params.set('onlyMissing', 'false');
  if (!params.has('forceMissing')) params.set('forceMissing', 'true');
  if (!params.has('maxMatchNumber')) params.set('maxMatchNumber', '200');
  return params;
}
async function readPayload(response: Response) {
  try { return await response.json(); } catch { return await response.text(); }
}

export async function GET(request: NextRequest) {
  const params = copyParams(request);
  const pmsrResponse = await fetch(`${request.nextUrl.origin}/api/world-cup/fifa-pmsr-sync?${params.toString()}`, { cache: 'no-store' });
  const pmsrPayload = await readPayload(pmsrResponse);
  const fallbackResponse = await fetch(`${request.nextUrl.origin}/api/world-cup/fifa-sync-match-centre-missing?dryRun=${params.get('dryRun')}&limit=${params.get('limit')}`, { cache: 'no-store' });
  const fallbackPayload = await readPayload(fallbackResponse);
  return NextResponse.json({
    success: pmsrResponse.ok && fallbackResponse.ok,
    endpoint: 'fifa-sync-latest',
    description: 'Sincronização incremental automática: primeiro PMSR, depois fallback Match Centre por matchId oficial FIFA.',
    pmsr: pmsrPayload,
    matchCentreFallback: fallbackPayload,
    lastUpdated: new Date().toISOString(),
  }, { status: pmsrResponse.ok && fallbackResponse.ok ? 200 : 207 });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const dryRun = body.dryRun ?? false;
  const limit = body.limit ?? 10;
  const pmsrResponse = await fetch(`${request.nextUrl.origin}/api/world-cup/fifa-pmsr-sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dryRun, limit, mode: 'both', onlyMissing: false, forceMissing: true, maxMatchNumber: 200, ...body }),
    cache: 'no-store',
  });
  const pmsrPayload = await readPayload(pmsrResponse);
  const fallbackResponse = await fetch(`${request.nextUrl.origin}/api/world-cup/fifa-sync-match-centre-missing?dryRun=${dryRun}&limit=${limit}`, { cache: 'no-store' });
  const fallbackPayload = await readPayload(fallbackResponse);
  return NextResponse.json({
    success: pmsrResponse.ok && fallbackResponse.ok,
    endpoint: 'fifa-sync-latest',
    description: 'Sincronização incremental automática: primeiro PMSR, depois fallback Match Centre por matchId oficial FIFA.',
    pmsr: pmsrPayload,
    matchCentreFallback: fallbackPayload,
    lastUpdated: new Date().toISOString(),
  }, { status: pmsrResponse.ok && fallbackResponse.ok ? 200 : 207 });
}
