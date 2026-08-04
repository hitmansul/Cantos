'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, BarChart3, Clock3, CornerUpRight, RefreshCw, Target, TrendingDown, TrendingUp } from 'lucide-react';

type TrendStatus = 'accelerating' | 'stable' | 'cooling' | 'insufficient-data';
type Pair = { home: number | null; away: number | null; total: number | null };

type Snapshot = {
  capturedAt: string | null;
  minute: number | string | null;
  homeScore: number;
  awayScore: number;
  corners: Pair;
  shots: Pair;
  dangerousAttacks: Pair;
};

type Trend = {
  status: TrendStatus;
  cornersDelta: number;
  shotsDelta: number;
  dangerousAttacksDelta: number;
  stoppedMinutesDelta: number;
};

type LiveMatch = {
  id: number;
  minute: number | string;
  competition: string;
  homeTeam: { name: string; score: number };
  awayTeam: { name: string; score: number };
  corners?: { home: number; away: number; total: number };
  engineHistory: Snapshot[];
  engineTrend: Trend;
  engineUpdatedAt?: string;
};

const labels: Record<TrendStatus, string> = {
  accelerating: 'Acelerando',
  stable: 'Estável',
  cooling: 'Esfriando',
  'insufficient-data': 'Coletando histórico',
};

function number(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullable(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pair(value: unknown): Pair {
  const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const home = nullable(item.home);
  const away = nullable(item.away);
  const total = nullable(item.total) ?? (home !== null && away !== null ? home + away : null);
  return { home, away, total };
}

function status(value: unknown): TrendStatus {
  return value === 'accelerating' || value === 'stable' || value === 'cooling'
    ? value
    : 'insufficient-data';
}

function normalizeSnapshot(value: unknown): Snapshot | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  return {
    capturedAt: typeof item.capturedAt === 'string' ? item.capturedAt : null,
    minute: typeof item.minute === 'string' || typeof item.minute === 'number' ? item.minute : null,
    homeScore: number(item.homeScore),
    awayScore: number(item.awayScore),
    corners: pair(item.corners ?? { home: item.homeCorners, away: item.awayCorners, total: item.totalCorners }),
    shots: pair(item.shots ?? { home: item.homeShots, away: item.awayShots }),
    dangerousAttacks: pair(item.dangerousAttacks ?? { home: item.homeDangerousAttacks, away: item.awayDangerousAttacks }),
  };
}

function normalizeMatch(value: unknown): LiveMatch | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const home = item.homeTeam && typeof item.homeTeam === 'object' ? item.homeTeam as Record<string, unknown> : null;
  const away = item.awayTeam && typeof item.awayTeam === 'object' ? item.awayTeam as Record<string, unknown> : null;
  const id = number(item.id, NaN);
  if (!home || !away || !Number.isFinite(id)) return null;

  const rawTrend = item.engineTrend && typeof item.engineTrend === 'object' ? item.engineTrend as Record<string, unknown> : {};
  const cornersDelta = pair(rawTrend.cornersDelta).total ?? number(rawTrend.cornersDelta);
  const shotsDelta = pair(rawTrend.shotsDelta).total ?? number(rawTrend.shotsDelta);
  const dangerousDelta = pair(rawTrend.dangerousAttacksDelta).total ?? number(rawTrend.dangerousAttacksDelta);
  const history = Array.isArray(item.engineHistory)
    ? item.engineHistory.map(normalizeSnapshot).filter((entry): entry is Snapshot => Boolean(entry))
    : [];
  const cornersRaw = item.corners && typeof item.corners === 'object' ? item.corners as Record<string, unknown> : null;

  return {
    id,
    minute: typeof item.minute === 'string' || typeof item.minute === 'number' ? item.minute : '—',
    competition: typeof item.competition === 'string' ? item.competition : 'Competição',
    homeTeam: { name: String(home.name ?? 'Mandante'), score: number(home.score) },
    awayTeam: { name: String(away.name ?? 'Visitante'), score: number(away.score) },
    corners: cornersRaw ? {
      home: number(cornersRaw.home),
      away: number(cornersRaw.away),
      total: number(cornersRaw.total, number(cornersRaw.home) + number(cornersRaw.away)),
    } : undefined,
    engineHistory: history,
    engineTrend: {
      status: status(rawTrend.pace ?? rawTrend.status),
      cornersDelta,
      shotsDelta,
      dangerousAttacksDelta: dangerousDelta,
      stoppedMinutesDelta: number(rawTrend.stoppedMinutesDelta),
    },
    engineUpdatedAt: typeof item.engineUpdatedAt === 'string' ? item.engineUpdatedAt : undefined,
  };
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(date);
}

function signed(value: number) { return value >= 0 ? `+${value}` : String(value); }

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-border bg-background/50 p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

function TrendIcon({ value }: { value: TrendStatus }) {
  if (value === 'accelerating') return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (value === 'cooling') return <TrendingDown className="h-4 w-4 text-amber-400" />;
  return <Activity className="h-4 w-4 text-cyan-400" />;
}

function MatchDetails({ match, lastUpdated }: { match: LiveMatch; lastUpdated: string | null }) {
  const history = match.engineHistory ?? [];
  const first = history[0];
  const latest = history[history.length - 1];

  return <div className="space-y-4">
    <section className="rounded-2xl border border-border bg-card p-5"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-sm text-muted-foreground">{match.competition}</p><h2 className="mt-1 text-2xl font-black">{match.homeTeam.name} x {match.awayTeam.name}</h2><p className="mt-1 text-sm text-muted-foreground">Última leitura: {formatTime(match.engineUpdatedAt || lastUpdated)}</p></div><div className="rounded-xl bg-emerald-500/10 px-5 py-3 text-center"><p className="text-xs text-muted-foreground">Placar · minuto</p><p className="text-2xl font-black">{match.homeTeam.score}–{match.awayTeam.score} · {match.minute}'</p></div></div></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Snapshots" value={history.length} /><Metric label="Escanteios atuais" value={match.corners?.total ?? '—'} /><Metric label="Monitorado desde" value={formatTime(first?.capturedAt)} /><Metric label="Último registro" value={formatTime(latest?.capturedAt)} /></section>
    <section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-emerald-400" /><h3 className="text-lg font-bold">Ritmo dos últimos 10 minutos</h3></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Classificação</p><p className="mt-1 flex items-center gap-2 text-lg font-bold"><TrendIcon value={match.engineTrend.status} />{labels[match.engineTrend.status]}</p></div><Metric label="Δ Escanteios" value={signed(match.engineTrend.cornersDelta)} /><Metric label="Δ Chutes" value={signed(match.engineTrend.shotsDelta)} /><Metric label="Δ Ataques perigosos" value={signed(match.engineTrend.dangerousAttacksDelta)} /><Metric label="Δ Tempo parado" value={`${match.engineTrend.stoppedMinutesDelta.toFixed(1)} min`} /></div></section>
    <section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-cyan-400" /><h3 className="text-lg font-bold">Linha do tempo registrada</h3></div><div className="mt-4 max-h-[520px] space-y-2 overflow-auto">{[...history].reverse().map((item, index) => <div key={`${item.capturedAt ?? 'snapshot'}-${index}`} className="grid gap-2 rounded-xl border border-border bg-background/40 p-3 sm:grid-cols-[90px_80px_repeat(4,minmax(0,1fr))] sm:items-center"><span className="text-xs text-muted-foreground">{formatTime(item.capturedAt)}</span><span className="font-bold">{item.minute ?? '—'}'</span><span className="flex items-center gap-1 text-sm"><Target className="h-4 w-4" />{item.homeScore}–{item.awayScore}</span><span className="flex items-center gap-1 text-sm"><CornerUpRight className="h-4 w-4 text-amber-400" />{item.corners.total ?? '—'}</span><span className="text-sm">Chutes: {item.shots.total ?? '—'}</span><span className="text-sm">Perigosos: {item.dangerousAttacks.total ?? '—'}</span></div>)}{history.length === 0 && <p className="text-sm text-muted-foreground">Nenhum snapshot registrado ainda.</p>}</div></section>
  </div>;
}

export default function LiveHistoryPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const mobileDetailsRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError(null);
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch(`/api/live/central?refresh=1&t=${Date.now()}`, {
        cache: 'no-store', signal: controller.signal, headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Falha ao atualizar histórico ao vivo');
      const next = Array.isArray(data.matches)
        ? data.matches.map(normalizeMatch).filter((item): item is LiveMatch => Boolean(item))
        : [];
      setMatches(next);
      setLastUpdated(typeof data.lastUpdated === 'string' ? data.lastUpdated : new Date().toISOString());
      setSelectedId(current => current !== null && next.some(match => match.id === current) ? current : next[0]?.id ?? null);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : 'Erro desconhecido');
    } finally {
      if (requestRef.current === controller) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => void load(false), 25_000);
    return () => { window.clearInterval(timer); requestRef.current?.abort(); };
  }, [load]);

  const selected = useMemo(() => matches.find(match => match.id === selectedId) ?? null, [matches, selectedId]);

  const selectMatch = useCallback((id: number) => {
    setSelectedId(id);
    window.requestAnimationFrame(() => {
      if (window.innerWidth < 1024) {
        window.requestAnimationFrame(() => mobileDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    });
  }, []);

  return <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 md:flex-row md:items-center md:justify-between">
      <div><p className="text-sm font-semibold text-emerald-400">Motor Central Ao Vivo</p><h1 className="mt-1 text-3xl font-black">Histórico e ritmo das partidas</h1><p className="mt-2 text-sm text-muted-foreground">Evolução registrada automaticamente a cada atualização do motor.</p></div>
      <div className="flex flex-col items-stretch gap-2 md:items-end">
        <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold hover:bg-muted disabled:cursor-wait disabled:opacity-70"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Atualizando...' : 'Atualizar'}</button>
        <span className="text-xs text-muted-foreground">Última atualização: {formatTime(lastUpdated)}</span>
      </div>
    </section>

    {refreshing && <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-200">Buscando novos dados, escanteios e estatísticas…</div>}
    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>}

    <section className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="max-h-none space-y-2 overflow-visible rounded-2xl border border-border bg-card p-3 lg:max-h-[72vh] lg:overflow-auto">
        <div className="mb-3 flex items-center justify-between px-2"><span className="font-bold">Jogos monitorados</span><span className="text-xs text-muted-foreground">{matches.length} ao vivo</span></div>
        {matches.length === 0 && !initialLoading && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhuma partida disponível neste momento.</p>}
        {matches.map(match => <div key={match.id} className="space-y-3">
          <button onClick={() => selectMatch(match.id)} className={`w-full rounded-xl border p-3 text-left transition ${match.id === selectedId ? 'border-emerald-500 bg-emerald-500/10' : 'border-border hover:bg-muted/50'}`}>
            <div className="flex items-center justify-between gap-2"><span className="truncate text-xs text-muted-foreground">{match.competition}</span><span className="text-xs font-semibold text-emerald-400">{match.minute}'</span></div>
            <p className="mt-2 font-bold">{match.homeTeam.name} x {match.awayTeam.name}</p>
            <div className="mt-2 flex items-center justify-between text-sm"><span>{match.homeTeam.score}–{match.awayTeam.score}</span><span className="flex items-center gap-1 text-xs text-muted-foreground"><TrendIcon value={match.engineTrend.status} />{labels[match.engineTrend.status]}</span></div>
          </button>
          {match.id === selectedId && <div ref={mobileDetailsRef} className="scroll-mt-24 lg:hidden"><MatchDetails match={match} lastUpdated={lastUpdated} /></div>}
        </div>)}
      </div>

      <div className="hidden space-y-4 lg:block">
        {!selected ? <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">{initialLoading ? 'Carregando partidas monitoradas...' : 'Nenhuma partida selecionada.'}</div> : <MatchDetails match={selected} lastUpdated={lastUpdated} />}
      </div>
    </section>
  </main>;
}
