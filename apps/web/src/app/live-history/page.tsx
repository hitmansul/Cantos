'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import LiveHistoryPageBase from './LiveHistoryPageBase';

type RawSnapshot = Record<string, unknown>;
type RawPair = { total: number | null };
type CatalogMatch = { id:number; minute:number|string; competition:string; homeTeam:{name:string;score:number}; awayTeam:{name:string;score:number} };

const historyCache = new Map<string, RawSnapshot[]>();
const FOLLOW_KEY='ia-cantos-followed-live-v1';
const STALE_ENGINE_MS=3*60_000;
let followRefreshPending=false;

function numeric(value:unknown){const parsed=typeof value==='number'?value:Number(value);return Number.isFinite(parsed)?parsed:null;}
function pairTotal(value:unknown):RawPair{if(!value||typeof value!=='object')return{total:null};const item=value as Record<string,unknown>;const total=numeric(item.total);if(total!==null)return{total};const home=numeric(item.home),away=numeric(item.away);return{total:home!==null&&away!==null?home+away:null};}
function minuteNumber(value:unknown){const match=String(value??'').match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/);if(!match)return 0;return Number(match[1])+Number(match[2]??0);}
function snapshotKey(snapshot:RawSnapshot){if(typeof snapshot.capturedAt==='string'&&snapshot.capturedAt)return snapshot.capturedAt;return[snapshot.minute,snapshot.homeScore,snapshot.awayScore,pairTotal(snapshot.corners).total,pairTotal(snapshot.shots).total,pairTotal(snapshot.dangerousAttacks).total].join('|');}
function mergeHistory(previous:RawSnapshot[],incoming:RawSnapshot[]){const merged=new Map<string,RawSnapshot>();for(const snapshot of[...previous,...incoming])merged.set(snapshotKey(snapshot),snapshot);return[...merged.values()].sort((a,b)=>{const left=typeof a.capturedAt==='string'?Date.parse(a.capturedAt):0;const right=typeof b.capturedAt==='string'?Date.parse(b.capturedAt):0;return(Number.isFinite(left)?left:0)-(Number.isFinite(right)?right:0);}).slice(-12);}
function delta(latest:RawSnapshot,baseline:RawSnapshot,field:'corners'|'shots'|'dangerousAttacks'){const current=pairTotal(latest[field]).total,previous=pairTotal(baseline[field]).total;return current!==null&&previous!==null?current-previous:0;}
function hasMetric(snapshot:RawSnapshot,field:'corners'|'shots'|'dangerousAttacks'){return pairTotal(snapshot[field]).total!==null;}
function capturedMs(snapshot:RawSnapshot){return typeof snapshot.capturedAt==='string'?Date.parse(snapshot.capturedAt):NaN;}

function deriveTrend(history:RawSnapshot[]){
  const empty={pace:'insufficient-data',cornersDelta:0,shotsDelta:0,dangerousAttacksDelta:0,stoppedMinutesDelta:0};
  if(history.length<3)return empty;
  const latest=history.at(-1)!;const latestMinute=minuteNumber(latest.minute);
  const candidates=history.filter(snapshot=>latestMinute-minuteNumber(snapshot.minute)<=10);
  if(candidates.length<3)return empty;
  const baseline=candidates[0]??history[0];
  const minuteSpan=Math.max(0,latestMinute-minuteNumber(baseline.minute));
  const firstMs=capturedMs(baseline),lastMs=capturedMs(latest);
  const elapsedMinutes=Number.isFinite(firstMs)&&Number.isFinite(lastMs)?Math.max(0,(lastMs-firstMs)/60000):0;
  // Evita declarar aceleração/esfriamento com apenas poucos instantes de observação.
  // Aceitamos 3 minutos de relógio da partida ou 2,5 minutos reais de coleta.
  if(minuteSpan<3&&elapsedMinutes<2.5)return empty;
  const cornersDelta=delta(latest,baseline,'corners'),shotsDelta=delta(latest,baseline,'shots'),dangerousAttacksDelta=delta(latest,baseline,'dangerousAttacks');
  const hasCorners=hasMetric(latest,'corners')&&hasMetric(baseline,'corners');
  const hasShots=hasMetric(latest,'shots')&&hasMetric(baseline,'shots');
  const hasDangerous=hasMetric(latest,'dangerousAttacks')&&hasMetric(baseline,'dangerousAttacks');
  const availableWeight=(hasCorners?3:0)+(hasShots?1:0)+(hasDangerous?0.25:0);
  if(availableWeight===0)return empty;
  const rawActivity=(hasCorners?Math.max(cornersDelta,0)*3:0)+(hasShots?Math.max(shotsDelta,0):0)+(hasDangerous?Math.max(dangerousAttacksDelta,0)*0.25:0);
  // Normaliza pela cobertura: métrica ausente não equivale a atividade zero.
  const activity=rawActivity*(4.25/availableWeight);
  const pace=activity>=8?'accelerating':activity<=1?'cooling':'stable';
  return{pace,cornersDelta,shotsDelta,dangerousAttacksDelta,stoppedMinutesDelta:0};
}
function enrichMatch(value:unknown){
  if(!value||typeof value!=='object')return value;
  const match=value as Record<string,unknown>;
  const id=String(match.id??'');
  if(!id)return match;
  const incoming=Array.isArray(match.engineHistory)?match.engineHistory.filter((item):item is RawSnapshot=>Boolean(item)&&typeof item==='object'):[];
  const history=mergeHistory(historyCache.get(id)??[],incoming);
  historyCache.set(id,history);
  const trend=deriveTrend(history);
  const updatedAt=typeof match.engineUpdatedAt==='string'?Date.parse(match.engineUpdatedAt):NaN;
  const stale=Number.isFinite(updatedAt)&&Date.now()-updatedAt>STALE_ENGINE_MS;
  return{...match,engineHistory:history,engineTrend:stale?{...trend,pace:'insufficient-data'}:trend};
}
function inputUrl(input:RequestInfo|URL){return typeof input==='string'?input:input instanceof URL?input.toString():input.url;}
function isCentralRequest(input:RequestInfo|URL){return inputUrl(input).includes('/api/live/central?');}
function centralUrl(input:RequestInfo|URL){return isCentralRequest(input)?new URL(inputUrl(input),window.location.origin):null;}
function readFollowedIds(){try{const parsed=JSON.parse(window.localStorage.getItem(FOLLOW_KEY)??'[]');return Array.isArray(parsed)?parsed.map(Number).filter(value=>Number.isFinite(value)&&value>0).slice(0,12):[];}catch{return[];}}
function writeFollowedIds(ids:number[]){window.localStorage.setItem(FOLLOW_KEY,JSON.stringify([...new Set(ids)].slice(0,12)));}
function prepareCentralRequest(input:RequestInfo|URL):RequestInfo|URL{if(!isCentralRequest(input))return input;if(typeof input!=='string'&&!(input instanceof URL))return input;const url=new URL(inputUrl(input),window.location.origin);const followed=readFollowedIds();if(followed.length)url.searchParams.set('follow',followed.join(','));else url.searchParams.delete('follow');if(followRefreshPending){url.searchParams.set('refresh','1');followRefreshPending=false;}return url;}
function textKey(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}

export default function LiveHistoryPage(){
 const[ready,setReady]=useState(false),[pageGeneration,setPageGeneration]=useState(0);const[catalog,setCatalog]=useState<CatalogMatch[]>([]),[catalogSearch,setCatalogSearch]=useState(''),[catalogError,setCatalogError]=useState<string|null>(null),[followedIds,setFollowedIds]=useState<number[]>([]);const selectedMatchIdRef=useRef<string|null>(null);
 useEffect(()=>{const initialFollowed=readFollowedIds();setFollowedIds(initialFollowed);if(initialFollowed.length)followRefreshPending=true;},[]);
 useEffect(()=>{let cancelled=false;const loadCatalog=async()=>{try{const response=await fetch(`/api/live/catalog?t=${Date.now()}`,{cache:'no-store'});const data=await response.json() as{matches?:CatalogMatch[];error?:string};if(!response.ok)throw new Error(data.error??'Falha ao carregar jogos ao vivo');if(cancelled)return;const matches=Array.isArray(data.matches)?data.matches:[];setCatalog(matches);setCatalogError(null);}catch(error){if(!cancelled)setCatalogError(error instanceof Error?error.message:'Falha ao carregar catálogo');}};void loadCatalog();const timer=window.setInterval(()=>void loadCatalog(),45_000);return()=>{cancelled=true;window.clearInterval(timer);};},[]);
 useEffect(()=>{const originalFetch=window.fetch.bind(window);const wrappedFetch:typeof window.fetch=async(input,init)=>{const effectiveInput=prepareCentralRequest(input);const requestUrl=centralUrl(effectiveInput);const requestedMatchId=requestUrl?.searchParams.get('matchId')??null;const historyMode=requestUrl?.searchParams.get('history')??null;if(requestedMatchId)selectedMatchIdRef.current=requestedMatchId;const response=await originalFetch(effectiveInput,init);if(!response.ok||!requestUrl)return response;try{const data=await response.clone().json() as Record<string,unknown>;if(!Array.isArray(data.matches))return response;if(historyMode==='summary'&&selectedMatchIdRef.current){const activeIds=new Set(data.matches.filter((item):item is Record<string,unknown>=>Boolean(item)&&typeof item==='object').map(item=>String(item.id??'')).filter(Boolean));if(!activeIds.has(selectedMatchIdRef.current)){historyCache.delete(selectedMatchIdRef.current);selectedMatchIdRef.current=null;setPageGeneration(value=>value+1);}}const enriched={...data,matches:data.matches.map(enrichMatch)};const headers=new Headers(response.headers);headers.set('content-type','application/json');headers.delete('content-length');return new Response(JSON.stringify(enriched),{status:response.status,statusText:response.statusText,headers});}catch{return response;}};window.fetch=wrappedFetch;setReady(true);return()=>{if(window.fetch===wrappedFetch)window.fetch=originalFetch;};},[]);
 const catalogResults=useMemo(()=>{const query=textKey(catalogSearch.trim());if(!query)return[];return catalog.filter(match=>textKey(`${match.homeTeam.name} ${match.awayTeam.name} ${match.competition}`).includes(query)).slice(0,20);},[catalog,catalogSearch]);
 const toggleFollow=(id:number)=>{const current=readFollowedIds();const next=current.includes(id)?current.filter(value=>value!==id):[id,...current].slice(0,12);writeFollowedIds(next);setFollowedIds(next);followRefreshPending=true;setPageGeneration(value=>value+1);};
 if(!ready)return <main className="mx-auto w-full max-w-7xl px-4 py-6 text-sm text-muted-foreground">Preparando acompanhamento ao vivo...</main>;
 return <><section className="mx-auto mt-6 w-full max-w-7xl px-4 md:px-8"><div className="rounded-2xl border border-border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold">Encontrar qualquer jogo ao vivo</h2><p className="text-xs text-muted-foreground">{catalog.length} partida(s) disponíveis · {followedIds.length} escolhida(s) para acompanhamento prioritário</p></div></div><input value={catalogSearch} onChange={event=>setCatalogSearch(event.target.value)} placeholder="Buscar time ou competição entre todos os jogos ao vivo..." className="mt-3 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-emerald-500" />{catalogError&&<p className="mt-2 text-xs text-red-300">{catalogError}</p>}{catalogSearch&&<div className="mt-3 max-h-80 space-y-2 overflow-auto">{catalogResults.map(match=>{const followed=followedIds.includes(match.id);return <div key={match.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 p-3"><div className="min-w-0"><p className="truncate text-xs text-muted-foreground">{match.competition} · {match.minute}&apos;</p><p className="truncate font-semibold">{match.homeTeam.name} x {match.awayTeam.name}</p><p className="text-xs text-muted-foreground">{match.homeTeam.score}–{match.awayTeam.score}</p></div><button type="button" onClick={()=>toggleFollow(match.id)} className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-bold ${followed?'border-emerald-500 bg-emerald-500/15 text-emerald-300':'border-border hover:bg-muted'}`}>{followed?'Acompanhando':'Acompanhar'}</button></div>;})}{catalogResults.length===0&&<p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">Nenhuma partida encontrada nessa busca.</p>}</div>}</div></section><LiveHistoryPageBase key={pageGeneration}/></>;
}
