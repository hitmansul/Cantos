import { NextResponse } from 'next/server';
import { liveSql as sql } from '@/app/api/utils/sql';
import { MODEL_VERSION, PROTOCOL_VERSION } from '@/lib/live/intelligence';
export const dynamic='force-dynamic';
export async function GET(){
  try{
    const rows=await sql`WITH observations AS (
      SELECT r.*,ROW_NUMBER() OVER(PARTITION BY event_key,model_version,FLOOR(EXTRACT(EPOCH FROM recorded_at)/600) ORDER BY recorded_at) AS rn
      FROM live_recommendations_v2 r WHERE recorded_at>NOW()-INTERVAL '30 days' AND model_version=${MODEL_VERSION} AND protocol_version=${PROTOCOL_VERSION} AND decision='OPORTUNIDADE'
    ), cohort AS(SELECT * FROM observations WHERE rn=1)
    SELECT dimension,band,COUNT(*)::int AS samples,
      COUNT(*) FILTER(WHERE outcome_5m='hit')::int AS hits_5m,COUNT(*) FILTER(WHERE outcome_5m IN ('hit','miss'))::int AS measurable_5m,
      COUNT(*) FILTER(WHERE outcome_10m='hit')::int AS hits_10m,COUNT(*) FILTER(WHERE outcome_10m IN ('hit','miss'))::int AS measurable_10m,
      COUNT(*) FILTER(WHERE outcome_10m='inconclusive')::int AS inconclusive_10m,
      COUNT(*) FILTER(WHERE outcome_10m='pending')::int AS pending_10m,
      AVG(probability) FILTER(WHERE outcome_10m IN ('hit','miss'))::float AS predicted_percent,
      (100.0*COUNT(*) FILTER(WHERE outcome_10m='hit')/NULLIF(COUNT(*) FILTER(WHERE outcome_10m IN ('hit','miss')),0))::float AS actual_percent
    FROM cohort CROSS JOIN LATERAL(VALUES('all','all'),('probability',(FLOOR(probability/10.0)*10)::text),('score',(FLOOR(score/10.0)*10)::text),('confidence',confidence),('minute',(FLOOR(match_minute/15.0)*15)::text),('competition',COALESCE(competition,'unknown'))) d(dimension,band)
    GROUP BY dimension,band ORDER BY dimension,band`;
    return NextResponse.json({modelVersion:MODEL_VERSION,windowDays:30,sampling:'first-opportunity-per-event-per-10-minute-UTC-bucket',note:'Amostras podem ter janelas sobrepostas; não são consideradas independentes. Casos inconclusivos são excluídos das taxas. Probabilidade heurística de 10 minutos.',rows},{headers:{'Cache-Control':'public, max-age=60'}});
  }catch{return NextResponse.json({error:'Métricas ao vivo indisponíveis',rows:[]},{status:503});}
}
