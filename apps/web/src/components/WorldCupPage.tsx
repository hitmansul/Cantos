'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, RefreshCw, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorldCupOddsAlerts } from '@/components/WorldCupOddsAlerts';

type ApiStandingGroup = { name?: string; rows?: Array<{ position?: number; team?: { name?: string; shortName?: string }; played?: number; won?: number; drawn?: number; lost?: number; goalsFor?: number; goalsAgainst?: number; goalDiff?: number; points?: number }> };
type StandingRow = { position: number; teamName: string; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; goalDiff: number; points: number };
type StandingGroup = { key: string; label: string; rows: StandingRow[]; source: '365scores' | 'estrutura' };
type ApiMatch = { id?: number | string; startTime?: string; roundName?: string; statusId?: number; status?: number; statusText?: string; homeTeam?: { name?: string; score?: number }; awayTeam?: { name?: string; score?: number } };
type Match = { id: string; startTime: string; roundName: string; statusText: string; statusId?: number; homeTeam: string; awayTeam: string; homeScore?: number; awayScore?: number };
type MetricPair = { home: string | number | null; away: string | number | null };
type RawStat = { team_name?: string | null; metric_key?: string | null; metric_name?: string | null; value_numeric?: number | null; value_text?: string | null };
type PersistentMatch = {
  id: number | string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string | null;
  kickoffAt: string | null;
  groupName: string | null;
  roundName: string | null;
  venue: string | null;
  referee: string | null;
  statsCount: number;
  mappedStatsCount?: number;
  sources?: string[];
  summary: {
    possession: MetricPair;
    shots: MetricPair;
    shotsOnGoal: MetricPair;
    corners: MetricPair;
    yellowCards: MetricPair;
    redCards: MetricPair;
    fouls: MetricPair;
    offsides: MetricPair;
    passes?: MetricPair;
    passAccuracy?: MetricPair;
    goalkeeperSaves?: MetricPair;
    xg?: string | null;
  };
  rawStats?: RawStat[];
};

const GROUP_ORDER = ['A','B','C','D','E','F','G','H','I','J','K','L'];
const FALLBACK_GROUPS: Record<string, string[]> = {
  A: ['Mexico','Korea Republic','Czechia','South Africa'],
  B: ['Canada','Switzerland','Bosnia And Herzegovina','Qatar'],
  C: ['Brazil','Morocco','Scotland','Haiti'],
  D: ['USA','Australia','Paraguay','Turkiye'],
  E: ['Germany',"Cote d'Ivoire",'Ecuador','Curacao'],
  F: ['Netherlands','Japan','Sweden','Tunisia'],
  G: ['Belgium','Egypt','IR Iran','New Zealand'],
  H: ['Spain','Uruguay','Saudi Arabia','Cape Verde Islands'],
  I: ['France','Norway','Senegal','Iraq'],
  J: ['Argentina','Austria','Jordan','Algeria'],
  K: ['Colombia','Congo DR','Portugal','Uzbekistan'],
  L: ['England','Ghana','Panama','Croatia'],
};
const DISPLAY_NAMES: Record<string, string> = { mexico:'México','korea republic':'Coreia do Sul','south korea':'Coreia do Sul',czechia:'Tchéquia','czech republic':'Tchéquia','south africa':'África do Sul',canada:'Canadá',switzerland:'Suíça','bosnia and herzegovina':'Bósnia e Herzegovina',qatar:'Catar',brazil:'Brasil',morocco:'Marrocos',scotland:'Escócia',haiti:'Haiti',usa:'EUA','united states':'EUA',australia:'Austrália',paraguay:'Paraguai',turkiye:'Turquia',turkey:'Turquia',germany:'Alemanha',"cote d'ivoire":'Costa do Marfim','cote d ivoire':'Costa do Marfim','ivory coast':'Costa do Marfim',ecuador:'Equador',curacao:'Curaçao',netherlands:'Holanda',japan:'Japão',sweden:'Suécia',tunisia:'Tunísia',belgium:'Bélgica',egypt:'Egito',iran:'Irã','ir iran':'Irã','new zealand':'Nova Zelândia',spain:'Espanha',uruguay:'Uruguai','saudi arabia':'Arábia Saudita','cape verde islands':'Cabo Verde','cape verde':'Cabo Verde',france:'França',norway:'Noruega',senegal:'Senegal',iraq:'Iraque',argentina:'Argentina',austria:'Áustria',jordan:'Jordânia',algeria:'Argélia',colombia:'Colômbia','rd congo':'RD Congo','dr congo':'RD Congo','congo dr':'RD Congo',portugal:'Portugal',uzbekistan:'Uzbequistão',england:'Inglaterra',ghana:'Gana',panama:'Panamá',croatia:'Croácia' };
const FLAGS: Record<string, string> = { mexico:'🇲🇽','korea republic':'🇰🇷','south korea':'🇰🇷',czechia:'🇨🇿','south africa':'🇿🇦',canada:'🇨🇦',switzerland:'🇨🇭','bosnia and herzegovina':'🇧🇦',qatar:'🇶🇦',brazil:'🇧🇷',morocco:'🇲🇦',scotland:'🏴',haiti:'🇭🇹',usa:'🇺🇸','united states':'🇺🇸',australia:'🇦🇺',paraguay:'🇵🇾',turkiye:'🇹🇷',germany:'🇩🇪',"cote d'ivoire":'🇨🇮','cote d ivoire':'🇨🇮','ivory coast':'🇨🇮',ecuador:'🇪🇨',curacao:'🇨🇼',netherlands:'🇳🇱',japan:'🇯🇵',sweden:'🇸🇪',tunisia:'🇹🇳',belgium:'🇧🇪',egypt:'🇪🇬',iran:'🇮🇷','ir iran':'🇮🇷','new zealand':'🇳🇿',spain:'🇪🇸',uruguay:'🇺🇾','saudi arabia':'🇸🇦','cape verde islands':'🇨🇻','cape verde':'🇨🇻',france:'🇫🇷',norway:'🇳🇴',senegal:'🇸🇳',iraq:'🇮🇶',argentina:'🇦🇷',austria:'🇦🇹',jordan:'🇯🇴',algeria:'🇩🇿',colombia:'🇨🇴','rd congo':'🇨🇩','dr congo':'🇨🇩','congo dr':'🇨🇩',portugal:'🇵🇹',uzbekistan:'🇺🇿',england:'🏴',ghana:'🇬🇭',panama:'🇵🇦',croatia:'🇭🇷' };

function normalize(value: unknown): string { return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function canonicalTeamKey(value: unknown): string { const key = normalize(value); if (key === 'united states') return 'usa'; if (key === 'south korea') return 'korea republic'; if (key === 'czech republic') return 'czechia'; if (key === 'turkey') return 'turkiye'; if (key === 'ivory coast' || key === 'cote d ivoire') return "cote d'ivoire"; if (key === 'cape verde') return 'cape verde islands'; if (key === 'dr congo' || key === 'rd congo') return 'congo dr'; if (key === 'iran') return 'ir iran'; return key; }
function displayName(value: unknown): string { const text = String(value ?? 'Seleção'); return DISPLAY_NAMES[normalize(text)] ?? DISPLAY_NAMES[canonicalTeamKey(text)] ?? text; }
function flag(value: unknown): string { return FLAGS[normalize(value)] ?? FLAGS[canonicalTeamKey(value)] ?? '🏳️'; }
const TEAM_TO_GROUP = Object.fromEntries(Object.entries(FALLBACK_GROUPS).flatMap(([group, teams]) => teams.map((team) => [canonicalTeamKey(team), group])));
function formatDateTime(value?: string | null): string { if (!value) return '--'; const date = new Date(value); if (Number.isNaN(date.getTime())) return '--'; return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date); }
function emptyRow(teamName: string, index: number): StandingRow { return { position: index + 1, teamName, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 }; }
function sortRows(rows: StandingRow[]): StandingRow[] { return [...rows].sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || a.position - b.position).map((row, index) => ({ ...row, position: index + 1 })); }
function fallbackGroups(): StandingGroup[] { return GROUP_ORDER.map((key) => ({ key, label: `Grupo ${key}`, source: 'estrutura', rows: FALLBACK_GROUPS[key].map(emptyRow) })); }
function apiRowToStanding(row: NonNullable<ApiStandingGroup['rows']>[number], index: number): StandingRow { return { position: Number(row.position ?? index + 1), teamName: row.team?.name ?? row.team?.shortName ?? 'Seleção', played: Number(row.played ?? 0), won: Number(row.won ?? 0), drawn: Number(row.drawn ?? 0), lost: Number(row.lost ?? 0), goalsFor: Number(row.goalsFor ?? 0), goalsAgainst: Number(row.goalsAgainst ?? 0), goalDiff: Number(row.goalDiff ?? 0), points: Number(row.points ?? 0) }; }
function normalizeGroups(groups: ApiStandingGroup[]): StandingGroup[] { const allRows = groups.flatMap((group) => group.rows ?? []).map(apiRowToStanding); if (allRows.length === 0) return fallbackGroups(); return GROUP_ORDER.map((group) => { const rowsByGroup = allRows.filter((row) => TEAM_TO_GROUP[canonicalTeamKey(row.teamName)] === group); const withMissing = FALLBACK_GROUPS[group].map((team, index) => rowsByGroup.find((row) => canonicalTeamKey(row.teamName) === canonicalTeamKey(team)) ?? emptyRow(team, index)); return { key: group, label: `Grupo ${group}`, rows: sortRows(withMissing), source: '365scores' as const }; }); }
function normalizeMatch(raw: ApiMatch): Match { return { id: String(raw.id ?? `${raw.startTime}-${raw.homeTeam?.name}-${raw.awayTeam?.name}`), startTime: raw.startTime ?? '', roundName: raw.roundName ?? 'Copa do Mundo', statusText: raw.statusText ?? '', statusId: raw.statusId ?? raw.status, homeTeam: raw.homeTeam?.name ?? 'Mandante', awayTeam: raw.awayTeam?.name ?? 'Visitante', homeScore: typeof raw.homeTeam?.score === 'number' ? raw.homeTeam.score : undefined, awayScore: typeof raw.awayTeam?.score === 'number' ? raw.awayTeam.score : undefined }; }
function isFinished(match: Match): boolean { const status = normalize(`${match.statusText} ${match.statusId}`); return match.statusId === 3 || status.includes('finished') || status.includes('final') || status.includes('complete') || status.includes('fim'); }
function thirdPlaceRows(groups: StandingGroup[]): Array<StandingRow & { group: string }> { return groups.map((group) => ({ ...group.rows[2], group: group.key })).filter((row): row is StandingRow & { group: string } => Boolean(row?.teamName)).sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || displayName(a.teamName).localeCompare(displayName(b.teamName))); }
function metricValue(value: string | number | null | undefined): string { if (value === null || value === undefined || value === '') return '—'; return String(value); }
function numeric(value: string | number | null | undefined): number | null { if (typeof value === 'number' && Number.isFinite(value)) return value; if (typeof value === 'string') { const parsed = Number(value.replace('%', '').replace(',', '.')); return Number.isFinite(parsed) ? parsed : null; } return null; }
function hasAnyRealValue(match: PersistentMatch): boolean { const values = Object.values(match.summary).flatMap((item) => typeof item === 'object' && item ? [item.home, item.away] : [item]); return values.some((value) => value !== null && value !== undefined && value !== ''); }

function QualificationBadge({ row, bestThirdKeys }: { row: StandingRow; bestThirdKeys: Set<string> }) { const key = canonicalTeamKey(row.teamName); if (row.position <= 2) return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Classifica direto</Badge>; if (row.position === 3 && bestThirdKeys.has(key)) return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">Melhor 3º</Badge>; if (row.position === 3) return <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/30">3º fora</Badge>; return <Badge className="bg-red-500/10 text-red-300 border-red-500/20">Fora</Badge>; }

function StandingsTable({ group, bestThirdKeys }: { group: StandingGroup; bestThirdKeys: Set<string> }) {
  return <Card className="overflow-hidden border-emerald-500/20"><div className="flex items-center justify-between border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-3"><h3 className="flex items-center gap-2 font-bold"><Trophy className="h-4 w-4 text-amber-400" />{group.label}</h3><Badge variant="outline">{group.source}</Badge></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Seleção</th><th className="px-3 py-2 text-center">J</th><th className="px-3 py-2 text-center">V</th><th className="px-3 py-2 text-center">E</th><th className="px-3 py-2 text-center">D</th><th className="px-3 py-2 text-center">SG</th><th className="px-3 py-2 text-center">Pts</th><th className="px-3 py-2 text-left">Situação</th></tr></thead><tbody className="divide-y divide-border">{group.rows.map((row) => { const qualified = row.position <= 2 || bestThirdKeys.has(canonicalTeamKey(row.teamName)); return <tr key={`${group.key}-${row.teamName}`} className={qualified ? 'border-l-2 border-l-emerald-500' : ''}><td className="px-3 py-3 font-mono text-muted-foreground">{row.position}</td><td className="px-3 py-3 font-medium">{flag(row.teamName)} {displayName(row.teamName)}</td><td className="px-3 py-3 text-center">{row.played}</td><td className="px-3 py-3 text-center text-green-400">{row.won}</td><td className="px-3 py-3 text-center text-yellow-400">{row.drawn}</td><td className="px-3 py-3 text-center text-red-400">{row.lost}</td><td className="px-3 py-3 text-center">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td><td className="px-3 py-3 text-center font-bold text-emerald-400">{row.points}</td><td className="px-3 py-3"><QualificationBadge row={row} bestThirdKeys={bestThirdKeys} /></td></tr>; })}</tbody></table></div></Card>;
}

function StatLine({ label, pair, percent = false }: { label: string; pair?: MetricPair; percent?: boolean }) {
  const home = numeric(pair?.home);
  const away = numeric(pair?.away);
  const total = home !== null && away !== null ? Math.max(home + away, 1) : null;
  const homePct = total ? Math.round((home! / total) * 100) : null;
  const awayPct = total ? 100 - homePct! : null;
  return <div className="rounded-xl border bg-background/60 p-3"><div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span><span>{metricValue(pair?.home)} x {metricValue(pair?.away)}</span></div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div><div className="mb-1 text-right text-lg font-bold">{metricValue(pair?.home)}{percent && pair?.home !== null && pair?.home !== undefined ? '%' : ''}</div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="ml-auto h-full rounded-full bg-emerald-500" style={{ width: `${homePct ?? 0}%` }} /></div></div><span className="text-xs text-muted-foreground">vs</span><div><div className="mb-1 text-lg font-bold">{metricValue(pair?.away)}{percent && pair?.away !== null && pair?.away !== undefined ? '%' : ''}</div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${awayPct ?? 0}%` }} /></div></div></div></div>;
}

function PersistentMatchCard({ match, opened, onToggle }: { match: PersistentMatch; opened: boolean; onToggle: () => void }) {
  const score = match.homeScore !== null && match.awayScore !== null ? `${match.homeScore} x ${match.awayScore}` : 'x';
  const mapped = hasAnyRealValue(match);
  const rawStats = match.rawStats ?? [];
  const sourceText = match.sources?.length ? match.sources.join(' + ') : 'banco';
  return <Card className="overflow-hidden border-border/70"><button type="button" onClick={onToggle} className="w-full border-b bg-muted/20 p-4 text-left hover:bg-muted/30"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="min-w-0 flex-1"><div className="text-xs text-muted-foreground">{formatDateTime(match.kickoffAt)} • {match.groupName ?? match.roundName ?? 'Copa do Mundo'} • {sourceText}</div><div className="mt-2 grid items-center gap-2 text-base font-semibold md:grid-cols-[1fr_auto_1fr] md:text-lg"><span>{flag(match.homeTeamName)} {displayName(match.homeTeamName)}</span><span className="rounded-full bg-background px-4 py-1 text-center text-xl">{score}</span><span className="md:text-right">{flag(match.awayTeamName)} {displayName(match.awayTeamName)}</span></div>{match.venue && <div className="mt-1 text-xs text-muted-foreground">{match.venue}</div>}</div><div className="flex flex-wrap items-center gap-2 md:justify-end"><Badge className={mapped ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : match.statsCount > 0 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-500/20 text-slate-300 border-slate-500/30'}>{mapped ? `${match.mappedStatsCount ?? match.statsCount} dados mapeados` : `${match.statsCount} registros brutos`}</Badge><Badge variant="outline" className="gap-1">{opened ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}{opened ? 'Ocultar' : 'Ver estatísticas'}</Badge></div></div></button>{opened && <div className="space-y-4 p-4"><div className="grid gap-3 xl:grid-cols-2"><StatLine label="Posse de bola" pair={match.summary.possession} percent /><StatLine label="Finalizações" pair={match.summary.shots} /><StatLine label="Chutes no gol" pair={match.summary.shotsOnGoal} /><StatLine label="Escanteios" pair={match.summary.corners} /><StatLine label="Cartões amarelos" pair={match.summary.yellowCards} /><StatLine label="Cartões vermelhos" pair={match.summary.redCards} /><StatLine label="Faltas" pair={match.summary.fouls} /><StatLine label="Impedimentos" pair={match.summary.offsides} /><StatLine label="Passes" pair={match.summary.passes} /><StatLine label="Defesas" pair={match.summary.goalkeeperSaves} /></div>{match.summary.xg && <div className="rounded-xl border bg-muted/30 p-3 text-sm"><span className="text-muted-foreground">xG: </span><strong>{match.summary.xg}</strong></div>}{!mapped && rawStats.length > 0 && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm"><div className="font-semibold text-amber-200">Há registros brutos importados, mas ainda sem valor mapeado nos cards principais.</div><div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{rawStats.slice(0, 18).map((stat, index) => <div key={`${stat.metric_key}-${stat.metric_name}-${index}`} className="rounded-md bg-background/70 px-3 py-2"><div className="text-xs text-muted-foreground">{stat.team_name ?? 'Equipe'} • {stat.metric_name ?? stat.metric_key ?? 'Estatística'}</div><div className="font-semibold">{metricValue(stat.value_numeric ?? stat.value_text)}</div></div>)}</div></div>}</div>}</Card>;
}

function KnockoutSlot({ home, away, label }: { home: string; away: string; label: string }) { return <Card className="border-emerald-500/20 bg-muted/20 p-3"><div className="mb-2 text-xs font-semibold text-emerald-300">{label}</div><div className="space-y-2 text-sm"><div className="rounded-md bg-background/70 px-3 py-2">{flag(home)} {displayName(home)}</div><div className="rounded-md bg-background/70 px-3 py-2">{flag(away)} {displayName(away)}</div></div></Card>; }
function buildKnockoutPairs(qualified: string[]): Array<{ home: string; away: string; label: string }> { const pairs: Array<{ home: string; away: string; label: string }> = []; for (let index = 0; index < 16; index += 1) pairs.push({ home: qualified[index] ?? `Classificado ${index + 1}`, away: qualified[31 - index] ?? `Classificado ${32 - index}`, label: `Jogo ${index + 1}` }); return pairs; }

export function WorldCupPage() {
  const [groups, setGroups] = useState<StandingGroup[]>(fallbackGroups());
  const [matches, setMatches] = useState<Match[]>([]);
  const [persistentMatches, setPersistentMatches] = useState<PersistentMatch[]>([]);
  const [activeTab, setActiveTab] = useState('grupos');
  const [openedMatchId, setOpenedMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [standingsResult, upcomingResult, resultsResult, persistentResult] = await Promise.allSettled([
        fetch('/api/365scores/standings/copa_do_mundo', { cache: 'no-store' }),
        fetch('/api/365scores/upcoming/copa_do_mundo', { cache: 'no-store' }),
        fetch('/api/365scores/results/copa_do_mundo', { cache: 'no-store' }),
        fetch('/api/world-cup/persistent-summary', { cache: 'no-store' }),
      ]);
      if (standingsResult.status === 'fulfilled' && standingsResult.value.ok) {
        const payload = (await standingsResult.value.json()) as { groups?: ApiStandingGroup[] };
        setGroups(normalizeGroups(payload.groups ?? []));
      } else setGroups(fallbackGroups());

      const loaded: Match[] = [];
      if (upcomingResult.status === 'fulfilled' && upcomingResult.value.ok) loaded.push(...(((await upcomingResult.value.json()) as { matches?: ApiMatch[] }).matches ?? []).map(normalizeMatch));
      if (resultsResult.status === 'fulfilled' && resultsResult.value.ok) loaded.push(...(((await resultsResult.value.json()) as { matches?: ApiMatch[] }).matches ?? []).map(normalizeMatch));
      setMatches(Array.from(new Map(loaded.map((match) => [match.id, match])).values()).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime)));

      if (persistentResult.status === 'fulfilled' && persistentResult.value.ok) setPersistentMatches(((await persistentResult.value.json()) as { matches?: PersistentMatch[] }).matches ?? []);
      else setPersistentMatches([]);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a Copa agora.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  const bestThirds = useMemo(() => thirdPlaceRows(groups), [groups]);
  const bestThirdKeys = useMemo(() => new Set(bestThirds.slice(0, 8).map((row) => canonicalTeamKey(row.teamName))), [bestThirds]);
  const qualified = useMemo(() => [...groups.flatMap((group) => group.rows.slice(0, 2).map((row) => row.teamName)), ...bestThirds.slice(0, 8).map((row) => row.teamName)], [groups, bestThirds]);
  const knockoutPairs = useMemo(() => buildKnockoutPairs(qualified), [qualified]);
  const finishedMatches = useMemo(() => matches.filter(isFinished).reverse(), [matches]);

  return <div className="space-y-6"><Card className="border-emerald-500/30 bg-gradient-to-br from-green-950 via-emerald-900 to-teal-950 p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h2 className="text-2xl font-bold text-white">🏆 Copa do Mundo 2026</h2><p className="mt-1 text-sm text-emerald-200">Classificação por grupo, melhores terceiros dentro da tabela, simulação do mata-mata e estatísticas pós-jogo.</p><div className="mt-3 flex flex-wrap gap-2"><Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30">1º e 2º avançam</Badge><Badge className="bg-amber-500/20 text-amber-200 border-amber-500/30">8 melhores terceiros</Badge><Badge className="bg-blue-500/20 text-blue-200 border-blue-500/30">Mata-mata com 32</Badge></div></div><div className="flex flex-col items-start gap-2 md:items-end"><div className="text-xs text-emerald-100">Atualizado: {formatDateTime(lastUpdated)}</div><Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Atualizar</Button></div></div></Card>{error && <Card className="border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">{error}</Card>}<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4"><TabsList className="grid w-full grid-cols-4"><TabsTrigger value="grupos">Grupos</TabsTrigger><TabsTrigger value="mata-mata">Mata-mata</TabsTrigger><TabsTrigger value="resultados">Resultados</TabsTrigger><TabsTrigger value="odds">Odds</TabsTrigger></TabsList><TabsContent value="grupos" className="space-y-4"><Card className="border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-muted-foreground">Regulamento: 1º e 2º de cada grupo avançam direto. O 3º colocado fica marcado como Melhor 3º quando estiver entre os 8 melhores terceiros.</Card><div className="grid gap-4 xl:grid-cols-2">{groups.map((group) => <StandingsTable key={group.key} group={group} bestThirdKeys={bestThirdKeys} />)}</div></TabsContent><TabsContent value="mata-mata" className="space-y-4"><Card className="p-4"><h3 className="mb-2 flex items-center gap-2 font-semibold"><Trophy className="h-4 w-4 text-amber-400" />Simulação do mata-mata</h3><p className="mb-4 text-sm text-muted-foreground">Simulação com os 24 classificados diretos e os 8 melhores terceiros conforme a tabela atual. Quando a fase de grupos terminar, estes confrontos ficam definitivos.</p><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{knockoutPairs.map((pair) => <KnockoutSlot key={pair.label} {...pair} />)}</div></Card></TabsContent><TabsContent value="resultados" className="space-y-4">{persistentMatches.length > 0 && <div className="space-y-3"><h3 className="font-semibold">Dados pós-jogo</h3>{persistentMatches.map((match) => <PersistentMatchCard key={String(match.id)} match={match} opened={openedMatchId === String(match.id)} onToggle={() => setOpenedMatchId(openedMatchId === String(match.id) ? null : String(match.id))} />)}</div>}<div className="space-y-3"><h3 className="font-semibold">Resultados da fonte</h3>{finishedMatches.length > 0 ? finishedMatches.map((match) => <Card key={match.id} className="p-4"><div className="text-xs text-muted-foreground">{formatDateTime(match.startTime)} • {match.roundName}</div><div className="mt-1 text-base font-semibold">{flag(match.homeTeam)} {displayName(match.homeTeam)} {typeof match.homeScore === 'number' ? match.homeScore : ''} x {typeof match.awayScore === 'number' ? match.awayScore : ''} {flag(match.awayTeam)} {displayName(match.awayTeam)}</div></Card>) : <Card className="p-4 text-sm text-muted-foreground">Ainda não há jogos encerrados retornados pela fonte.</Card>}</div></TabsContent><TabsContent value="odds"><WorldCupOddsAlerts /></TabsContent></Tabs></div>;
}

export default WorldCupPage;
