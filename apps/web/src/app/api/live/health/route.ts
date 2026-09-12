import { NextResponse } from 'next/server';
import { liveSql as sql, isQuotaError } from '../../utils/sql';
export const dynamic='force-dynamic';
export async function GET(){
  const generatedAt=new Date().toISOString();
  try{
    const [row]=await sql`WITH active AS (
      SELECT m.* FROM live_engine_matches m WHERE m.updated_at>NOW()-INTERVAL '15 minutes'
      AND m.updated_at>=(SELECT last_success_at FROM live_engine_control WHERE id=1)
    ),recent AS (
      SELECT event_key,captured_at,snapshot_data,LAG(snapshot_data) OVER(PARTITION BY event_key ORDER BY captured_at) AS previous_data,
      LAG(captured_at) OVER(PARTITION BY event_key ORDER BY captured_at) AS previous_at
      FROM live_engine_snapshots WHERE captured_at>NOW()-INTERVAL '10 minutes'
    ) SELECT
      (SELECT COUNT(*)::int FROM active) AS active_matches,
      (SELECT EXTRACT(EPOCH FROM NOW()-MAX(updated_at))::int FROM active) AS newest_match_age_seconds,
      (SELECT COUNT(*)::int FROM active a WHERE NOT EXISTS(SELECT 1 FROM recent r WHERE r.event_key=a.event_key AND r.captured_at>NOW()-INTERVAL '90 seconds' AND r.snapshot_data->>'quality'='verified' AND r.snapshot_data->'corners'->>'total' IS NOT NULL)) AS uncovered_matches,
      (SELECT COUNT(*)::int FROM recent) AS snapshots_10m,
      (SELECT COUNT(DISTINCT event_key)::int FROM recent) AS matches_with_snapshots_10m,
      (SELECT EXTRACT(EPOCH FROM NOW()-MAX(captured_at))::int FROM recent) AS newest_snapshot_age_seconds,
      (SELECT COUNT(*)::int FROM recent WHERE captured_at-previous_at<=INTERVAL '30 seconds' AND snapshot_data-'capturedAt'-'sourceObservedAt'=previous_data-'capturedAt'-'sourceObservedAt') AS duplicates,
      EXTRACT(EPOCH FROM NOW()-last_success_at)::int AS collector_age_seconds,last_error,source_status FROM live_engine_control WHERE id=1`;
    const active=Number(row?.active_matches??0),count=Number(row?.snapshots_10m??0),duplicates=Number(row?.duplicates??0);
    const collectorStale=row?.collector_age_seconds==null||Number(row.collector_age_seconds)>120;
    const status=collectorStale||row?.last_error?'degraded-collector':active===0?'idle':Number(row.uncovered_matches)>0||duplicates/Math.max(1,count)>0.15?'degraded':'healthy';
    return NextResponse.json({generatedAt,status,databaseReachable:true,activeMatches:active,
      newestMatchAgeSeconds:row?.newest_match_age_seconds??null,snapshots10m:count,matchesWithSnapshots10m:Number(row?.matches_with_snapshots_10m??0),
      exactNearDuplicates:duplicates,duplicateRatio:duplicates/Math.max(1,count),newestSnapshotAgeSeconds:row?.newest_snapshot_age_seconds??null,
      uncoveredMatches:Number(row?.uncovered_matches??0),collectorAgeSeconds:row?.collector_age_seconds??null,sourceStatus:row?.source_status??null},
      {headers:{'Cache-Control':'no-store'},status:collectorStale?503:200});
  }catch(error){return NextResponse.json({generatedAt,status:isQuotaError(error)?'degraded-quota':'degraded-database',databaseReachable:false,retryable:true},{status:503});}
}
