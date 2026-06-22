'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar, Loader2, RefreshCw, Trophy, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

type Row = { position: number; team: { name: string }; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; goalDiff: number; points: number };
type Group = { name: string; rows: Row[] };
type Match = { id: number | string; startTime: string; roundName?: string; status?: number; statusId?: number; statusText?: string; homeTeam: { name: string; score?: number }; awayTeam: { name: string; score?: number } };
type Stat = { key: string; name: string; value: string; categoryName: string; competitorId?: number };

const FALLBACK_GROUPS: Group[] = [
  ['A', 'Mexico,South Africa,South Korea,Czechia'], ['B', 'Canada,Bosnia and Herzegovina,Qatar,Switzerland'], ['C', 'Brazil,Morocco,Haiti,Scotland'], ['D', 'United States,Paraguay,Australia,Turkey'], ['E', 'Germany,Curacao,Ivory Coast,Ecuador'], ['F', 'Netherlands,Japan,Sweden,Tunisia'], ['G', 'Belgium,Egypt,Iran,New Zealand'], ['H', 'Spain,Cape Verde,Saudi Arabia,Uruguay'], ['I', 'France,Senegal,Iraq,Norway'], ['J', 'Argentina,Algeria,Austria,Jordan'], ['K', 'Portugal,DR Congo,Uzbekistan,Colombia'], ['L', 'England,Croatia,Ghana,Panama'],
].map(([letter, teams]) => ({ name: `Grupo ${letter}`, rows: String(teams).split(',').map((name, idx) => ({ position: idx + 1, team: { name }, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 })) }));

const NAME_PT: Record<string, string> = { Mexico: 'México', 'South Africa': 'África do Sul', 'South Korea': 'Coreia do Sul', Czechia: 'República Tcheca', Canada: 'Canadá', Qatar: 'Catar', Switzerland: 'Suíça', Brazil: 'Brasil', Morocco: 'Marrocos', Scotland: 'Escócia', 'United States': 'EUA', Paraguay: 'Paraguai', Australia: 'Austrália', Turkey: 'Turquia', Germany: 'Alemanha', 'Ivory Coast': 'Costa do Marfim', Ecuador: 'Equador', Netherlands: 'Holanda', Japan: 'Japão', Sweden: 'Suécia', Tunisia: 'Tunísia', Belgium: 'Bélgica', Egypt: 'Egito', Iran: 'Irã', 'New Zealand': 'Nova Zelândia', Spain: 'Espanha', 'Cape Verde': 'Cabo Verde', 'Saudi Arabia': 'Arábia Saudita', Uruguay: 'Uruguai', France: 'França', Iraq: 'Iraque', Norway: 'Noruega', Argentina: 'Argentina', Algeria: 'Argélia', Austria: 'Áustria', Jordan: 'Jordânia', Portugal: 'Portugal', 'DR Congo': 'RD Congo', Uzbekistan: 'Uzbequistão', Colombia: 'Colômbia', England: 'Inglaterra', Croatia: 'Croácia', Ghana: 'Gana', Panama: 'Panamá' };

function teamName(name: string) { return NAME_PT[name] ?? name; }
function fmtDate(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? 'data não informada' : new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d); }
function groupKey(group: Group) { return group.name.match(/[A-L]/i)?.[0]?.toUpperCase() ?? group.name; }
function situation(row: Row, thirdKeys: Set<string>) { if (row.position <= 2) return ['Classifica', 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30']; if (row.position === 3 && thirdKeys.has(row.team.name)) return ['Melhor 3º', 'bg-amber-500/20 text-amber-300 border-amber-500/30']; if (row.position === 3) return ['Disputa 3º', 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30']; return ['Fora', 'bg-red-500/10 text-red-300 border-red-500/30']; }
function isFinished(match: Match) { return match.status === 3 || match.statusId === 3 || /final|finished|encerrado|ft/i.test(match.statusText ?? ''); }
function normalizeMatch(raw: any): Match { return { id: raw.id, startTime: raw.startTime, roundName: raw.roundName, status: raw.status, statusId: raw.statusId ?? raw.status, statusText: raw.statusText, homeTeam: { name: teamName(raw.homeTeam?.name ?? 'Mandante'), score: raw.homeTeam?.score ?? 0 }, awayTeam: { name: teamName(raw.awayTeam?.name ?? 'Visitante'), score: raw.awayTeam?.score ?? 0 } }; }

export function WorldCupPageV2() {
  const [groups, setGroups] = useState<Group[]>(FALLBACK_GROUPS);
  const [matches, setMatches] = useState<Match[]>([]);
  const [active, setActive] = useState('A');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [standings, upcoming, results] = await Promise.allSettled([fetch('/api/365scores/standings/copa_do_mundo', { cache: 'no-store' }), fetch('/api/365scores/upcoming/copa_do_mundo', { cache: 'no-store' }), fetch('/api/365scores/results/copa_do_mundo', { cache: 'no-store' })]);
      if (standings.status === 'fulfilled' && standings.value.ok) {
        const payload = await standings.value.json();
        if (payload.groups?.length) setGroups(payload.groups);
      }
      const list: Match[] = [];
      for (const item of [upcoming, results]) if (item.status === 'fulfilled' && item.value.ok) { const p = await item.value.json(); list.push(...(p.matches ?? []).map(normalizeMatch)); }
      setMatches(list.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime)));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);
  const selected = groups.find((g) => groupKey(g) === active) ?? groups[0];
  const thirds = useMemo(() => groups.flatMap((g) => g.rows.filter((r) => r.position === 3)).sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor), [groups]);
  const thirdKeys = new Set(thirds.slice(0, 8).map((r) => r.team.name));
  const finished = matches.filter(isFinished);

  return <div className="space-y-6"><Card className="p-5 border-emerald-500/30 bg-emerald-950/30"><div className="flex items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">🏆 Copa do Mundo 2026</h2><p className="text-sm text-muted-foreground">Classificação por grupos, melhores terceiros, mata-mata e resultados.</p></div><Button onClick={load} variant="outline" size="sm">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}Atualizar</Button></div></Card><Tabs defaultValue="grupos" className="space-y-4"><TabsList className="grid w-full grid-cols-4"><TabsTrigger value="grupos"><Users className="h-4 w-4 mr-1" />Grupos</TabsTrigger><TabsTrigger value="terceiros"><Trophy className="h-4 w-4 mr-1" />3º</TabsTrigger><TabsTrigger value="mata">Mata-mata</TabsTrigger><TabsTrigger value="resultados"><Calendar className="h-4 w-4 mr-1" />Resultados</TabsTrigger></TabsList><TabsContent value="grupos" className="space-y-4"><div className="flex flex-wrap gap-2">{groups.map((g) => <Button key={groupKey(g)} size="sm" variant={active === groupKey(g) ? 'default' : 'outline'} onClick={() => setActive(groupKey(g))}>{g.name}</Button>)}</div>{selected && <StandingTable group={selected} thirdKeys={thirdKeys} />}<div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{groups.map((g) => <Card key={g.name} className="p-3 cursor-pointer" onClick={() => setActive(groupKey(g))}><strong>{g.name}</strong>{g.rows.map((r) => <div key={r.team.name} className="flex gap-2 text-sm"><span>{r.position}</span><span>{teamName(r.team.name)}</span><span className="ml-auto">{r.points} pts</span></div>)}</Card>)}</div></TabsContent><TabsContent value="terceiros"><Card className="p-4"><h3 className="font-semibold mb-3">Melhores terceiros</h3>{thirds.map((r, i) => <div key={r.team.name} className="flex gap-2 rounded p-2 bg-muted/30 mb-2"><span>{i + 1}</span><span>{teamName(r.team.name)}</span><span className="ml-auto">{r.points} pts • SG {r.goalDiff}</span><Badge className={i < 8 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/10 text-red-300'}>{i < 8 ? 'classifica' : 'fora'}</Badge></div>)}</Card></TabsContent><TabsContent value="mata"><Card className="p-4"><h3 className="font-semibold mb-2">Mata-mata preparado</h3><p className="text-sm text-muted-foreground mb-3">Avançam 32 seleções: 24 pelos dois primeiros lugares e 8 melhores terceiros. Os confrontos serão preenchidos automaticamente quando os grupos fecharem.</p>{['2º A x 2º B', '1º C x 2º F', '1º E x melhor 3º', '1º F x 2º C', '2º E x 2º I', '1º I x melhor 3º', '1º A x melhor 3º', '1º B x melhor 3º'].map((x, i) => <div key={x} className="border rounded p-2 mb-2">Jogo {i + 1}: {x}</div>)}</Card></TabsContent><TabsContent value="resultados"><Card className="p-4"><h3 className="font-semibold mb-3">Resultados e estatísticas pós-jogo</h3>{finished.length === 0 && <p className="text-sm text-muted-foreground">Ainda não há jogos encerrados retornados pela fonte.</p>}{finished.map((m) => <ResultMatch key={m.id} match={m} />)}</Card></TabsContent></Tabs></div>;
}

function StandingTable({ group, thirdKeys }: { group: Group; thirdKeys: Set<string> }) { return <Card className="overflow-hidden"><div className="p-3 bg-emerald-500/10 font-bold">{group.name}</div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-muted-foreground"><th className="p-2 text-left">#</th><th className="p-2 text-left">Seleção</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th><th>Pts</th><th>Situação</th></tr></thead><tbody>{group.rows.map((r) => { const [label, klass] = situation(r, thirdKeys); return <tr key={r.team.name} className="border-t"><td className="p-2">{r.position}</td><td className="p-2">{teamName(r.team.name)}</td><td className="text-center">{r.played}</td><td className="text-center">{r.won}</td><td className="text-center">{r.drawn}</td><td className="text-center">{r.lost}</td><td className="text-center">{r.goalDiff}</td><td className="text-center font-bold text-emerald-400">{r.points}</td><td className="text-center"><Badge variant="outline" className={klass}>{label}</Badge></td></tr>; })}</tbody></table></div></Card>; }
function ResultMatch({ match }: { match: Match }) { const [open, setOpen] = useState(false); const [stats, setStats] = useState<Stat[]>([]); async function toggle() { const next = !open; setOpen(next); if (next && stats.length === 0) { const r = await fetch(`/api/365scores/game-stats?gameId=${match.id}`); const p = await r.json(); setStats(p.statistics ?? []); } } return <div className="border rounded p-3 mb-3"><div className="flex justify-between gap-3"><div><div className="text-xs text-muted-foreground">{fmtDate(match.startTime)} • {match.roundName}</div><strong>{match.homeTeam.name} {match.homeTeam.score ?? 0} x {match.awayTeam.score ?? 0} {match.awayTeam.name}</strong></div><Button size="sm" variant="outline" onClick={toggle}>{open ? 'Ocultar' : 'Ver estatísticas'}</Button></div>{open && <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2 mt-3">{stats.length === 0 ? <p className="text-sm text-muted-foreground">A fonte ainda não retornou estatísticas detalhadas para este jogo.</p> : stats.map((s) => <div key={`${s.key}-${s.competitorId ?? 'x'}`} className="bg-muted/30 rounded p-2"><div className="text-xs text-muted-foreground">{s.categoryName}</div><div className="flex justify-between"><span>{s.name}</span><b>{s.value}</b></div></div>)}</div>}</div>; }
