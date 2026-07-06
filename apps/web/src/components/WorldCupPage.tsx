'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorldCupOddsAlerts } from '@/components/WorldCupOddsAlerts';

type ApiMatch = { id?: number | string; startTime?: string | null; roundName?: string | null; statusText?: string | null; statusId?: number; status?: number; homeTeam?: { name?: string; score?: number | null }; awayTeam?: { name?: string; score?: number | null } };
type PersistentMatch = { id: number | string; homeTeamName: string; awayTeamName: string; homeScore: number | null; awayScore: number | null; kickoffAt: string | null; roundName: string | null; stage?: string | null; status?: string | null };
type BracketMatch = { label: string; home: string; away: string; kickoffAt: string; homeScore?: number | null; awayScore?: number | null; status?: string | null; stageText?: string | null; source?: 'base' | 'oficial' | 'placeholder'; winnerOverride?: string | null };

type Pair = [number, number];

const DISPLAY: Record<string, string> = {
  brazil: 'Brasil', japan: 'Japão', norway: 'Noruega', france: 'França', sweden: 'Suécia', mexico: 'México', ecuador: 'Equador', england: 'Inglaterra', 'congo dr': 'RD Congo', belgium: 'Bélgica', senegal: 'Senegal', usa: 'EUA', 'bosnia and herzegovina': 'Bósnia e Herzegovina', spain: 'Espanha', austria: 'Áustria', portugal: 'Portugal', croatia: 'Croácia', switzerland: 'Suíça', algeria: 'Argélia', australia: 'Austrália', egypt: 'Egito', argentina: 'Argentina', 'cape verde islands': 'Cabo Verde', colombia: 'Colômbia', ghana: 'Gana', canada: 'Canadá', morocco: 'Marrocos', germany: 'Alemanha', paraguay: 'Paraguai', netherlands: 'Holanda', 'cote d ivoire': 'Costa do Marfim', 'cote d\'ivoire': 'Costa do Marfim', 'south africa': 'África do Sul', turkiye: 'Turquia', tunisia: 'Tunísia'
};
const FLAGS: Record<string, string> = {
  brazil: '🇧🇷', japan: '🇯🇵', norway: '🇳🇴', france: '🇫🇷', sweden: '🇸🇪', mexico: '🇲🇽', ecuador: '🇪🇨', england: '🏴', 'congo dr': '🇨🇩', belgium: '🇧🇪', senegal: '🇸🇳', usa: '🇺🇸', 'bosnia and herzegovina': '🇧🇦', spain: '🇪🇸', austria: '🇦🇹', portugal: '🇵🇹', croatia: '🇭🇷', switzerland: '🇨🇭', algeria: '🇩🇿', australia: '🇦🇺', egypt: '🇪🇬', argentina: '🇦🇷', 'cape verde islands': '🇨🇻', colombia: '🇨🇴', ghana: '🇬🇭', canada: '🇨🇦', morocco: '🇲🇦', germany: '🇩🇪', paraguay: '🇵🇾', netherlands: '🇳🇱', 'cote d ivoire': '🇨🇮', 'cote d\'ivoire': '🇨🇮', 'south africa': '🇿🇦', turkiye: '🇹🇷', tunisia: '🇹🇳'
};

const F32_BASE: BracketMatch[] = [
  { label: 'Jogo 73', home: 'Brazil', away: 'Japan', kickoffAt: '2026-06-30T17:00:00.000Z', homeScore: 2, awayScore: 1, source: 'base' },
  { label: 'Jogo 74', home: "Cote d'Ivoire", away: 'Norway', kickoffAt: '2026-06-30T20:00:00.000Z', homeScore: 1, awayScore: 2, source: 'base' },
  { label: 'Jogo 75', home: 'France', away: 'Sweden', kickoffAt: '2026-06-30T21:00:00.000Z', homeScore: 3, awayScore: 0, source: 'base' },
  { label: 'Jogo 76', home: 'Mexico', away: 'Ecuador', kickoffAt: '2026-07-01T01:00:00.000Z', homeScore: 2, awayScore: 0, source: 'base' },
  { label: 'Jogo 77', home: 'England', away: 'Congo DR', kickoffAt: '2026-07-01T16:00:00.000Z', homeScore: 2, awayScore: 1, source: 'base' },
  { label: 'Jogo 78', home: 'Belgium', away: 'Senegal', kickoffAt: '2026-07-01T20:00:00.000Z', homeScore: 3, awayScore: 2, source: 'base' },
  { label: 'Jogo 79', home: 'USA', away: 'Bosnia and Herzegovina', kickoffAt: '2026-07-02T00:00:00.000Z', homeScore: 2, awayScore: 0, source: 'base' },
  { label: 'Jogo 80', home: 'Spain', away: 'Austria', kickoffAt: '2026-07-02T16:00:00.000Z', homeScore: 3, awayScore: 0, source: 'base' },
  { label: 'Jogo 81', home: 'Portugal', away: 'Croatia', kickoffAt: '2026-07-02T20:00:00.000Z', homeScore: 2, awayScore: 1, source: 'base' },
  { label: 'Jogo 82', home: 'Switzerland', away: 'Algeria', kickoffAt: '2026-07-03T00:00:00.000Z', homeScore: 2, awayScore: 0, source: 'base' },
  { label: 'Jogo 83', home: 'Australia', away: 'Egypt', kickoffAt: '2026-07-03T16:00:00.000Z', source: 'base', winnerOverride: 'Egypt' },
  { label: 'Jogo 84', home: 'Argentina', away: 'Cape Verde Islands', kickoffAt: '2026-07-03T20:00:00.000Z', homeScore: 3, awayScore: 2, source: 'base' },
  { label: 'Jogo 85', home: 'Colombia', away: 'Ghana', kickoffAt: '2026-07-04T00:00:00.000Z', source: 'base', winnerOverride: 'Colombia' },
  { label: 'Jogo 86', home: 'Canada', away: 'Morocco', kickoffAt: '2026-07-04T16:00:00.000Z', source: 'base', winnerOverride: 'Morocco' },
  { label: 'Jogo 87', home: 'Germany', away: 'Paraguay', kickoffAt: '2026-07-04T20:00:00.000Z', source: 'placeholder' },
  { label: 'Jogo 88', home: 'Netherlands', away: 'Tunisia', kickoffAt: '2026-07-05T00:00:00.000Z', source: 'placeholder' },
];

// Ordem corrigida do chaveamento: Portugal cruza com Espanha, não com Suíça.
const R16_PAIRS: Pair[] = [[0, 1], [2, 3], [4, 5], [6, 9], [7, 8], [10, 11], [12, 13], [14, 15]];
const R16_TIMES = ['2026-07-05T16:00:00.000Z', '2026-07-05T20:00:00.000Z', '2026-07-06T00:00:00.000Z', '2026-07-06T16:00:00.000Z', '2026-07-06T20:00:00.000Z', '2026-07-07T00:00:00.000Z', '2026-07-07T16:00:00.000Z', '2026-07-07T20:00:00.000Z'];
const QF_TIMES = ['2026-07-09T20:00:00.000Z', '2026-07-10T00:00:00.000Z', '2026-07-10T20:00:00.000Z', '2026-07-11T00:00:00.000Z'];
const SF_TIMES = ['2026-07-14T20:00:00.000Z', '2026-07-15T20:00:00.000Z'];

function norm(v: unknown) { return String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function key(v: unknown) { const k = norm(v); if (k === 'eua' || k === 'united states') return 'usa'; if (k === 'rd congo' || k === 'dr congo') return 'congo dr'; if (k === 'costa do marfim' || k === 'ivory coast' || k === 'cote d ivoire') return 'cote d ivoire'; if (k === 'holanda') return 'netherlands'; if (k === 'suica') return 'switzerland'; if (k === 'argelia') return 'algeria'; if (k === 'egito') return 'egypt'; if (k === 'espanha') return 'spain'; if (k === 'alemanha') return 'germany'; if (k === 'turquia') return 'turkiye'; if (k === 'cabo verde') return 'cape verde islands'; return k; }
function name(v: unknown) { return DISPLAY[key(v)] ?? String(v ?? ''); }
function flag(v: unknown) { return FLAGS[key(v)] ?? '🏳️'; }
function fmtDate(v?: string | null) { if (!v) return '--'; const d = new Date(v); if (Number.isNaN(d.getTime())) return '--'; return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d); }
function unorderedKey(a: string, b: string) { return [key(a), key(b)].sort().join('|'); }
function stageOf(m: BracketMatch) { const s = norm(`${m.stageText ?? ''} ${m.label}`); if (s.includes('semi')) return 'sf'; if (s.includes('quarta') || s.includes('quarter')) return 'qf'; if (s.includes('oitava') || s.includes('round of 16')) return 'r16'; if (s.includes('32')) return 'f32'; if (s.includes('final')) return 'final'; return ''; }
function winnerOf(m?: BracketMatch) { if (!m) return null; if (m.winnerOverride) return m.winnerOverride; if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number' || m.homeScore === m.awayScore) return null; return m.homeScore > m.awayScore ? m.home : m.away; }
function finishedStatus(m: BracketMatch) { const s = norm(m.status); return typeof m.homeScore === 'number' || Boolean(m.winnerOverride) || ['fim', 'finished', 'final', 'ft', 'encerrado'].some(x => s.includes(x)); }
function byTime(a: BracketMatch, b: BracketMatch) { return Date.parse(a.kickoffAt || '9999-12-31') - Date.parse(b.kickoffAt || '9999-12-31'); }
function toPersistent(m: PersistentMatch): BracketMatch { return { label: 'Jogo', home: m.homeTeamName, away: m.awayTeamName, kickoffAt: m.kickoffAt ?? '', homeScore: m.homeScore, awayScore: m.awayScore, status: m.status, source: 'oficial', stageText: `${m.roundName ?? ''} ${m.stage ?? ''}` }; }
function toApi(m: ApiMatch): BracketMatch { return { label: 'Jogo', home: m.homeTeam?.name ?? '', away: m.awayTeam?.name ?? '', kickoffAt: m.startTime ?? '', homeScore: m.homeTeam?.score ?? null, awayScore: m.awayTeam?.score ?? null, status: m.statusText, source: 'oficial', stageText: m.roundName ?? '' }; }
function mergeF32(official: BracketMatch[]) { const used = new Set<number>(); return F32_BASE.map(slot => { const idx = official.findIndex((m, i) => !used.has(i) && unorderedKey(m.home, m.away) === unorderedKey(slot.home, slot.away)); if (idx < 0) return slot; used.add(idx); const actual = official[idx]; return { ...slot, ...actual, label: slot.label, kickoffAt: actual.kickoffAt || slot.kickoffAt, winnerOverride: winnerOf(actual) ? null : slot.winnerOverride, source: 'oficial' as const }; }); }
function makeRound(prev: BracketMatch[], pairs: Pair[], labels: string[], times: string[]) { return pairs.map(([a, b], i) => ({ label: labels[i], home: winnerOf(prev[a]) ?? `Vencedor ${prev[a].label}`, away: winnerOf(prev[b]) ?? `Vencedor ${prev[b].label}`, kickoffAt: times[i], source: 'placeholder' as const })); }
function mergeRound(slots: BracketMatch[], official: BracketMatch[], stage: 'r16' | 'qf' | 'sf' | 'final') { const byStage = official.filter(m => stageOf(m) === stage).sort(byTime); const used = new Set<number>(); return slots.map((slot, i) => { let idx = byStage.findIndex((m, j) => !used.has(j) && unorderedKey(m.home, m.away) === unorderedKey(slot.home, slot.away)); if (idx < 0 && byStage[i] && !used.has(i)) idx = i; if (idx < 0) return slot; used.add(idx); const actual = byStage[idx]; return { ...slot, ...actual, label: slot.label, kickoffAt: actual.kickoffAt || slot.kickoffAt, source: 'oficial' as const }; }); }

function TeamLine({ team, score, win }: { team: string; score?: number | null; win?: boolean }) { return <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${win ? 'border-emerald-400/60 bg-emerald-500/15' : 'border-white/10 bg-slate-950/70'}`}><span className="truncate">{flag(team)} {name(team)}</span>{typeof score === 'number' && <b>{score}</b>}</div>; }
function Node({ m }: { m: BracketMatch }) { const w = winnerOf(m); const pending = !finishedStatus(m) && (!w || m.home.startsWith('Vencedor') || m.away.startsWith('Vencedor')); return <div className={`min-w-[220px] rounded-2xl border bg-slate-950/85 p-3 ${pending ? 'border-amber-400/35' : 'border-emerald-400/40'}`}><div className="mb-2 flex items-center justify-between gap-2"><b className="text-xs uppercase text-emerald-300">{m.label}</b><span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300">{fmtDate(m.kickoffAt)}</span></div><div className="space-y-2"><TeamLine team={m.home} score={m.homeScore} win={w === m.home}/><TeamLine team={m.away} score={m.awayScore} win={w === m.away}/></div><div className="mt-2 flex gap-1">{typeof m.homeScore === 'number' && typeof m.awayScore === 'number' && <Badge className="bg-emerald-500/20 text-emerald-200 text-[10px]">{m.homeScore} x {m.awayScore}</Badge>}{m.winnerOverride && <Badge className="bg-emerald-500/20 text-emerald-200 text-[10px]">classificado</Badge>}{pending && <Badge className="bg-amber-500/20 text-amber-200 text-[10px]">pendente</Badge>}</div></div>; }
function Column({ title, children }: { title: string; children: React.ReactNode }) { return <div><div className="mb-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-300">{title}</div><div className="space-y-4">{children}</div></div>; }
function Bracket({ phase32, r16, qf, sf, final }: { phase32: BracketMatch[]; r16: BracketMatch[]; qf: BracketMatch[]; sf: BracketMatch[]; final: BracketMatch[] }) { return <Card className="overflow-hidden border-emerald-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40"><div className="p-5 text-center"><h2 className="text-4xl font-black text-amber-300">CAMINHO ATÉ A FINAL</h2><p className="text-sm text-emerald-100">Chaveamento corrigido: Portugal x Espanha nas oitavas e vagas pendentes sem “A definir”.</p></div><div className="overflow-x-auto"><div className="grid min-w-[1650px] grid-cols-5 gap-5 p-6"><Column title="Fase 32">{phase32.map(m => <Node key={m.label} m={m}/>)}</Column><Column title="Oitavas">{r16.map(m => <Node key={m.label} m={m}/>)}</Column><Column title="Quartas">{qf.map(m => <Node key={m.label} m={m}/>)}</Column><Column title="Semifinais">{sf.map(m => <Node key={m.label} m={m}/>)}</Column><Column title="Final"><div className="mb-4 rounded-full border border-amber-400/40 bg-amber-500/10 p-6 text-center text-6xl">🏆</div>{final.map(m => <Node key={m.label} m={m}/>)}</Column></div></div></Card>; }

export function WorldCupPage() {
  const [api, setApi] = useState<ApiMatch[]>([]);
  const [persistent, setPersistent] = useState<PersistentMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('mata-mata');
  const [last, setLast] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [results, persistentRes] = await Promise.allSettled([
        fetch('/api/365scores/results/copa_do_mundo', { cache: 'no-store' }),
        fetch('/api/world-cup/persistent-summary', { cache: 'no-store' })
      ]);
      if (results.status === 'fulfilled' && results.value.ok) setApi(((await results.value.json()) as { matches?: ApiMatch[] }).matches ?? []);
      if (persistentRes.status === 'fulfilled' && persistentRes.value.ok) setPersistent(((await persistentRes.value.json()) as { matches?: PersistentMatch[] }).matches ?? []);
      setLast(new Date().toISOString());
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const allOfficial = useMemo(() => [...api.map(toApi), ...persistent.map(toPersistent)], [api, persistent]);
  const bracket = useMemo(() => {
    const phase32 = mergeF32(allOfficial);
    const r16Base = makeRound(phase32, R16_PAIRS, ['Oitavas 1', 'Oitavas 2', 'Oitavas 3', 'Oitavas 4', 'Oitavas 5', 'Oitavas 6', 'Oitavas 7', 'Oitavas 8'], R16_TIMES);
    const r16 = mergeRound(r16Base, allOfficial, 'r16');
    const qfBase = makeRound(r16, [[0, 1], [2, 3], [4, 5], [6, 7]], ['Quartas 1', 'Quartas 2', 'Quartas 3', 'Quartas 4'], QF_TIMES);
    const qf = mergeRound(qfBase, allOfficial, 'qf');
    const sfBase = makeRound(qf, [[0, 1], [2, 3]], ['Semifinal 1', 'Semifinal 2'], SF_TIMES);
    const sf = mergeRound(sfBase, allOfficial, 'sf');
    const finalBase = makeRound(sf, [[0, 1]], ['Final'], ['2026-07-19T19:00:00.000Z']);
    const final = mergeRound(finalBase, allOfficial, 'final');
    return { phase32, r16, qf, sf, final };
  }, [allOfficial]);

  const rows = useMemo(() => persistent.filter(m => m.homeScore !== null || m.awayScore !== null).sort((a, b) => Date.parse(b.kickoffAt ?? '') - Date.parse(a.kickoffAt ?? '')), [persistent]);

  return <div className="space-y-6"><Card className="border-emerald-500/30 bg-gradient-to-br from-green-950 via-emerald-900 to-teal-950 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold text-white">🏆 Copa do Mundo 2026</h2><p className="text-sm text-emerald-200">Mata-mata com chaveamento corrigido e atualização automática pela base local.</p></div><div className="text-right"><div className="text-xs text-emerald-100">Atualizado: {fmtDate(last)}</div><Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Atualizar</Button></div></div></Card><Tabs value={tab} onValueChange={setTab}><TabsList className="grid w-full grid-cols-3"><TabsTrigger value="mata-mata">Mata-mata</TabsTrigger><TabsTrigger value="resultados">Resultados</TabsTrigger><TabsTrigger value="odds">Odds</TabsTrigger></TabsList><TabsContent value="mata-mata"><Bracket {...bracket}/></TabsContent><TabsContent value="resultados" className="space-y-3">{rows.length === 0 && <Card className="p-4 text-sm text-muted-foreground">Nenhum resultado persistido encontrado.</Card>}{rows.map(m => <Card key={String(m.id)} className="p-4"><div className="text-xs text-muted-foreground">{fmtDate(m.kickoffAt)} • {m.roundName ?? 'Copa do Mundo'}</div><div className="font-semibold">{flag(m.homeTeamName)} {name(m.homeTeamName)} {m.homeScore ?? '—'} x {m.awayScore ?? '—'} {flag(m.awayTeamName)} {name(m.awayTeamName)}</div></Card>)}</TabsContent><TabsContent value="odds"><WorldCupOddsAlerts/></TabsContent></Tabs></div>;
}

export default WorldCupPage;
