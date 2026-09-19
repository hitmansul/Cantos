import { NextResponse } from 'next/server';
import { liveSql as sql } from '@/app/api/utils/sql';
import { MODEL_VERSION, PROTOCOL_VERSION } from '@/lib/live/intelligence';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    // Same cohort as performance: first opportunity per event and UTC ten-minute bucket.
    // Project compact evidence only; never return raw provider payloads or input history.
    const rows = await sql`WITH observations AS (
      SELECT evaluation_key,event_key,fixture,competition,recorded_at,match_minute,
        score,probability,confidence,corners_before,outcome_5m,outcome_10m,
        COALESCE(evidence->'five'->>'reason',evidence->>'reason') AS reason_5m,
        COALESCE(evidence->'ten'->>'reason',evidence->>'reason') AS reason_10m,
        ROW_NUMBER() OVER(PARTITION BY event_key,model_version,FLOOR(EXTRACT(EPOCH FROM recorded_at)/600) ORDER BY recorded_at) AS rn
      FROM live_recommendations_v2 WHERE recorded_at>NOW()-INTERVAL '30 days'
        AND model_version=${MODEL_VERSION} AND protocol_version=${PROTOCOL_VERSION} AND decision='OPORTUNIDADE'
    ) SELECT evaluation_key,event_key,fixture,competition,recorded_at,match_minute,score,probability,
      confidence,corners_before,outcome_5m,outcome_10m,reason_5m,reason_10m
      FROM observations WHERE rn=1 ORDER BY recorded_at DESC,evaluation_key DESC LIMIT 100`;
    return NextResponse.json({rows,limit:100,generatedAt:new Date().toISOString()}, {headers:{'Cache-Control':'public, max-age=60'}});
  } catch {
    return NextResponse.json({error:'Histórico de resultados indisponível',rows:[]},{status:503});
  }
}
