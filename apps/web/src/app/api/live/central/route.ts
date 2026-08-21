import { NextRequest, NextResponse } from 'next/server';
import sql from '../../utils/sql';

type LiveStatRow = { key?: string; label?: string; home?: string; away?: string };
type LiveMatch = {
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
  capturedAt: string; minute: number | string; minuteNumber: number | null;
  homeScore: number; awayScore: number; corners: Pair; shots: Pair; shotsOnTarget: Pair;
  dangerousAttacks: Pair; attacks: Pair; possession: Pair; totalStoppedMinutes: number | null;
  predictedAddedMinutes: number | null; stoppageIncidents: number; statsCount: number;
};
type State = { matches: LiveMatch[]; history: Record<string, Snapshot[]>; updatedAt: string | null; refreshInFlight: Promise<void> | null; coverage?: Record<string, unknown>; hydratedAt: number };
type MatchRow = { event_key: string; match_data: LiveMatch | string; updated_at: string | Date };
type SnapshotRow = { event_key: string; snapshot_data: Snapshot | string };

const globalStore = globalThis as typeof globalThis & { __cornerGptLiveEngine?: State };
const state: State = globalStore.__cornerGptLiveEngine ?? { matches: [], history: {}, updatedAt: null, refreshInFlight: null, hydratedAt: 0 };
globalStore.__cornerGptLiveEngine = state;

const HISTORY_LIMIT = 120;
const COMPACT_HISTORY_LIMIT = 12;
const SUMMARY_HISTORY_LIMIT = 3;
const HISTORY_WINDOW_HOURS = 3;
const HYDRATE_MAX_AGE_MS = 60_000;
const REFRESH_MAX_AGE_MS = 25_000;
const ACTIVE_MATCH_MAX_AGE_MINUTES = 15;
const TREND_WINDOW_MINUTES = 10;
let schemaReady: Promise<void> | null = null;

function parseJson<T>(value: T | string): T { return typeof value === 'string' ? JSON.parse(value) as T : value; }
function eventKey(match: LiveMatch) { return String(match.sourceIds?.sofascore ?? match.sourceIds?.apiFootball ?? match.sourceIds?.scores365 ?? match.id); }
function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function parseNumber(value: unknown) { if (typeof value === 'number') return Number.isFinite(value) ? value : null; if (value === null || value === undefined || value === '') return null; const n = Number(String(value).replace(',', '.').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : null; }
function minuteNumber(value: number | string) { if (typeof value === 'number') return Number.isFinite(value) ? value : null; const m = String(value).match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/); return m ? Number(m[1]) + Number(m[2] ?? 0) : null; }
function pair(home: number | null, away: number | null): Pair { return { home, away, total: home !== null && away !== null ? home + away : null }; }
function statPair(match: LiveMatch, aliases: string[]): Pair { const row = (match.liveStats ?? []).find(item => { const text = normalize(`${item.key ?? ''} ${item.label ?? ''}`); return aliases.some(alias => text.includes(alias)); }); return pair(parseNumber(row?.home), parseNumber(row?.away)); }

async function ensureSchema() {
  if (!schemaReady) schemaReady = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS live_engine_matches (event_key TEXT PRIMARY KEY, match_data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS live_engine_snapshots (id BIGSERIAL PRIMARY KEY, event_key TEXT NOT NULL, captured_at TIMESTAMPTZ NOT NULL, snapshot_data JSONB NOT NULL, UNIQUE (event_key, captured_at))`;
    await sql`CREATE INDEX IF NOT EXISTS live_engine_snapshots_event_time_idx ON live_engine_snapshots (event_key, captured_at DESC)`;
  })().catch(error => { schemaReady = null; throw error; });
  await schemaReady;
}

async function loadHistory(limit: number, requestedMatchId?: string) {
  const matchId = requestedMatchId ?? '';
  const rows = await sql`
    SELECT event_key, snapshot_data FROM (
      SELECT s.event_key, s.snapshot_data, s.captured_at, ROW_NUMBER() OVER (PARTITION BY s.event_key ORDER BY s.captured_at DESC) rn
      FROM live_engine_snapshots s INNER JOIN live_engine_matches m ON m.event_key=s.event_key
      WHERE m.updated_at > NOW() - (${ACTIVE_MATCH_MAX_AGE_MINUTES} * INTERVAL '1 minute')
        AND s.captured_at > NOW() - (${HISTORY_WINDOW_HOURS} * INTERVAL '1 hour')
        AND (${matchId}='' OR m.match_data->>'id'=${matchId})
    ) recent WHERE rn <= ${limit} ORDER BY event_key, captured_at ASC
  ` as SnapshotRow[];
  const history: Record<string, Snapshot[]> = {};
  for (const row of rows) (history[row.event_key] ??= []).push(parseJson(row.snapshot_data));
  return history;
}

async function hydrate(force = false) {
  if (!force && Date.now() - state.hydratedAt < HYDRATE_MAX_AGE_MS) return;
  await ensureSchema();
  const rows = await sql`SELECT event_key, match_data, updated_at FROM live_engine_matches WHERE updated_at > NOW() - (${ACTIVE_MATCH_MAX_AGE_MINUTES} * INTERVAL '1 minute') ORDER BY updated_at DESC` as MatchRow[];
  state.matches = rows.map(row => parseJson(row.match_data));
  state.history = await loadHistory(COMPACT_HISTORY_LIMIT);
  if (rows[0]?.updated_at) state.updatedAt = new Date(rows[0].updated_at).toISOString();
  state.hydratedAt = Date.now();
}

function snapshot(match: LiveMatch, capturedAt: string): Snapshot {
  return {
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
function pairChanged(a: Pair, b: Pair) { return a.home !== b.home || a.away !== b.away || a.total !== b.total; }
function changed(a: Snapshot | undefined, b: Snapshot) { return !a || a.minute !== b.minute || a.homeScore !== b.homeScore || a.awayScore !== b.awayScore || pairChanged(a.corners,b.corners) || pairChanged(a.shots,b.shots) || pairChanged(a.shotsOnTarget,b.shotsOnTarget) || pairChanged(a.dangerousAttacks,b.dangerousAttacks) || a.statsCount !== b.statsCount; }

async function persist(matches: LiveMatch[], capturedAt: string, pending: Array<{key:string;snapshot:Snapshot}>) {
  await Promise.all(matches.map(match => sql`INSERT INTO live_engine_matches (event_key,match_data,updated_at) VALUES (${eventKey(match)},${JSON.stringify(match)}::jsonb,${capturedAt}::timestamptz) ON CONFLICT(event_key) DO UPDATE SET match_data=EXCLUDED.match_data,updated_at=EXCLUDED.updated_at`));
  await Promise.all(pending.map(item => sql`INSERT INTO live_engine_snapshots (event_key,captured_at,snapshot_data) VALUES (${item.key},${item.snapshot.capturedAt}::timestamptz,${JSON.stringify(item.snapshot)}::jsonb) ON CONFLICT(event_key,captured_at) DO NOTHING`));
  await sql`DELETE FROM live_engine_matches WHERE updated_at <= ${capturedAt}::timestamptz - (${ACTIVE_MATCH_MAX_AGE_MINUTES} * INTERVAL '1 minute')`;
}

async function appendHistory(matches: LiveMatch[]) {
  const capturedAt = new Date().toISOString(); const pending: Array<{key:string;snapshot:Snapshot}> = [];
  for (const match of matches) { const key=eventKey(match); const history=state.history[key] ?? []; const next=snapshot(match,capturedAt); if(changed(history.at(-1),next)){ state.history[key]=[...history,next].slice(-HISTORY_LIMIT); pending.push({key,snapshot:next}); } }
  try { await persist(matches,capturedAt,pending); } catch(error) { console.warn('[live-engine] Persistência indisponível; mantendo histórico em memória.',error); }
  state.hydratedAt=Date.now();
}

function delta(a: Pair,b: Pair): Pair { const d=(x:number|null,y:number|null)=>x!==null&&y!==null?x-y:null; return pair(d(a.home,b.home),d(a.away,b.away)); }
function buildTrend(history: Snapshot[]) {
  if(history.length<2) return { windowMinutes:TREND_WINDOW_MINUTES,samples:history.length,cornersDelta:pair(null,null),shotsDelta:pair(null,null),shotsOnTargetDelta:pair(null,null),dangerousAttacksDelta:pair(null,null),scoreDelta:pair(null,null),pace:'insufficient-data',lastChangeAt:history.at(-1)?.capturedAt ?? null };
  const latest=history.at(-1)!; const lm=latest.minuteNumber; const candidates=history.filter(s=>lm===null||s.minuteNumber===null||lm-s.minuteNumber<=TREND_WINDOW_MINUTES); const base=candidates[0] ?? history[0];
  const cornersDelta=delta(latest.corners,base.corners), shotsDelta=delta(latest.shots,base.shots), shotsOnTargetDelta=delta(latest.shotsOnTarget,base.shotsOnTarget), dangerousAttacksDelta=delta(latest.dangerousAttacks,base.dangerousAttacks);
  const activity=(cornersDelta.total??0)*3+(shotsOnTargetDelta.total??0)*2+(shotsDelta.total??0)+(dangerousAttacksDelta.total??0)*0.25;
  const pace=candidates.length<2?'insufficient-data':activity>=8?'accelerating':activity<=1?'cooling':'stable';
  return { windowMinutes:TREND_WINDOW_MINUTES,samples:candidates.length,cornersDelta,shotsDelta,shotsOnTargetDelta,dangerousAttacksDelta,scoreDelta:pair(latest.homeScore-base.homeScore,latest.awayScore-base.awayScore),pace,lastChangeAt:latest.capturedAt };
}

function mergeFresh(previous: LiveMatch | undefined,current: LiveMatch): LiveMatch { return previous ? {...previous,...current,corners:current.corners??previous.corners,liveStats:current.liveStats?.length?current.liveStats:previous.liveStats} : current; }
async function refresh(origin:string, follow:string){
  if(state.refreshInFlight) return state.refreshInFlight;
  state.refreshInFlight=(async()=>{
    try{await hydrate();}catch(error){console.warn('[live-engine] Neon indisponível durante hidratação.',error);}
    const previous=new Map(state.matches.map(m=>[eventKey(m),m] as const));
    const url=new URL('/api/live/corners-fast',origin);
    if(follow) url.searchParams.set('follow',follow);
    const response=await fetch(url,{cache:'no-store'}); if(!response.ok) throw new Error(`live enrichment failed: ${response.status}`);
    const payload=await response.json() as {matches?:LiveMatch[];statisticsCoverage?:Record<string,unknown>;cornerCoverage?:Record<string,unknown>}; const raw=Array.isArray(payload.matches)?payload.matches:[]; const matches=raw.map(m=>mergeFresh(previous.get(eventKey(m)),m));
    await appendHistory(matches); state.matches=matches; state.coverage=payload.statisticsCoverage??payload.cornerCoverage; state.updatedAt=new Date().toISOString();
  })().finally(()=>{state.refreshInFlight=null;}); return state.refreshInFlight;
}

export async function GET(request:NextRequest){
  const force=request.nextUrl.searchParams.get('refresh')==='1';
  const historyMode=request.nextUrl.searchParams.get('history')??'1';
  const includeHistory=historyMode!=='0';
  const requestedMatchId=request.nextUrl.searchParams.get('matchId');
  const follow=(request.nextUrl.searchParams.get('follow')??'').split(',').map(v=>Number(v)).filter(v=>Number.isFinite(v)&&v>0).slice(0,12).join(',');
  try{await hydrate();}catch(error){console.warn('[live-engine] Neon indisponível no GET; usando coleta/memória.',error);}
  const hadCached=state.matches.length>0;
  const updatedAtMs=state.updatedAt ? Date.parse(state.updatedAt) : 0;
  const stale=!Number.isFinite(updatedAtMs) || updatedAtMs<=0 || Date.now()-updatedAtMs>=REFRESH_MAX_AGE_MS;
  if(force || !hadCached || stale){ try{await refresh(request.nextUrl.origin,follow);}catch(error){ if(!hadCached) return NextResponse.json({matches:[],error:error instanceof Error?error.message:'Falha no motor ao vivo'},{status:502}); } }
  const source=requestedMatchId?state.matches.filter(m=>String(m.id)===requestedMatchId):state.matches;
  let responseHistory=state.history;
  if(includeHistory&&historyMode==='summary') responseHistory=Object.fromEntries(Object.entries(state.history).map(([key,h])=>[key,h.slice(-SUMMARY_HISTORY_LIMIT)]));
  else if(includeHistory&&historyMode!=='compact'){try{responseHistory=await loadHistory(HISTORY_LIMIT,requestedMatchId??undefined);}catch{responseHistory=state.history;}}
  const matches=source.map(match=>{const key=eventKey(match);const history=responseHistory[key]??state.history[key]??[];return {...match,engineHistory:includeHistory?history:undefined,engineTrend:buildTrend(history),engineUpdatedAt:state.updatedAt,engineTrackedSince:history[0]?.capturedAt??null,engineSnapshotCount:history.length};});
  return NextResponse.json({matches,count:matches.length,lastUpdated:state.updatedAt,refreshQueued:false,engine:{mode:'central-persistent-neon-compact-live-set-user-follow',persistence:'neon-postgresql',refreshing:Boolean(state.refreshInFlight),refreshSeconds:REFRESH_MAX_AGE_MS/1000,refreshStrategy:'server-stale-guard',historyLimit:HISTORY_LIMIT,compactHistoryLimit:COMPACT_HISTORY_LIMIT,summaryHistoryLimit:SUMMARY_HISTORY_LIMIT,trendWindowMinutes:TREND_WINDOW_MINUTES,trackedMatches:Object.keys(state.history).length,totalSnapshots:Object.values(state.history).reduce((sum,h)=>sum+h.length,0),coverage:state.coverage??null}});
}
