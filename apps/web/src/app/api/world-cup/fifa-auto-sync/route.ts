import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const response = await fetch(`${request.nextUrl.origin}/api/world-cup/fifa-sync-latest?dryRun=false&limit=5&mode=both&forceMissing=true`, { cache: 'no-store' });
  let payload: unknown;
  try { payload = await response.json(); } catch { payload = await response.text(); }
  return NextResponse.json({ success: response.ok, job: 'fifa-auto-sync', payload, lastUpdated: new Date().toISOString() }, { status: response.ok ? 200 : response.status });
}
