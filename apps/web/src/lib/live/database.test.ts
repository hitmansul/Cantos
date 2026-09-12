// @vitest-environment node
import { beforeAll,afterAll,it,expect,vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
const context=vi.hoisted(()=>({db:null as unknown as import('@electric-sql/pglite').PGlite}));
vi.mock('@/app/api/utils/sql',()=>{
 const statement=(strings:TemplateStringsArray,params:unknown[])=>({text:strings.reduce((out,s,i)=>out+(i?'$'+i:'')+s,''),params});
 const sql=Object.assign(async(strings:TemplateStringsArray,...params:unknown[])=>{const q=statement(strings,params);return(await context.db.query(q.text,q.params)).rows;},
 {transaction:async(build:Function)=>context.db.transaction(async tx=>{const queries=build((s:TemplateStringsArray,...p:unknown[])=>statement(s,p));const results=[];for(const q of queries)results.push((await tx.query(q.text,q.params)).rows);return results;})});
 return{default:sql,liveSql:sql,isQuotaError:()=>false};
});
import { ensureLiveSchema } from './schema';
import { recordAssessments,resolveRecommendations } from './recommendations';
import { assess,type Sample } from './intelligence';
import { cleanupLiveData } from './maintenance';
import { GET as performance } from '@/app/api/live/recommendations/performance/route';
import { GET as health } from '@/app/api/live/health/route';
import { GET as central } from '@/app/api/live/central/route';
import { NextRequest } from 'next/server';
beforeAll(async()=>{context.db=new PGlite();await ensureLiveSchema();},30000);
afterAll(async()=>{vi.unstubAllGlobals();await context.db.close();});
it('persists once, resolves PostgreSQL evidence, and reports measurable outcomes',async()=>{
 const now=Date.now(),base=now-13*60000,at=(m:number)=>new Date(base+m*60000).toISOString();
 const pair=(n:number)=>({home:n,away:0,total:n});
 const h:Sample[]=Array.from({length:6},(_,i)=>({capturedAt:at(i-5),minute:60+i,minuteNumber:60+i,corners:pair(i+4),shots:pair(10+i*2),dangerousAttacks:pair(i*2),quality:'verified',statsSource:'365scores'}));
 const a=assess('42',h,at(0),base);expect(a.ready).toBe(true);
 const match={eventKey:'42',homeTeam:{name:'A'},awayTeam:{name:'B'},competition:'Liga',engineHistory:h,assessment:a};
 expect(await recordAssessments([match])).toBe(1);expect(await recordAssessments([match])).toBe(0);
 for(let i=1;i<=10;i++){const s={...h[5],capturedAt:at(i),corners:pair(i>=6?10:9)};await context.db.query('INSERT INTO live_engine_snapshots(event_key,captured_at,snapshot_data) VALUES($1,$2,$3)',['42',at(i),s]);}
 await resolveRecommendations(now);await resolveRecommendations(now);
 const {rows}=await context.db.query<any>('SELECT * FROM live_recommendations_v2');expect(rows[0].assessment).toEqual(a);expect(rows[0].corners_before).toBe(9);expect(rows[0].outcome_5m).toBe('miss');expect(rows[0].outcome_10m).toBe('hit');
 const metrics=await(await performance()).json();expect(metrics.rows.find((r:any)=>r.dimension==='all').actual_percent).toBe(100);
 await cleanupLiveData();
},30000);
it('reports idle only after a successful empty collection',async()=>{
 await context.db.query("UPDATE live_engine_control SET last_success_at=NOW()-INTERVAL '30 seconds'");
 (globalThis as any).__cornerGptLiveEngine.hydratedAt=0;
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({matches:[]}))));
 const data=await(await central(new NextRequest('https://test.invalid/api/live/central'))).json();
 expect(data.collectionConfirmed).toBe(true);expect(data.matches).toEqual([]);
 expect((await(await health()).json()).status).toBe('idle');
 await context.db.query("UPDATE live_engine_control SET last_success_at=NOW()-INTERVAL '5 minutes'");
 expect((await(await health()).json()).status).toBe('degraded-collector');
},30000);
it('executes atomic central persistence and suppresses identical snapshots',async()=>{
 (globalThis as any).__cornerGptLiveEngine.hydratedAt=0;
 const match={id:43,sourceIds:{scores365:43},source:'365scores',minute:70,homeTeam:{name:'A',score:0},awayTeam:{name:'B',score:0},observedAt:new Date().toISOString(),statsObservedAt:new Date().toISOString(),statsSource:'365scores',corners:{home:10,away:0,total:10}};
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({matches:[match]}))));
 const req=new NextRequest('https://test.invalid/api/live/central?history=compact');
 const result=await(await central(req)).json();expect(result.persistenceConfirmed,result.error).toBe(true);expect(result.matches[0].eventKey).toBe('43');
 const before=(await context.db.query<any>('SELECT COUNT(*)::int AS n FROM live_engine_snapshots')).rows[0].n;
 await context.db.query("UPDATE live_engine_control SET last_success_at=NOW()-INTERVAL '30 seconds'");
 const state=(globalThis as any).__cornerGptLiveEngine;state.hydratedAt=0;
 await central(req);
 const after=(await context.db.query<any>('SELECT COUNT(*)::int AS n FROM live_engine_snapshots')).rows[0].n;expect(after).toBe(before);
 const healthy=await(await health()).json();expect(healthy.databaseReachable).toBe(true);expect(healthy.activeMatches).toBe(1);
},30000);
