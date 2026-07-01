import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const response = await fetch(`${request.nextUrl.origin}/api/world-cup/fifa-complete-auto-sync?dryRun=${dryRun ? 'true' : 'false'}`, { cache: 'no-store' });
  let payload: unknown;
  try { payload = await response.json(); } catch { payload = await response.text(); }
  return NextResponse.json({ success: response.ok, job: 'fifa-auto-sync', payload, lastUpdated: new Date().toISOString() }, { status: response.ok ? 200 : response.status });
}
