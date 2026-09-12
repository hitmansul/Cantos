import { NextRequest, NextResponse } from 'next/server';
import { liveSql as sql } from '../../utils/sql';
import { randomUUID } from 'node:crypto';
import { ensureLiveSchema as ensureSchema } from '@/lib/live/schema';
import { aliases, initialKey, sameFixture } from '@/lib/live/identity';
import { assess, analyticalHistory, recentHistory, trend as buildTrend, type Assessment } from '@/lib/live/intelligence';
import { recordAssessments } from '@/lib/live/recommendations';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type LiveStatRow = { key?: string; label?: string; home?: string; away?: string };
type LiveMatch = {
  eventKey?: string;
  observedAt?: string;
  statsObservedAt?: string;
  statsSource?: string;
  assessment?: Assessment;
  id: number;
  minute: number | string;
  competition?: string;
  homeTeam: { id?: number; name: string; score: number };
  awayTeam: { id?: number; name: string; score: number };
  corners?: { home: number; away: number; total: number };
  liveStats?: LiveStatRow[];
  sourceIds?: { scores365?: number; sofascore?: number; apiFootball?: number };
  stoppage?: { totalStoppedMinutes?: number; predictedAddedMinutes?: number; incidents?: unknown[] };
  [key: string]: unknown;
};
type Pair = { home: number | null; away: number | null; total: number | null };
type Snapshot = {
  statsSource?: string; sourceObservedAt?: string; quality?: string;
  capturedAt: string; minute: number | string; minuteNumber: number | null;
  homeScore: number; awayScore: number; corners: Pair; shots: Pair; shotsOnTarget: Pair;
  dangerousAttacks: Pair; attacks: Pair; possession: Pair; totalStoppedMinutes: number | null;
  predictedAddedMinutes: number | null; stoppageIncidents: number; statsCount: number;
};
type State = { matches: LiveMatch[]; history: Record<string, Snapshot[]>; updatedAt: string | null; refreshInFlight: Promise<void> | null; coverage?: Record<string, unknown>; hydratedAt: number; persisted?: boolean; collectionError?: string; analyticsError?: string; sourceStatus?: unknown; degradedReadAt?:number };
type MatchRow = { event_key: string; match_data: LiveMatch | string; updated_at: string | Date };
type SnapshotRow = { event_key: string; snapshot_data: Snapshot | string };

const globalStore = globalThis as typeof globalThis & { __cornerGptLiveEngine?: State };
const state: State = globalStore.__cornerGptLiveEngine ?? { matches: [], history: {}, updatedAt: null, refreshInFlight: null, hydratedAt: 0 };
globalStore.__cornerGptLiveEngine = state;

const HISTORY_LIMIT = 120;
const COMPACT_HISTORY_LIMIT = 12;
const SUMMARY_HISTORY_LIMIT = 3;
const HISTORY_WINDOW_HOURS = 3;
const HYDRATE_MAX_AGE_MS = 25_000;
const REFRESH_MAX_AGE_MS = 25_000;
const ACTIVE_MATCH_MAX_AGE_MINUTES = 15;
const TREND_WINDOW_MINUTES = 10;


function parseJson<T>(value: T | string): T { return typeof value === 'string' ? JSON.parse(value) as T : value; }

function eventKey(match: LiveMatch) { return initialKey(match); }
function mergeHistories(histories: Snapshot[][], limit = HISTORY_LIMIT) {
  const merged = new Map<string, Snapshot>();
  for (const history of histories) {
    for (const item of history) {
      const key = item.capturedAt || `${item.minute}|${item.homeScore}|${item.awayScore}|${item.corners.total ?? ''}`;
      merged.set(key, item);
    }
  }
  return [...merged.values()].sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt)).slice(-limit);
}
function historyForMatch(match: LiveMatch, source: Record<string, Snapshot[]> = state.history, limit = HISTORY_LIMIT) {
  return mergeHistories([source[eventKey(match)] ?? []], limit);
}
function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function parseNumber(value: unknown) { if (typeof value === 'number') return Number.isFinite(value) ? value : null; if (value === null || value === undefined || value === '') return null; const text=String(value).replace(',', '.').trim(); if(!/^-?\d+(\.\d+)?%?$/.test(text))return null; const n = Number(text.replace('%','')); return Number.isFinite(n) ? n : null; }
function minuteNumber(value: number | string) { if (typeof value === 'number') return Number.isFinite(value) ? value : null; const m = String(value).match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/); return m ? Number(m[1]) + Number(m[2] ?? 0) : null; }
function matchQuality(match: LiveMatch) {
  return historyForMatch(match).length * 20
    + (match.corners ? 20 : 0)
    + Math.min(match.liveStats?.length ?? 0, 30) * 3
    + (match.sourceIds?.scores365 ? 5 : 0);
}
function dedupeLiveMatches(matches: LiveMatch[]) {
  const result: LiveMatch[] = [];
  for (const match of matches) {
    const index = result.findIndex(current => sameFixture(current, match));
    if (index < 0) { result.push(match); continue; }
    const current = result[index];
    const winner=matchQuality(match)>matchQuality(current)?match:current;
    result[index]={...winner,sourceIds:{...current.sourceIds,...match.sourceIds}};
  }
  return result;
}
function pair(home: number | null, away: number | null): Pair { return { home, away, total: home !== null && away !== null ? home + away : null }; }
function statPair(match: LiveMatch, aliases: string[]): Pair { const row = (match.liveStats ?? []).find(item => { const text = normalize(`${item.key ?? ''} ${item.label ?? ''}`); return aliases.some(alias => text.includes(alias)); }); return pair(parseNumber(row?.home), parseNumber(row?.away)); }

async function hydrate(force = false) {
  if (!force && Date.now() - state.hydratedAt < HYDRATE_MAX_AGE_MS) return;
  await ensureSchema();
  // One statement and one database snapshot: metadata, fixtures and histories cannot cross collection cycles.
  const [row] = await sql`SELECT c.last_success_at,c.last_error,c.source_status,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('event_key',m.event_key,'match_data',m.match_data,
      'history',COALESCE((SELECT jsonb_agg(s.snapshot_data ORDER BY s.captured_at) FROM (
        SELECT snapshot_data,captured_at FROM live_engine_snapshots WHERE event_key=m.event_key
        AND captured_at>NOW()-INTERVAL '12 minutes' ORDER BY captured_at DESC LIMIT 120
      ) s),'[]'::jsonb))) FROM live_engine_matches m
      WHERE m.updated_at>NOW()-INTERVAL '15 minutes' AND m.updated_at>=COALESCE(c.last_success_at,'-infinity'::timestamptz)), '[]'::jsonb) AS matches
    FROM live_engine_control c WHERE id=1`;
  const history: Record<string, Snapshot[]> = {};
  const matches: LiveMatch[] = (row?.matches ?? []).map((item: {event_key:string;match_data:LiveMatch;history:Snapshot[]}) => {
    history[item.event_key]=item.history;
    return {...item.match_data,eventKey:item.event_key};
  });
  state.history=history; state.matches=dedupeLiveMatches(matches);
  state.updatedAt=row?.last_success_at?new Date(row.last_success_at).toISOString():null;
  state.collectionError=row?.last_error??undefined;
  state.persisted=Boolean(state.updatedAt)&&!state.collectionError;
  state.sourceStatus=row?.source_status; state.hydratedAt=Date.now();
}

function snapshot(match: LiveMatch, capturedAt: string): Snapshot {
  return {
    statsSource:match.statsSource,sourceObservedAt:match.statsObservedAt,quality:match.statsObservedAt&&Date.parse(capturedAt)>=Date.parse(match.statsObservedAt)&&Date.parse(capturedAt)-Date.parse(match.statsObservedAt)<=90_000?'verified':'unknown',
    capturedAt, minute: match.minute, minuteNumber: minuteNumber(match.minute), homeScore: match.homeTeam.score, awayScore: match.awayTeam.score,
    corners: match.corners ? pair(match.corners.home, match.corners.away) : statPair(match, ['corner', 'escanteio']),
    shots: statPair(match, ['total shots', 'shots total', 'chutes totais', 'finalizacoes']),
    shotsOnTarget: statPair(match, ['shots on target', 'on target', 'chutes no gol', 'finalizacoes certas']),
    dangerousAttacks: statPair(match, ['dangerous attacks', 'ataques perigosos']), attacks: statPair(match, ['total attacks', 'attacks', 'ataques']),
    possession: statPair(match, ['ball possession', 'possession', 'posse de bola']), totalStoppedMinutes: parseNumber(match.stoppage?.totalStoppedMinutes),
    predictedAddedMinutes: parseNumber(match.stoppage?.predictedAddedMinutes), stoppageIncidents: Array.isArray(match.stoppage?.incidents) ? match.stoppage!.incidents!.length : 0,
    statsCount: match.liveStats?.length ?? 0,
  };
}
async function refresh(origin:string, follow:string){
  if(state.refreshInFlight)return state.refreshInFlight;
  state.refreshInFlight=(async()=>{
    await ensureSchema();
    const owner=randomUUID();
    const claimed=await sql`UPDATE live_engine_control SET owner=${owner},lease_until=NOW()+INTERVAL '55 seconds',last_attempt_at=NOW()
      WHERE id=1 AND (lease_until IS NULL OR lease_until<NOW()) AND (last_success_at IS NULL OR last_success_at<NOW()-INTERVAL '25 seconds') RETURNING id`;
    if(!claimed.length){await hydrate(true);return;}
    try{
      // Keep pending events in the monitored set independently of browser preferences.
      const pending=await sql`SELECT DISTINCT m.match_data FROM live_engine_matches m JOIN live_recommendations_v2 r ON r.event_key=m.event_key WHERE r.resolved_at IS NULL AND r.recorded_at>NOW()-INTERVAL '12 minutes'` as Array<{match_data:LiveMatch}>;
      const required=pending.flatMap(r=>aliases(parseJson(r.match_data)));
      const url=new URL('/api/live/corners-fast',origin);
      if(follow)url.searchParams.set('follow',follow);
      if(required.length)url.searchParams.set('required',required.join(','));
      const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(35_000)});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error??`Fonte indisponível: ${response.status}`);
      const raw:LiveMatch[]=Array.isArray(payload.matches)?payload.matches:[];
      const allAliases=raw.flatMap(aliases);
      const candidates=raw.map(initialKey);
      const mapped=await sql`SELECT alias,event_key FROM live_engine_aliases WHERE alias=ANY(${allAliases}::text[])
        UNION ALL SELECT '__reserved__' AS alias,event_key FROM live_engine_aliases WHERE event_key=ANY(${candidates}::text[])
        UNION ALL SELECT '__reserved__' AS alias,event_key FROM live_engine_snapshots WHERE event_key=ANY(${candidates}::text[]) GROUP BY event_key` as Array<{alias:string;event_key:string}>;
      const lookup=new Map(mapped.filter(r=>r.alias!=='__reserved__').map(r=>[r.alias,r.event_key]));
      const reserved=new Set(mapped.filter(r=>r.alias==='__reserved__').map(r=>r.event_key));
      const matches=dedupeLiveMatches(raw).map(m=>{
        const known=[...new Set(aliases(m).map(a=>lookup.get(a)).filter(Boolean))];
        if(known.length>1)throw new Error('Identidade ambígua entre fontes; coleta não persistida');
        const previous=state.matches.find(old=>sameFixture(old,m));
        const candidate=initialKey(m);
        const unusedKey=reserved.has(candidate)?(m.sourceIds?.scores365?`scores365:${m.sourceIds.scores365}`:aliases(m)[0]):candidate;
        return {...m,eventKey:known[0]??previous?.eventKey??unusedKey};
      });
      const capturedAt=new Date().toISOString();
      const items=matches.map(m=>({event_key:eventKey(m),match_data:m,snapshot_data:snapshot(m,capturedAt)}));
      const aliasRows=matches.flatMap(m=>aliases(m).map(alias=>({alias,event_key:eventKey(m)})));
      // The lease owner check fences late writers. Both writes commit atomically.
      const result=await sql.transaction(q=>[
        q`WITH lease AS (SELECT id FROM live_engine_control WHERE id=1 AND owner=${owner} AND lease_until>NOW() FOR UPDATE),
        data AS (SELECT x.* FROM jsonb_to_recordset(${JSON.stringify(items)}::jsonb) AS x(event_key text,match_data jsonb,snapshot_data jsonb),lease),
        saved AS (INSERT INTO live_engine_matches(event_key,match_data,updated_at) SELECT event_key,match_data,${capturedAt}::timestamptz FROM data
          ON CONFLICT(event_key) DO UPDATE SET match_data=EXCLUDED.match_data,updated_at=EXCLUDED.updated_at WHERE live_engine_matches.updated_at<EXCLUDED.updated_at RETURNING event_key),
        snapshots AS (INSERT INTO live_engine_snapshots(event_key,captured_at,snapshot_data)
          SELECT d.event_key,${capturedAt}::timestamptz,d.snapshot_data FROM data d JOIN saved USING(event_key)
          WHERE NOT EXISTS(SELECT 1 FROM LATERAL(SELECT snapshot_data FROM live_engine_snapshots WHERE event_key=d.event_key ORDER BY captured_at DESC LIMIT 1) old
            WHERE (old.snapshot_data-'capturedAt'-'sourceObservedAt')=(d.snapshot_data-'capturedAt'-'sourceObservedAt'))
          ON CONFLICT DO NOTHING RETURNING id),
        mapped AS (INSERT INTO live_engine_aliases(alias,event_key) SELECT a.alias,a.event_key FROM jsonb_to_recordset(${JSON.stringify(aliasRows)}::jsonb) AS a(alias text,event_key text),lease
          ON CONFLICT(alias) DO UPDATE SET updated_at=NOW() WHERE live_engine_aliases.event_key=EXCLUDED.event_key RETURNING alias)
        UPDATE live_engine_control SET last_success_at=${capturedAt}::timestamptz,last_error=NULL,source_status=${JSON.stringify(payload.sourceStatus??{})}::jsonb WHERE id IN(SELECT id FROM lease) RETURNING last_success_at`,
        q`DELETE FROM live_engine_matches m WHERE updated_at<NOW()-INTERVAL '15 minutes' AND NOT EXISTS(SELECT 1 FROM live_recommendations_v2 r WHERE r.event_key=m.event_key AND r.resolved_at IS NULL AND r.recorded_at>NOW()-INTERVAL '12 minutes')`
      ]);
      if(!result[0].length)throw new Error('Lease de coleta expirou; escrita rejeitada');
      state.coverage=payload.cornerCoverage;state.collectionError=undefined;state.persisted=true;
      await hydrate(true);
      // A failed assessment write cannot undo the committed collection.
      try{
        const evaluated=state.matches.map(m=>{const h=recentHistory(historyForMatch(m),Date.parse(capturedAt));return {...m,eventKey:eventKey(m),engineHistory:h,assessment:assess(eventKey(m),h,m.observedAt,Date.parse(capturedAt))};});
        await recordAssessments(evaluated);state.analyticsError=undefined;
      }catch(error){state.analyticsError=error instanceof Error?error.message:'Falha ao registrar avaliação';}
    }catch(error){
      state.collectionError=error instanceof Error?error.message:'Falha de coleta';state.persisted=false;
      try{await sql`UPDATE live_engine_control SET last_error=${state.collectionError} WHERE id=1 AND owner=${owner}`;}catch{}
      throw error;
    }finally{await sql`UPDATE live_engine_control SET owner=NULL,lease_until=NULL WHERE id=1 AND owner=${owner}`.catch(()=>{});}
  })().finally(()=>{state.refreshInFlight=null;});return state.refreshInFlight;
}

export async function GET(request:NextRequest){
  const historyMode=request.nextUrl.searchParams.get('history')??'summary';
  const requestedMatchId=request.nextUrl.searchParams.get('eventKey')??request.nextUrl.searchParams.get('matchId');
  const follow=(request.nextUrl.searchParams.get('follow')??'').split(',').map(Number).filter(v=>Number.isSafeInteger(v)&&v>0).slice(0,12).join(',');
  let databaseUnavailable=false;
  try{await hydrate();}catch(error){databaseUnavailable=true;state.persisted=false;state.collectionError=error instanceof Error?error.message:'Banco indisponível';}
  if(databaseUnavailable&&Date.now()-(state.degradedReadAt??0)>25_000){
    state.degradedReadAt=Date.now();
    try{const r=await fetch(new URL('/api/live/corners-fast',request.nextUrl.origin),{cache:'no-store',signal:AbortSignal.timeout(25_000)});if(r.ok){const p=await r.json();state.matches=p.matches??[];state.history={};}}catch{}
  }
  const updated=Date.parse(state.updatedAt??'');
  if(!databaseUnavailable&&(!Number.isFinite(updated)||Date.now()-updated>=REFRESH_MAX_AGE_MS)){
    try{await refresh(request.nextUrl.origin,follow);}catch(error){state.collectionError=error instanceof Error?error.message:'Coleta indisponível';}
  }
  const now=Date.now(), source=state.matches.filter(m=>!requestedMatchId||eventKey(m)===requestedMatchId||String(m.id)===requestedMatchId);
  const responseLimit=historyMode==='full'?HISTORY_LIMIT:historyMode==='compact'?COMPACT_HISTORY_LIMIT:historyMode==='0'?0:SUMMARY_HISTORY_LIMIT;
  const matches=source.map(match=>{
    const full=historyForMatch(match),history=analyticalHistory(full,now);
    const assessment=state.persisted&&!state.collectionError?assess(eventKey(match),full,match.observedAt,now):assess(eventKey(match),[],undefined,now);
    return {...match,eventKey:eventKey(match),assessment,engineHistory:responseLimit?full.slice(-responseLimit):undefined,
      engineTrend:buildTrend(history),engineUpdatedAt:match.observedAt??null,engineSnapshotCount:history.length,engineTrackedSince:history[0]?.capturedAt??null};
  });
  const healthy=Boolean(state.persisted)&&!state.collectionError&&Number.isFinite(Date.parse(state.updatedAt??''))&&now-Date.parse(state.updatedAt!)<90_000;
  return NextResponse.json({matches,count:matches.length,lastUpdated:state.updatedAt,refreshQueued:false,
    collectionConfirmed:healthy,persistenceConfirmed:healthy,error:state.collectionError??null,
    recommendationAnalytics:{ok:!state.analyticsError,error:state.analyticsError??null},
    engine:{mode:'central-persistent-neon-v2',persistence:healthy?'neon-postgresql':'degraded',refreshSeconds:25,historyLimit:HISTORY_LIMIT,compactHistoryLimit:12,summaryHistoryLimit:3,trendWindowMinutes:10,coverage:state.coverage??null}},
    {status:!healthy&&!matches.length?503:200,headers:{'Cache-Control':'no-store, max-age=0'}});
}
