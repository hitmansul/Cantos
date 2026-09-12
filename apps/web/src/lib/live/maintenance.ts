import { liveSql as sql } from '@/app/api/utils/sql';
import { ensureLiveSchema } from './schema';
export async function cleanupLiveData(){
  await ensureLiveSchema();
  // Bounded batches. Preserve pending evidence; keep terminal evaluation inputs for 180 days.
  const started=Date.now(); let deletedSnapshots=0, backlog=false;
  for(let batch=0;batch<20;batch++){
  const [result]=await sql`WITH deleted AS (
    DELETE FROM live_engine_snapshots WHERE id IN(
      SELECT s.id FROM live_engine_snapshots s WHERE s.captured_at<NOW()-INTERVAL '6 hours'
      AND NOT EXISTS(SELECT 1 FROM live_recommendations_v2 r WHERE r.event_key=s.event_key AND r.resolved_at IS NULL AND s.captured_at BETWEEN r.recorded_at-INTERVAL '10 minutes' AND r.recorded_at+INTERVAL '12 minutes')
      ORDER BY s.captured_at LIMIT 5000) RETURNING id)
    SELECT COUNT(*)::int AS deleted_snapshots FROM deleted`;
  deletedSnapshots+=Number(result.deleted_snapshots);
  backlog=Number(result.deleted_snapshots)===5000;
  if(!backlog||Date.now()-started>20_000)break;
  }
  const [retained]=await sql`WITH deleted AS(DELETE FROM live_recommendations_v2 WHERE evaluation_key IN(
    SELECT evaluation_key FROM live_recommendations_v2 WHERE resolved_at IS NOT NULL AND recorded_at<NOW()-INTERVAL '180 days' LIMIT 100000) RETURNING evaluation_key)
    SELECT COUNT(*)::int AS deleted_recommendations FROM deleted`;
  const [aliases]=await sql`WITH deleted AS(DELETE FROM live_engine_aliases a WHERE a.alias IN(
    SELECT old.alias FROM live_engine_aliases old WHERE old.updated_at<NOW()-INTERVAL '30 days'
    AND NOT EXISTS(SELECT 1 FROM live_engine_matches m WHERE m.event_key=old.event_key)
    AND NOT EXISTS(SELECT 1 FROM live_recommendations_v2 r WHERE r.event_key=old.event_key AND r.resolved_at IS NULL)
    LIMIT 5000) RETURNING alias) SELECT COUNT(*)::int AS deleted_aliases FROM deleted`;
  return{deleted_snapshots:deletedSnapshots,snapshot_backlog_possible:backlog,...retained,...aliases};
}
