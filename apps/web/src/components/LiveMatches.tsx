'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3, Clock, CornerUpRight, Radio, RefreshCw, Trophy, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FutureMatchPrediction } from '@/components/FutureMatchPrediction';

type PeriodKey = 'firstHalf' | 'secondHalf';

interface PeriodStoppageSummary {
  totalStoppedMs: number | null;
  totalStoppedMinutes: number | null;
  predictedAddedMs: number | null;
  predictedAddedMinutes: number | null;
  actualAddedMinutes: number | null;
  source?: LiveMatch['stoppage'] extends infer S ? S extends { source?: infer T } ? T : never : never;
  kind?: 'calculated-stoppage' | 'announced-added-time';
  incidents: Array<{ startAt: string; endAt?: string; durationMs: number; reason: string; period?: PeriodKey; rawPeriod?: string; timeline?: string }>;
}

interface PeriodStoppageInfo {
  firstHalf: PeriodStoppageSummary;
  secondHalf: PeriodStoppageSummary;
}

interface LiveStatRow {
  key: string;
  label: string;
  home: string;
  away: string;
  category?: string;
  isMajor?: boolean;
}

interface LiveMatch {
  id: number;
  minute: number | string;
  statusText: string;
  homeTeam: { id: number; name: string; score: number };
  awayTeam: { id: number; name: string; score: number };
  competition?: string;
  competitionId: number;
  corners?: { home: number; away: number; total: number };
  liveStats?: LiveStatRow[];
  statsSource?: '365scores' | 'sofascore' | 'api-football';
  source?: string;
  sourceIds?: { scores365?: number; sofascore?: number; apiFootball?: number };
  stoppage?: {
    totalStoppedMs: number;
    totalStoppedMinutes: number;
    predictedAddedMs: number;
    predictedAddedMinutes: number;
    source:
      | '365scores-actual-play-time'
      | '365scores-sportradar'
      | '365scores-announced-added-time'
      | 'sofascore-announced-added-time'
      | 'api-football-announced-added-time';
    kind?: 'calculated-stoppage' | 'announced-added-time';
    incidents: Array<{ startAt: string; endAt?: string; durationMs: number; reason: string; period?: PeriodKey; rawPeriod?: string; timeline?: string }>;
    periods?: PeriodStoppageInfo;
  };
  periodStoppage?: PeriodStoppageInfo;
}

const COMPETITION_ICONS: Record<number, string> = {
  113: '🇧🇷', 116: '🇧🇷', 117: '🇧🇷', 7: '🏴', 17: '🇮🇹', 25: '🇩🇪', 35: '🇫🇷', 572: '🏆', 573: '🏆',
  71: '🇧🇷', 72: '🇧🇷', 73: '🇧🇷', 2: '🏆', 3: '🏆', 848: '🏆', 39: '🏴', 40: '🏴', 140: '🇪🇸', 135: '🇮🇹', 78: '🇩🇪', 61: '🇫🇷', 88: '🇳🇱', 94: '🇵🇹', 65: '🇧🇪', 203: '🇹🇷', 197: '🇬🇷', 179: '🏴', 128: '🇦🇷', 13: '🏆',
};

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function cleanTeam(value: string) {
  return normalize(value)
    .replace(/\b(fc|cf|sc|ac|ec|club|clube|futebol|sport|sporting|real|atletico)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchKey(match: LiveMatch) {
  const teams = [cleanTeam(match.homeTeam.name), cleanTeam(match.awayTeam.name)].sort().join('-');
  const competition = normalize(match.competition || String(match.competitionId || ''));
  return `${competition}:${teams}`;
}

function minuteNumber(match: LiveMatch) {
  if (typeof match.minute === 'number') return match.minute;
  const parsed = Number(String(match.minute).match(/\d{1,3}/)?.[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currentPeriod(match: LiveMatch): PeriodKey {
  const raw = `${match.minute ?? ''} ${match.statusText ?? ''}`.toLowerCase();
  if (raw.includes('2h') || raw.includes('2nd') || raw.includes('second') || raw.includes('segundo')) return 'secondHalf';
  if (raw.includes('1h') || raw.includes('1st') || raw.includes('first') || raw.includes('intervalo')) return 'firstHalf';
  return minuteNumber(match) > 45 ? 'secondHalf' : 'firstHalf';
}

function periodSummary(match: LiveMatch, period: PeriodKey): PeriodStoppageSummary | null {
  return match.periodStoppage?.[period] ?? match.stoppage?.periods?.[period] ?? null;
}

function formatMinute(value?: number | null, prefix = '') {
  if (value === null || value === undefined || value <= 0) return 'não informado';
  return `${prefix}${value.toFixed(1).replace('.0', '')} min`;
}

function hasPeriodData(summary?: PeriodStoppageSummary | null) {
  return Boolean(summary && ((summary.totalStoppedMinutes ?? 0) > 0 || (summary.predictedAddedMinutes ?? 0) > 0 || (summary.actualAddedMinutes ?? 0) > 0 || summary.incidents.length > 0));
}

function sourceLabel(source?: string) {
  if (!source) return 'fonte ao vivo';
  if (source.includes('sofascore')) return 'SofaScore';
  if (source.includes('api-football')) return 'API-Football';
  if (source.includes('365scores')) return '365Scores';
  return source;
}

function overallStoppage(match: LiveMatch) {
  const period = currentPeriod(match);
  const summary = periodSummary(match, period);
  if (hasPeriodData(summary)) {
    return {
      period,
      total: summary?.totalStoppedMinutes ?? null,
      predicted: summary?.predictedAddedMinutes ?? null,
      actual: summary?.actualAddedMinutes ?? null,
      source: summary?.source,
    };
  }

  if (match.stoppage && ((match.stoppage.totalStoppedMinutes ?? 0) > 0 || (match.stoppage.predictedAddedMinutes ?? 0) > 0)) {
    return {
      period,
      total: match.stoppage.totalStoppedMinutes,
      predicted: match.stoppage.predictedAddedMinutes,
      actual: null,
      source: match.stoppage.source,
    };
  }

  return { period, total: null, predicted: null, actual: null, source: undefined };
}

function mergeSummary(base?: PeriodStoppageSummary | null, incoming?: PeriodStoppageSummary | null): PeriodStoppageSummary | null {
  if (!base) return incoming ?? null;
  if (!incoming) return base;
  if (!hasPeriodData(base) && hasPeriodData(incoming)) return incoming;
  return {
    ...base,
    totalStoppedMs: base.totalStoppedMs ?? incoming.totalStoppedMs,
    totalStoppedMinutes: base.totalStoppedMinutes ?? incoming.totalStoppedMinutes,
    predictedAddedMs: base.predictedAddedMs ?? incoming.predictedAddedMs,
    predictedAddedMinutes: base.predictedAddedMinutes ?? incoming.predictedAddedMinutes,
    actualAddedMinutes: base.actualAddedMinutes ?? incoming.actualAddedMinutes,
    source: base.source ?? incoming.source,
    kind: base.kind ?? incoming.kind,
    incidents: incoming.incidents.length > base.incidents.length ? incoming.incidents : base.incidents,
  };
}

function mergePeriods(base?: PeriodStoppageInfo, incoming?: PeriodStoppageInfo): PeriodStoppageInfo | undefined {
  if (!base) return incoming;
  if (!incoming) return base;
  return {
    firstHalf: mergeSummary(base.firstHalf, incoming.firstHalf) ?? base.firstHalf,
    secondHalf: mergeSummary(base.secondHalf, incoming.secondHalf) ?? base.secondHalf,
  };
}

function mergeMatch(base: LiveMatch, incoming: LiveMatch): LiveMatch {
  const incomingHasStats = (incoming.liveStats?.length ?? 0) > (base.liveStats?.length ?? 0);
  const incomingHasStoppage = hasPeriodData(periodSummary(incoming, 'firstHalf')) || hasPeriodData(periodSummary(incoming, 'secondHalf')) || Boolean(incoming.stoppage);
  return {
    ...base,
    minute: minuteNumber(incoming) >= minuteNumber(base) ? incoming.minute : base.minute,
    statusText: incoming.statusText || base.statusText,
    homeTeam: { ...base.homeTeam, score: Math.max(base.homeTeam.score ?? 0, incoming.homeTeam.score ?? 0) },
    awayTeam: { ...base.awayTeam, score: Math.max(base.awayTeam.score ?? 0, incoming.awayTeam.score ?? 0) },
    competition: base.competition ?? incoming.competition,
    competitionId: base.competitionId || incoming.competitionId,
    corners: incoming.corners ?? base.corners,
    liveStats: incomingHasStats ? incoming.liveStats : base.liveStats,
    statsSource: incomingHasStats ? incoming.statsSource : base.statsSource ?? incoming.statsSource,
    stoppage: incomingHasStoppage ? incoming.stoppage ?? base.stoppage : base.stoppage ?? incoming.stoppage,
    periodStoppage: mergePeriods(base.periodStoppage, incoming.periodStoppage),
    sourceIds: { ...base.sourceIds, ...incoming.sourceIds },
  };
}

function dedupeMatches(matches: LiveMatch[]) {
  const map = new Map<string, LiveMatch>();
  for (const match of matches) {
    const key = matchKey(match);
    const existing = map.get(key);
    map.set(key, existing ? mergeMatch(existing, match) : match);
  }
  return Array.from(map.values()).sort((a, b) => String(a.competition ?? '').localeCompare(String(b.competition ?? '')) || minuteNumber(b) - minuteNumber(a));
}

function LiveMatchCard({ match, selected, onClick }: { match: LiveMatch; selected?: boolean; onClick?: () => void }) {
  const icon = COMPETITION_ICONS[match.competitionId] || '⚽';
  const minuteDisplay = typeof match.minute === 'number' ? `${match.minute}'` : match.minute || match.statusText;
  const stop = overallStoppage(match);
  const hasAdded = stop.total !== null || stop.predicted !== null || stop.actual !== null;

  return (
    <Card role="button" tabIndex={0} onClick={onClick} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick?.(); } }} className={`p-4 cursor-pointer border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-green-500/5 hover:border-emerald-400/50 transition-all ${selected ? 'ring-2 ring-emerald-500/60 border-emerald-400' : ''}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex min-w-0 items-center gap-2"><span className="text-lg">{icon}</span><span className="text-xs text-muted-foreground break-words">{match.competition || 'Competição'}</span></div>
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 flex items-center gap-1"><Radio className="w-3 h-3" style={{ animation: 'livepulse 2s ease-in-out infinite' }} />AO VIVO</Badge>
      </div>
      <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <p className="font-semibold leading-tight break-words md:text-right">{match.homeTeam.name}</p>
        <div className="flex min-w-[132px] flex-col items-center px-2">
          <div className="flex items-center gap-2 text-2xl font-bold tabular-nums"><span className={match.homeTeam.score > match.awayTeam.score ? 'text-emerald-400' : ''}>{match.homeTeam.score}</span><span className="text-muted-foreground">-</span><span className={match.awayTeam.score > match.homeTeam.score ? 'text-emerald-400' : ''}>{match.awayTeam.score}</span></div>
          <Badge variant="outline" className="mt-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/20"><Clock className="w-3 h-3 mr-1" />{minuteDisplay}</Badge>
          <div className="mt-2 grid gap-1 text-[11px]" title={`${sourceLabel(stop.source)}`}>
            {hasAdded ? (
              <>
                <Badge variant="outline" className="justify-center bg-cyan-500/10 text-cyan-300 border-cyan-500/20">Bola parada: {formatMinute(stop.total)}</Badge>
                <Badge variant="outline" className="justify-center bg-amber-500/10 text-amber-300 border-amber-500/20">Previsão de Acréscimo: {formatMinute(stop.predicted, '+')}</Badge>
                <Badge variant="outline" className="justify-center border-border/70 bg-background/40 text-muted-foreground">Acréscimo real: {formatMinute(stop.actual, '+')}</Badge>
              </>
            ) : (
              <Badge variant="outline" className="justify-center border-border/70 bg-background/40 text-muted-foreground">Previsão de Acréscimo: não informado</Badge>
            )}
          </div>
        </div>
        <p className="font-semibold leading-tight break-words">{match.awayTeam.name}</p>
      </div>
      {match.corners && <div className="mt-3 border-t border-border/50 pt-3 text-center text-sm"><div className="flex items-center justify-center gap-4"><span className="flex items-center gap-1 text-amber-400"><CornerUpRight className="w-4 h-4" />{match.corners.home}</span><span className="text-muted-foreground">Escanteios</span><span className="flex items-center gap-1 text-amber-400">{match.corners.away}<CornerUpRight className="w-4 h-4 scale-x-[-1]" /></span></div><p className="mt-1 text-xs text-muted-foreground">Total: {match.corners.total}</p></div>}
    </Card>
  );
}

function SummaryCard({ title, summary }: { title: string; summary: PeriodStoppageSummary | null }) {
  return <div className="rounded-lg border border-border bg-background/40 p-3"><p className="mb-3 text-sm font-semibold">{title}</p><div className="grid gap-2 sm:grid-cols-3"><div className="rounded-md bg-cyan-500/10 p-3"><p className="text-xs text-muted-foreground">Tempo parado</p><p className="mt-1 text-lg font-bold text-cyan-300">{formatMinute(summary?.totalStoppedMinutes)}</p></div><div className="rounded-md bg-amber-500/10 p-3"><p className="text-xs text-muted-foreground">Previsão de Acréscimo</p><p className="mt-1 text-lg font-bold text-amber-300">{formatMinute(summary?.predictedAddedMinutes, '+')}</p></div><div className="rounded-md bg-emerald-500/10 p-3"><p className="text-xs text-muted-foreground">Acréscimo real</p><p className="mt-1 text-lg font-bold text-emerald-300">{formatMinute(summary?.actualAddedMinutes, '+')}</p></div></div><p className="mt-3 text-xs text-muted-foreground">Fonte: {sourceLabel(summary?.source)}.</p></div>;
}

function LiveMatchDetails({ match, competition, onClose }: { match: LiveMatch; competition: string; onClose: () => void }) {
  const first = periodSummary(match, 'firstHalf');
  const second = periodSummary(match, 'secondHalf');
  const statRows = match.liveStats ?? [];
  const statsSourceLabel = match.statsSource === '365scores' ? '365Scores' : match.statsSource === 'api-football' ? 'API-Football' : match.sourceIds?.sofascore ? 'SofaScore' : match.source ?? 'ao vivo';

  return <div className="rounded-xl border border-emerald-500/20 bg-card/80 p-4 space-y-4"><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-semibold text-emerald-400"><BarChart3 className="w-4 h-4" />Estatísticas ao vivo</p><h4 className="mt-1 text-base font-bold">{match.homeTeam.name} <span className="text-muted-foreground">x</span> {match.awayTeam.name}</h4><p className="text-xs text-muted-foreground">{competition} - estatísticas: {statsSourceLabel}</p></div><Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8"><X className="w-4 h-4" /></Button></div><div className="grid gap-3 md:grid-cols-3"><div className="rounded-lg border bg-background/40 p-3 text-center"><p className="text-xs text-muted-foreground">Placar atual</p><p className="text-2xl font-bold">{match.homeTeam.score} - {match.awayTeam.score}</p></div><div className="rounded-lg border bg-background/40 p-3 text-center"><p className="text-xs text-muted-foreground">Tempo</p><p className="text-2xl font-bold text-emerald-400">{typeof match.minute === 'number' ? `${match.minute}'` : match.minute}</p></div><div className="rounded-lg border bg-background/40 p-3 text-center"><p className="text-xs text-muted-foreground">Escanteios ao vivo</p><p className="text-2xl font-bold text-amber-400">{match.corners ? `${match.corners.home} - ${match.corners.away}` : '-'}</p></div></div><div className="grid gap-3 md:grid-cols-2"><SummaryCard title="Resumo do 1º Tempo" summary={first} /><SummaryCard title="Resumo do 2º Tempo" summary={second} /></div><div className="rounded-lg border bg-background/40 p-3"><p className="mb-3 text-sm font-semibold">Números do jogo</p>{statRows.length ? <div className="space-y-2">{statRows.map((row) => <div key={row.key} className="grid grid-cols-[80px_1fr_80px] gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm"><span className="font-semibold">{row.home}</span><span className="text-center text-muted-foreground">{row.label}</span><span className="text-right font-semibold">{row.away}</span></div>)}</div> : <p className="text-sm text-muted-foreground">As fontes ao vivo trouxeram placar e tempo, mas ainda não enviaram estatísticas detalhadas deste evento.</p>}</div><FutureMatchPrediction homeTeam={match.homeTeam.name} awayTeam={match.awayTeam.name} league={match.competition || competition} kickoffLabel="Ao vivo" /></div>;
}

export function LiveMatches() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedDisplay, setLastUpdatedDisplay] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedCompetition, setSelectedCompetition] = useState('all');
  const [selectedMatchKey, setSelectedMatchKey] = useState<string | null>(null);

  const fetchLiveMatches = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/365scores/live', { cache: 'no-store' });
      const data = (await response.json()) as { matches?: LiveMatch[]; lastUpdated?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Erro ao carregar jogos ao vivo');
      const unique = dedupeMatches(data.matches ?? []);
      setMatches(unique);
      const updatedAt = data.lastUpdated ? new Date(data.lastUpdated) : new Date();
      setLastUpdatedDisplay(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(updatedAt));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLiveMatches(); }, [fetchLiveMatches]);
  useEffect(() => { if (!autoRefresh) return; const interval = setInterval(fetchLiveMatches, 25000); return () => clearInterval(interval); }, [autoRefresh, fetchLiveMatches]);

  const matchesByCompetition = useMemo(() => matches.reduce((acc, match) => { const key = match.competition || 'Outras Competições'; if (!acc[key]) acc[key] = []; acc[key].push(match); return acc; }, {} as Record<string, LiveMatch[]>), [matches]);
  const competitionOptions = useMemo(() => Object.entries(matchesByCompetition).map(([competition, compMatches]) => ({ competition, count: compMatches.length })).sort((a,b)=>b.count-a.count || a.competition.localeCompare(b.competition)), [matchesByCompetition]);
  useEffect(() => { if (selectedCompetition !== 'all' && !matchesByCompetition[selectedCompetition]) setSelectedCompetition('all'); }, [matchesByCompetition, selectedCompetition]);
  useEffect(() => { if (selectedMatchKey && !matches.some((m) => matchKey(m) === selectedMatchKey)) setSelectedMatchKey(null); }, [matches, selectedMatchKey]);

  const visibleMatches = selectedCompetition === 'all' ? matches : matches.filter((m) => (m.competition || 'Outras Competições') === selectedCompetition);
  const visibleByCompetition = visibleMatches.reduce((acc, match) => { const key = match.competition || 'Outras Competições'; if (!acc[key]) acc[key] = []; acc[key].push(match); return acc; }, {} as Record<string, LiveMatch[]>);

  if (loading && matches.length === 0) return <div className="flex items-center justify-center py-12"><div className="flex flex-col items-center gap-3"><RefreshCw className="w-8 h-8 text-emerald-500" style={{ animation: 'livespin 1s linear infinite' }} /><p className="text-muted-foreground">Buscando jogos ao vivo...</p></div></div>;
  if (error) return <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6"><div className="flex items-start gap-3"><AlertCircle className="w-5 h-5 text-red-500 mt-0.5" /><div><h4 className="font-medium text-red-500">Erro ao carregar jogos</h4><p className="mt-1 text-sm text-red-400/80">{error}</p><Button onClick={() => { setLoading(true); fetchLiveMatches(); }} variant="outline" size="sm" className="mt-3"><RefreshCw className="w-4 h-4 mr-2" />Tentar novamente</Button></div></div></div>;

  return <div className="space-y-4"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="flex items-center gap-2"><Radio className="w-5 h-5 text-red-500" style={{ animation: 'livepulse 2s ease-in-out infinite' }} /><h3 className="text-lg font-semibold">Jogos Ao Vivo</h3></div><Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400">{visibleMatches.length} {visibleMatches.length === 1 ? 'jogo' : 'jogos'}</Badge></div><div className="flex items-center gap-2"><Button variant={autoRefresh ? 'default' : 'outline'} size="sm" onClick={() => setAutoRefresh(!autoRefresh)} className={autoRefresh ? 'bg-emerald-600 hover:bg-emerald-500' : ''}>{autoRefresh ? 'Auto ✓' : 'Auto'}</Button><Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchLiveMatches(); }} disabled={loading}><RefreshCw className="w-4 h-4 mr-2" style={loading ? { animation: 'livespin 1s linear infinite' } : undefined} />Atualizar</Button></div></div>{lastUpdatedDisplay && <p className="text-xs text-muted-foreground">Última atualização: {lastUpdatedDisplay}{autoRefresh && ' (atualiza a cada 25s)'}</p>}{matches.length > 0 && <div className="rounded-xl border border-border bg-card p-3"><label className="mb-2 block text-xs font-medium text-muted-foreground">Filtrar por liga</label><select value={selectedCompetition} onChange={(event) => setSelectedCompetition(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-emerald-500"><option value="all">Todas as ligas ({matches.length})</option>{competitionOptions.map((option) => <option key={option.competition} value={option.competition}>{option.competition} ({option.count})</option>)}</select></div>}{matches.length === 0 ? <Card className="p-8 text-center border-dashed"><Trophy className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" /><h4 className="font-medium text-lg mb-2">Nenhum jogo ao vivo no momento</h4><p className="text-sm text-muted-foreground">Não há partidas em andamento nas ligas monitoradas.</p></Card> : visibleMatches.length === 0 ? <Card className="p-8 text-center border-dashed"><Trophy className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" /><h4 className="font-medium text-lg mb-2">Nenhum jogo nesta liga agora</h4><p className="text-sm text-muted-foreground">Escolha outra liga no filtro ou volte para todas as ligas.</p></Card> : <div className="space-y-6">{Object.entries(visibleByCompetition).map(([competition, compMatches]) => <div key={competition} className="space-y-3"><h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Trophy className="w-4 h-4" />{competition}<Badge variant="outline" className="ml-auto">{compMatches.length}</Badge></h4><div className="space-y-3">{compMatches.map((match) => { const key = matchKey(match); const selected = selectedMatchKey === key; return <div key={key} className="space-y-3"><LiveMatchCard match={match} selected={selected} onClick={() => setSelectedMatchKey((current) => current === key ? null : key)} />{selected && <LiveMatchDetails match={match} competition={competition} onClose={() => setSelectedMatchKey(null)} />}</div>; })}</div></div>)}</div>}<style jsx global>{`@keyframes livepulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes livespin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style></div>;
}

export default LiveMatches;
