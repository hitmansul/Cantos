import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function copyParams(request: NextRequest) {
  const params = new URLSearchParams(request.nextUrl.searchParams);
  if (!params.has('dryRun')) params.set('dryRun', 'false');
  if (!params.has('limit')) params.set('limit', '5');
  if (!params.has('mode')) params.set('mode', 'both');
  if (!params.has('onlyMissing')) params.set('onlyMissing', 'false');
  return params;
}

export async function GET(request: NextRequest) {
  const params = copyParams(request);
  const response = await fetch(`${request.nextUrl.origin}/api/world-cup/fifa-pmsr-sync?${params.toString()}`, { cache: 'no-store' });
  let payload: unknown;
  try { payload = await response.json(); } catch { payload = await response.text(); }
  return NextResponse.json({
    success: response.ok,
    endpoint: 'fifa-sync-latest',
    description: 'Sincronização incremental automática dos PMSR novos da FIFA.',
    payload,
    lastUpdated: new Date().toISOString(),
  }, { status: response.ok ? 200 : response.status });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const response = await fetch(`${request.nextUrl.origin}/api/world-cup/fifa-pmsr-sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dryRun: false, limit: 5, mode: 'both', onlyMissing: false, ...body }),
    cache: 'no-store',
  });
  let payload: unknown;
  try { payload = await response.json(); } catch { payload = await response.text(); }
  return NextResponse.json({
    success: response.ok,
    endpoint: 'fifa-sync-latest',
    description: 'Sincronização incremental automática dos PMSR novos da FIFA.',
    payload,
    lastUpdated: new Date().toISOString(),
  }, { status: response.ok ? 200 : response.status });
}
