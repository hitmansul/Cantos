'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Flag, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorldCupOddsAlerts } from '@/components/WorldCupOddsAlerts';

type Source = 'base' | 'feed' | 'slot' | 'manual';
type AnyMatch = Record<string, any>;
type MatchNode = {
  id: string;
  slot: number;
  stage: 'Fase 32' | 'Oitavas' | 'Quartas' | 'Semifinal' | 'Final' | '3º lugar';
  home: string;
  away: string;
  kickoffAt: string;
  homeScore?: number | null;
  awayScore?: number | null;
  status?: string | null;
  venue?: string | null;
  source: Source;
};

type Pair = [number, number];

const DISPLAY: Record<string, string> = {
  brazil: 'Brasil', japan: 'Japão', norway: 'Noruega', france: 'França', sweden: 'Suécia', mexico: 'México', ecuador: 'Equador', england: 'Inglaterra',
  'congo dr': 'RD Congo', belgium: 'Bélgica', senegal: 'Senegal', usa: 'EUA', 'bosnia and herzegovina': 'Bósnia e Herzegovina', spain: 'Espanha', austria: 'Áustria',
  portugal: 'Portugal', croatia: 'Croácia', switzerland: 'Suíça', algeria: 'Argélia', australia: 'Austrália', egypt: 'Egito', argentina: 'Argentina',
  'cape verde islands': 'Cabo Verde', colombia: 'Colômbia', ghana: 'Gana', canada: 'Canadá', morocco: 'Marrocos', germany: 'Alemanha', paraguay: 'Paraguai',
  netherlands: 'Holanda', tunisia: 'Tunísia', "cote d'ivoire": 'Costa do Marfim', 'cote d ivoire': 'Costa do Marfim', 'south africa': 'África do Sul', turkiye: 'Turquia',
};
const FLAGS: Record<string, string> = {
  brazil: '🇧🇷', japan: '🇯🇵', norway: '🇳🇴', france: '🇫🇷', sweden: '🇸🇪', mexico: '🇲🇽', ecuador: '🇪🇨', england: '🏴', 'congo dr': '🇨🇩', belgium: '🇧🇪',
  senegal: '🇸🇳', usa: '🇺🇸', 'bosnia and herzegovina': '🇧🇦', spain: '🇪🇸', austria: '🇦🇹', portugal: '🇵🇹', croatia: '🇭🇷', switzerland: '🇨🇭',
  algeria: '🇩🇿', australia: '🇦🇺', egypt: '🇪🇬', argentina: '🇦🇷', 'cape verde islands': '🇨🇻', colombia: '🇨🇴', ghana: '🇬🇭', canada: '🇨🇦',
  morocco: '🇲🇦', germany: '🇩🇪', paraguay: '🇵🇾', netherlands: '🇳🇱', tunisia: '🇹🇳', "cote d'ivoire": '🇨🇮', 'cote d ivoire': '🇨🇮', turkiye: '🇹🇷',
};

const F32: MatchNode[] = [
  { id:'m73', slot:73, stage:'Fase 32', home:'Brazil', away:'Japan', kickoffAt:'2026-06-30T17:00:00.000Z', homeScore:2, awayScore:1, status:'Fim', source:'base' },
  { id:'m74', slot:74, stage:'Fase 32', home:"Cote d'Ivoire", away:'Norway', kickoffAt:'2026-06-30T20:00:00.000Z', homeScore:1, awayScore:2, status:'Fim', source:'base' },
  { id:'m75', slot:75, stage:'Fase 32', home:'France', away:'Sweden', kickoffAt:'2026-06-30T21:00:00.000Z', homeScore:3, awayScore:0, status:'Fim', source:'base' },
  { id:'m76', slot:76, stage:'Fase 32', home:'Mexico', away:'Ecuador', kickoffAt:'2026-07-01T01:00:00.000Z', homeScore:2, awayScore:0, status:'Fim', source:'base' },
  { id:'m77', slot:77, stage:'Fase 32', home:'England', away:'Congo DR', kickoffAt:'2026-07-01T16:00:00.000Z', homeScore:2, awayScore:1, status:'Fim', source:'base' },
  { id:'m78', slot:78, stage:'Fase 32', home:'Belgium', away:'Senegal', kickoffAt:'2026-07-01T20:00:00.000Z', homeScore:3, awayScore:2, status:'Fim', source:'base' },
  { id:'m79', slot:79, stage:'Fase 32', home:'USA', away:'Bosnia and Herzegovina', kickoffAt:'2026-07-02T00:00:00.000Z', homeScore:2, awayScore:0, status:'Fim', source:'base' },
  { id:'m80', slot:80, stage:'Fase 32', home:'Spain', away:'Austria', kickoffAt:'2026-07-02T16:00:00.000Z', homeScore:3, awayScore:0, status:'Fim', source:'base' },
  { id:'m81', slot:81, stage:'Fase 32', home:'Portugal', away:'Croatia', kickoffAt:'2026-07-02T20:00:00.000Z', homeScore:2, awayScore:1, status:'Fim', source:'base' },
  { id:'m82', slot:82, stage:'Fase 32', home:'Switzerland', away:'Algeria', kickoffAt:'2026-07-03T00:00:00.000Z', homeScore:2, awayScore:0, status:'Fim', source:'base' },
  { id:'m83', slot:83, stage:'Fase 32', home:'Australia', away:'Egypt', kickoffAt:'2026-07-03T16:00:00.000Z', status:'Fim', source:'base' },
  { id:'m84', slot:84, stage:'Fase 32', home:'Argentina', away:'Cape Verde Islands', kickoffAt:'2026-07-03T20:00:00.000Z', homeScore:3, awayScore:2, status:'Fim', source:'base' },
  { id:'m85', slot:85, stage:'Fase 32', home:'Colombia', away:'Ghana', kickoffAt:'2026-07-04T00:00:00.000Z', status:'Fim', source:'base' },
  { id:'m86', slot:86, stage:'Fase 32', home:'Canada', away:'Morocco', kickoffAt:'2026-07-04T16:00:00.000Z', status:'Fim', source:'base' },
  { id:'m87', slot:87, stage:'Fase 32', home:'Germany', away:'Paraguay', kickoffAt:'2026-07-04T20:00:00.000Z', status:'Programado', source:'base' },
  { id:'m88', slot:88, stage:'Fase 32', home:'Netherlands', away:'Tunisia', kickoffAt:'2026-07-05T00:00:00.000Z', status:'Programado', source:'base' },
];

const MANUAL_WINNERS: Record<number, string> = { 83:'Egypt', 85:'Colombia', 86:'Morocco' };
const R16_SOURCE_PAIRS: Pair[] = [[73,74],[76,77],[79,78],[81,80],[75,82],[83,84],[85,86],[87,88]];
const R16_TIMES = ['2026-07-05T16:00:00.000Z','2026-07-05T20:00:00.000Z','2026-07-06T00:00:00.000Z','2026-07-06T16:00:00.000Z','2026-07-06T20:00:00.000Z','2026-07-07T00:00:00.000Z','2026-07-07T16:00:00.000Z','2026-07-07T20:00:00.000Z'];
const QF_TIMES = ['2026-07-09T20:00:00.000Z','2026-07-10T00:00:00.000Z','2026-07-10T20:00:00.000Z','2026-07-11T00:00:00.000Z'];
const SF_TIMES = ['2026-07-14T20:00:00.000Z','2026-07-15T20:00:00.000Z'];

function norm(v: unknown) { return String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(); }
function key(v: unknown) { const k=norm(v); if(['eua','united states','estados unidos'].includes(k)) return 'usa'; if(['rd congo','dr congo'].includes(k)) return 'congo dr'; if(['costa do marfim','ivory coast','cote d ivoire'].includes(k)) return "cote d'ivoire"; if(k==='holanda')return'netherlands'; if(k==='suica')return'switzerland'; if(k==='argelia')return'algeria'; if(k==='egito')return'egypt'; if(k==='espanha')return'spain'; if(k==='alemanha')return'germany'; if(k==='turquia')return'turkiye'; if(k==='cabo verde')return'cape verde islands'; return k; }
function display(v: unknown) { const k=key(v); return DISPLAY[k] ?? String(v ?? 'A definir'); }
function flag(v: unknown) { const k=key(v); if(String(v).startsWith('Vencedor') || String(v).startsWith('Perdedor')) return '🏳️'; return FLAGS[k] ?? '🏳️'; }
function fmtDate(v?: string | null) { if(!v)return'--'; const d=new Date(v); if(Number.isNaN(d.getTime()))return'--'; return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d); }
function num(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function unordered(a: string, b: string) { return [key(a), key(b)].sort().join('|'); }
function isFinished(m: MatchNode) { const s=norm(m.status); return typeof m.homeScore==='number' && typeof m.awayScore==='number' || ['fim','finished','final','ft','encerrado','pos prorrogacao','pos penaltis'].some(x=>s.includes(x)) || Boolean(MANUAL_WINNERS[m.slot]); }
function winnerOf(m?: MatchNode) { if(!m) return null; if(MANUAL_WINNERS[m.slot]) return MANUAL_WINNERS[m.slot]; if(typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number' || m.homeScore === m.awayScore) return null; return m.homeScore > m.awayScore ? m.home : m.away; }
function loserOf(m?: MatchNode) { if(!m) return null; const w = winnerOf(m); if(!w) return null; return key(w) === key(m.home) ? m.away : m.home; }
function readHome(m:AnyMatch){ return m.homeTeamName??m.home_team_name??m.homeTeam?.name??m.home?.name??m.teams?.home?.name??m.home??''; }
function readAway(m:AnyMatch){ return m.awayTeamName??m.away_team_name??m.awayTeam?.name??m.away?.name??m.teams?.away?.name??m.away??''; }
function readHomeScore(m:AnyMatch){ return num(m.homeScore??m.home_score??m.homeTeam?.score??m.home?.score??m.goals?.home??m.score?.home); }
function readAwayScore(m:AnyMatch){ return num(m.awayScore??m.away_score??m.awayTeam?.score??m.away?.score??m.goals?.away??m.score?.away); }
function rows(payload:unknown):AnyMatch[]{ if(!payload||typeof payload!=='object')return[]; const o=payload as Record<string,any>; return [o.matches,o.items,o.results,o.fixtures,o.response,o.data].flatMap(v=>Array.isArray(v)?v:[]); }
function toFeed(m:AnyMatch): Partial<MatchNode> | null { const home=String(readHome(m)||'').trim(); const away=String(readAway(m)||'').trim(); if(!home||!away)return null; return { home, away, kickoffAt:String(m.kickoffAt??m.startTime??m.date??m.fixture?.date??''), homeScore:readHomeScore(m), awayScore:readAwayScore(m), status:String(m.status??m.statusText??m.fixture?.status?.long??''), venue:String(m.venue??m.stadium??m.fixture?.venue?.name??''), source:'feed' }; }
function mergeSlot(base: MatchNode, feed: Partial<MatchNode> | undefined): MatchNode { if(!feed) return base; return { ...base, ...feed, id:base.id, slot:base.slot, stage:base.stage, kickoffAt:feed.kickoffAt || base.kickoffAt, source:'feed' }; }
function mergeKnown(base: MatchNode[], feedRows: Partial<MatchNode>[]) { const used = new Set<number>(); return base.map(slot => { const idx = feedRows.findIndex((m,i)=>!used.has(i)&&m.home&&m.away&&unordered(m.home,m.away)===unordered(slot.home,slot.away)); if(idx<0) return slot; used.add(idx); return mergeSlot(slot, feedRows[idx]); }); }
function makeNode(stage: MatchNode['stage'], index: number, home: string | null, away: string | null, kickoffAt: string, source: Source = 'slot'): MatchNode { return { id:`${stage}-${index}`, slot:index, stage, home:home ?? `Vencedor ${stage} ${index}`, away:away ?? `Vencedor ${stage} ${index}`, kickoffAt, source }; }
function makeNext(stage: MatchNode['stage'], pairs: Pair[], previous: MatchNode[], times: string[], labelsFrom: string): MatchNode[] { return pairs.map(([a,b],i)=>makeNode(stage, i+1, winnerOf(previous[a-1]) ?? `Vencedor ${labelsFrom} ${a}`, winnerOf(previous[b-1]) ?? `Vencedor ${labelsFrom} ${b}`, times[i])); }
function promoteOfficial(slots: MatchNode[], feedRows: Partial<MatchNode>[], from: string, to: string) { const start=Date.parse(from); const end=Date.parse(to); const candidates = feedRows.filter(m=>{ const t=Date.parse(m.kickoffAt||''); return Number.isFinite(t)&&t>=start&&t<=end&&m.home&&m.away; }); const used=new Set<number>(); return slots.map(slot=>{ const idx=candidates.findIndex((m,j)=>!used.has(j)&&m.home&&m.away&&unordered(m.home,m.away)===unordered(slot.home,slot.away)); if(idx<0) return slot; used.add(idx); return mergeSlot(slot,candidates[idx]); }); }

function Team({ team, score, winner }: { team: string; score?: number | null; winner?: boolean }) { return <div className={`flex min-h-[34px] items-center justify-between gap-2 rounded-xl border px-3 py-2 ${winner ? 'border-emerald-400/70 bg-emerald-500/20 text-white' : 'border-white/10 bg-slate-950/75'}`}><span className="truncate">{flag(team)} {display(team)}</span>{typeof score === 'number' && <b>{score}</b>}</div>; }
function Node({ match }: { match: MatchNode }) { const w = winnerOf(match); const pending = !isFinished(match) || !w; return <div className={`relative min-w-[230px] rounded-2xl border p-3 shadow-lg ${pending ? 'border-amber-400/35 bg-slate-950/85' : 'border-emerald-400/45 bg-slate-950/90'}`}><div className="mb-2 flex items-center justify-between gap-2"><b className="text-xs uppercase tracking-wide text-emerald-300">{match.stage} {match.slot}</b><span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300">{fmtDate(match.kickoffAt)}</span></div><div className="space-y-2"><Team team={match.home} score={match.homeScore} winner={w !== null && key(w) === key(match.home)} /><Team team={match.away} score={match.awayScore} winner={w !== null && key(w) === key(match.away)} /></div><div className="mt-2 flex flex-wrap gap-1">{typeof match.homeScore==='number'&&typeof match.awayScore==='number'&&<Badge className="bg-emerald-500/20 text-emerald-200 text-[10px]">{match.homeScore} x {match.awayScore}</Badge>}<Badge className={`text-[10px] ${pending?'bg-amber-500/20 text-amber-200':'bg-emerald-500/20 text-emerald-200'}`}>{pending?'pendente':'oficial'}</Badge>{match.venue&&<Badge variant="outline" className="text-[10px]">{match.venue}</Badge>}</div></div>; }
function Column({ title, matches }: { title: string; matches: MatchNode[] }) { return <div><div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-black uppercase tracking-wide text-emerald-300">{title}<span className="ml-2 text-xs font-normal text-slate-400">{matches.length} jogos</span></div><div className="space-y-5">{matches.map(m=><Node key={m.id} match={m}/>)}</div></div>; }
function Bracket({ f32, r16, qf, sf, final, third }: { f32: MatchNode[]; r16: MatchNode[]; qf: MatchNode[]; sf: MatchNode[]; final: MatchNode; third: MatchNode }) { return <Card className="overflow-hidden border-emerald-500/20 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,.22),_rgba(2,6,23,.96)_38%,_rgba(2,6,23,1)_72%)]"><div className="p-8 text-center"><h2 className="text-4xl font-black text-amber-300 md:text-5xl">CAMINHO ATÉ A FINAL</h2><p className="mt-2 text-sm text-emerald-100">Slots travados: cada vencedor entra apenas no confronto oficial seguinte.</p></div><div className="overflow-x-auto"><div className="grid min-w-[1780px] grid-cols-[1.1fr_1.1fr_1fr_.95fr_.9fr] gap-6 px-7 pb-8"><Column title="Fase 32" matches={f32}/><Column title="Oitavas" matches={r16}/><Column title="Quartas" matches={qf}/><Column title="Semifinais" matches={sf}/><div><div className="mb-8 flex justify-center"><div className="rounded-full border border-amber-400/40 bg-amber-500/10 p-8 text-center"><div className="text-6xl">🏆</div><div className="mt-2 font-black tracking-[.35em] text-amber-200">FINAL</div></div></div><Node match={final}/><div className="mt-6"><Node match={third}/></div></div></div></div></Card>; }
function ResultCard({ m }: { m: MatchNode }) { const w=winnerOf(m); return <Card className="border-emerald-500/15 bg-background/70 p-4"><div className="text-xs text-muted-foreground">{m.stage} {m.slot} • {fmtDate(m.kickoffAt)}</div><div className="mt-1 text-lg font-semibold">{flag(m.home)} {display(m.home)} {m.homeScore ?? '—'} x {m.awayScore ?? '—'} {flag(m.away)} {display(m.away)}</div>{w&&<Badge className="mt-2 bg-emerald-500/20 text-emerald-300">Classificado: {display(w)}</Badge>}</Card>; }
function StatsPanel({ all }: { all: MatchNode[] }) { const finished = all.filter(isFinished); const goals = finished.reduce((s,m)=>s+(m.homeScore??0)+(m.awayScore??0),0); const decided = finished.filter(winnerOf).length; const teamWins = new Map<string,number>(); finished.forEach(m=>{ const w=winnerOf(m); if(w) teamWins.set(display(w),(teamWins.get(display(w))??0)+1); }); const leaders=[...teamWins.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6); return <div className="grid gap-4 md:grid-cols-3"><Card className="p-4"><BarChart3 className="mb-2 h-5 w-5 text-emerald-400"/><p className="text-sm text-muted-foreground">Jogos encerrados</p><b className="text-3xl">{finished.length}</b></Card><Card className="p-4"><Flag className="mb-2 h-5 w-5 text-amber-400"/><p className="text-sm text-muted-foreground">Gols computados</p><b className="text-3xl">{goals}</b></Card><Card className="p-4"><ShieldCheck className="mb-2 h-5 w-5 text-cyan-400"/><p className="text-sm text-muted-foreground">Classificações definidas</p><b className="text-3xl">{decided}</b></Card><Card className="md:col-span-3 p-4"><h3 className="mb-3 font-bold">Seleções com mais vitórias no mata-mata</h3><div className="grid gap-2 md:grid-cols-3">{leaders.map(([t,n])=><div key={t} className="rounded-lg border bg-muted/30 p-3"><b>{t}</b><p className="text-sm text-muted-foreground">{n} vitória(s)</p></div>)}</div></Card></div>; }

export function WorldCupPage(){
  const [feed,setFeed]=useState<Partial<MatchNode>[]>([]); const [loading,setLoading]=useState(false); const [tab,setTab]=useState('mata-mata'); const [last,setLast]=useState<string|null>(null);
  async function load(){ setLoading(true); try{ const urls=['/api/365scores/results/copa_do_mundo','/api/world-cup/persistent-summary','/api/world-cup/matches','/api/world-cup/results']; const res=await Promise.allSettled(urls.map(u=>fetch(u,{cache:'no-store'}).then(r=>r.ok?r.json():null))); setFeed(res.flatMap(r=>r.status==='fulfilled'?rows(r.value):[]).map(toFeed).filter(Boolean) as Partial<MatchNode>[]); setLast(new Date().toISOString()); } finally{ setLoading(false); } }
  useEffect(()=>{ load(); },[]);
  const bracket=useMemo(()=>{ const f32=mergeKnown(F32,feed); const r16Base = R16_SOURCE_PAIRS.map(([a,b],i)=>makeNode('Oitavas',i+1,winnerOf(f32.find(m=>m.slot===a))??`Vencedor Jogo ${a}`,winnerOf(f32.find(m=>m.slot===b))??`Vencedor Jogo ${b}`,R16_TIMES[i])); const r16=promoteOfficial(r16Base,feed,'2026-07-05T12:00:00.000Z','2026-07-08T03:30:00.000Z'); const qfBase=makeNext('Quartas',[[1,2],[3,4],[5,6],[7,8]],r16,QF_TIMES,'Oitavas'); const qf=promoteOfficial(qfBase,feed,'2026-07-09T12:00:00.000Z','2026-07-12T03:30:00.000Z'); const sfBase=makeNext('Semifinal',[[1,2],[3,4]],qf,SF_TIMES,'Quartas'); const sf=promoteOfficial(sfBase,feed,'2026-07-14T12:00:00.000Z','2026-07-16T23:59:00.000Z'); const finalBase=makeNode('Final',1,winnerOf(sf[0])??'Vencedor Semifinal 1',winnerOf(sf[1])??'Vencedor Semifinal 2','2026-07-19T19:00:00.000Z'); const third=makeNode('3º lugar',1,loserOf(sf[0])??'Perdedor Semifinal 1',loserOf(sf[1])??'Perdedor Semifinal 2','2026-07-18T19:00:00.000Z'); const final=promoteOfficial([finalBase],feed,'2026-07-18T12:00:00.000Z','2026-07-20T23:59:00.000Z')[0] ?? finalBase; return {f32,r16,qf,sf,final,third,all:[...f32,...r16,...qf,...sf,final,third]}; },[feed]);
  const finishedRows = useMemo(()=>bracket.all.filter(isFinished).sort((a,b)=>Date.parse(b.kickoffAt)-Date.parse(a.kickoffAt)),[bracket.all]);
  return <div className="space-y-6"><Card className="border-emerald-500/30 bg-gradient-to-br from-green-950 via-emerald-900 to-teal-950 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold text-white">🏆 Copa do Mundo 2026</h2><p className="text-sm text-emerald-200">Mata-mata reconstruído com slots oficiais fixos, sem pular fase e sem final antecipada.</p></div><div className="text-right"><div className="text-xs text-emerald-100">Atualizado: {fmtDate(last)}</div><Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?'animate-spin':''}`}/>Atualizar</Button></div></div></Card><Tabs value={tab} onValueChange={setTab}><TabsList className="grid w-full grid-cols-4"><TabsTrigger value="mata-mata">Mata-mata</TabsTrigger><TabsTrigger value="estatisticas">Estatísticas</TabsTrigger><TabsTrigger value="resultados">Resultados</TabsTrigger><TabsTrigger value="odds">Odds</TabsTrigger></TabsList><TabsContent value="mata-mata"><Bracket {...bracket}/></TabsContent><TabsContent value="estatisticas"><StatsPanel all={bracket.all}/></TabsContent><TabsContent value="resultados" className="space-y-3">{finishedRows.map(m=><ResultCard key={`${m.stage}-${m.slot}`} m={m}/>)}</TabsContent><TabsContent value="odds"><WorldCupOddsAlerts/></TabsContent></Tabs></div>;
}

export default WorldCupPage;
