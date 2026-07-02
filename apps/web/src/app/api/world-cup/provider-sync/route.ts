import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    success: true,
    route: 'provider-sync',
    mode: 'incremental-pipeline-placeholder',
    policy: 'FIFA first; fallback to 365Scores when FIFA is missing.',
    nextSteps: {
      status: origin + '/api/world-cup/fifa-status',
      fifaRepair: origin + '/api/world-cup/fifa-repair-pending?dryRun=false&skipBackfill=true',
      fifaPmsr: origin + '/api/world-cup/fifa-sync-latest?dryRun=false&limit=1&mode=both&forceMissing=true'
    },
    buildMarker: 'provider-sync-v1',
    lastUpdated: new Date().toISOString()
  });
}
