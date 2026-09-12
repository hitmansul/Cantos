import { liveSql as sql } from '@/app/api/utils/sql';
import { ensureLiveSchema } from './schema';
import { MODEL_VERSION, PROTOCOL_VERSION, total, minuteNumber, type Assessment, type Sample } from './intelligence';
import { observation, resolveWindow } from './outcomes';
export type EvaluatedMatch={eventKey:string;competition?:string;homeTeam:{name:string};awayTeam:{name:string};engineHistory:Sample[];assessment:Assessment};
export async function recordAssessments(matches:EvaluatedMatch[]){
  const entries=matches.flatMap(m=>{
    const a=m.assessment,s=m.engineHistory.at(-1),corners=total(s?.corners);
    if(!a.ready||a.modelVersion!==MODEL_VERSION||!s?.statsSource||corners===null||!Number.isInteger(corners))return[];
    return[{evaluation_key:a.evaluationKey,event_key:m.eventKey,fixture:`${m.homeTeam.name} x ${m.awayTeam.name}`,competition:m.competition??null,
      model_version:MODEL_VERSION,protocol_version:PROTOCOL_VERSION,decision:a.decision,score:a.score,probability:a.probability,pressure:a.pressure,speed:a.speed,confidence:a.confidence,
      match_minute:minuteNumber(s.minute)??0,corners_before:corners,stats_source:s.statsSource,recorded_at:a.evaluatedAt,input_data:{history:m.engineHistory.map(s=>({capturedAt:s.capturedAt,minute:s.minute,
        corners:{total:total(s.corners)},shots:{total:total(s.shots)},dangerousAttacks:{total:total(s.dangerousAttacks)},statsSource:s.statsSource,quality:s.quality}))},assessment:a}];
  });
  if(!entries.length)return 0;
  const rows=await sql`INSERT INTO live_recommendations_v2(evaluation_key,event_key,fixture,competition,model_version,protocol_version,decision,score,probability,pressure,speed,confidence,match_minute,corners_before,stats_source,recorded_at,input_data,assessment)
    SELECT * FROM jsonb_to_recordset(${JSON.stringify(entries)}::jsonb) AS x(evaluation_key text,event_key text,fixture text,competition text,model_version text,protocol_version text,decision text,score int,probability int,pressure int,speed int,confidence text,match_minute int,corners_before int,stats_source text,recorded_at timestamptz,input_data jsonb,assessment jsonb)
    ON CONFLICT(evaluation_key) DO NOTHING RETURNING evaluation_key`;
  return rows.length;
}
export async function resolveRecommendations(now=Date.now()){
  await ensureLiveSchema();
  // Old pending rows cannot have reliable evidence after retention; never convert them into losses.
  await sql`UPDATE live_recommendations_v2 SET outcome_5m=CASE WHEN outcome_5m='pending' THEN 'inconclusive' ELSE outcome_5m END,outcome_10m=CASE WHEN outcome_10m='pending' THEN 'inconclusive' ELSE outcome_10m END,resolved_at=NOW(),evidence='{"reason":"expired-evidence"}'::jsonb WHERE resolved_at IS NULL AND recorded_at<NOW()-INTERVAL '24 hours'`;
  const rows=await sql`SELECT r.evaluation_key,r.recorded_at,r.corners_before,r.stats_source,r.outcome_5m,r.outcome_10m,
    COALESCE((SELECT jsonb_agg(x.snapshot_data ORDER BY x.captured_at) FROM (
      SELECT s.snapshot_data,s.captured_at FROM live_engine_snapshots s WHERE s.event_key=r.event_key AND s.captured_at>r.recorded_at AND s.captured_at<=r.recorded_at+INTERVAL '12 minutes' ORDER BY s.captured_at LIMIT 100
    ) x),'[]'::jsonb) AS samples
    FROM live_recommendations_v2 r WHERE r.resolved_at IS NULL AND r.recorded_at<=NOW()-INTERVAL '5 minutes' ORDER BY r.recorded_at LIMIT 250` as Array<{evaluation_key:string;recorded_at:string;corners_before:number;stats_source:string;outcome_5m:string;outcome_10m:string;samples:Sample[]}>;
  const updates=rows.map(r=>{
    const samples=r.samples.map(observation),start=new Date(r.recorded_at).toISOString();
    const five=resolveWindow(start,r.corners_before,r.stats_source,samples,5,now),ten=resolveWindow(start,r.corners_before,r.stats_source,samples,10,now);
    return{key:r.evaluation_key,five:r.outcome_5m==='pending'?five.outcome:r.outcome_5m,ten:r.outcome_10m==='pending'?ten.outcome:r.outcome_10m,evidence:{five,ten}};
  });
  if(updates.length)await sql`UPDATE live_recommendations_v2 r SET
    outcome_5m=CASE WHEN r.outcome_5m='pending' THEN x.five ELSE r.outcome_5m END,
    outcome_10m=CASE WHEN r.outcome_10m='pending' THEN x.ten ELSE r.outcome_10m END,
    evidence=jsonb_build_object('five',CASE WHEN r.outcome_5m='pending' THEN x.evidence->'five' ELSE r.evidence->'five' END,'ten',CASE WHEN r.outcome_10m='pending' THEN x.evidence->'ten' ELSE r.evidence->'ten' END),resolved_at=CASE WHEN x.five<>'pending' AND x.ten<>'pending' THEN NOW() ELSE NULL END
    FROM jsonb_to_recordset(${JSON.stringify(updates)}::jsonb) AS x(key text,five text,ten text,evidence jsonb)
    WHERE r.evaluation_key=x.key AND r.resolved_at IS NULL`;
  return{processed:updates.length};
}
