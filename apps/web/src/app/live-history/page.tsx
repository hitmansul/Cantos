'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Clock3, CornerUpRight, RefreshCw, Target, TrendingDown, TrendingUp } from 'lucide-react';

interface Snapshot {
  capturedAt: string;
  minute: number | string;
  homeScore: number;
  awayScore: number;
  homeCorners: number | null;
  awayCorners: number | null;
  totalCorners: number | null;
  homeShots: number | null;
  awayShots: number | null;
  homeShotsOnTarget: number | null;
  awayShotsOnTarget: number | null;
  homeDangerousAttacks: number | null;
  awayDangerousAttacks: number | null;
  totalStoppedMinutes: number | null;
  predictedAddedMinutes: number | null;
}

interface Trend {
  status: 'accelerating' | 'stable' | 'cooling' | 'insufficient-data';
  windowMinutes: number;
  cornersDelta: number;
  shotsDelta: number;
  dangerousAttacksDelta: number;
  stoppedMinutesDelta: number;
  snapshots: number;
}

interface LiveMatch {
  id: number;
  minute: number | string;
  competition?: string;
  homeTeam: { name: string; score: number };
  awayTeam: { name: string; score: number };
  corners?: { home: number; away: number; total: number };
  engineHistory?: Snapshot[];
  engineTrend?: Trend;
  engineUpdatedAt?: string;
}

const trendLabels: Record<Trend['status'], string> = {
  accelerating: 'Acelerando',
  stable: 'Estável',
  cooling: 'Esfriando',
  'insufficient-data': 'Coletando histórico',
};

function formatTime(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function TrendIcon({ status }: { status: Trend['status'] }) {
  if (status === 'accelerating') return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (status === 'cooling') return <TrendingDown className="h-4 w-4 text-amber-400" />;
  return <Activity className="h-4 w-4 text-cyan-400" />;
}

export default function LiveHistoryPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/live/central?refresh=1', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao carregar histórico ao vivo');
      const next = Array.isArray(data.matches) ? data.matches : [];
      setMatches(next);
      setLastUpdated(data.lastUpdated || null);
      setSelectedId((current) => current && next.some((match: LiveMatch) => match.id === current) ? current : next[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 25_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const selected = useMemo(() => matches.find((match) => match.id === selectedId) ?? null, [matches, selectedId]);
  const history = selected?.engineHistory ?? [];
  const first = history[0];
  const latest = history.at(-1);
  const trend = selected?.engineTrend;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-400">Motor Central Ao Vivo</p>
          <h1 className="mt-1 text-3xl font-black">Histórico e ritmo das partidas</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Evolução registrada automaticamente a cada atualização do motor.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </section>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>}

      <section className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="max-h-[72vh] space-y-2 overflow-auto rounded-2xl border border-border bg-card p-3">
          <div className="mb-3 flex items-center justify-between px-2">
            <span className="font-bold">Jogos monitorados</span>
            <span className="text-xs text-muted-foreground">{matches.length} ao vivo</span>
          </div>
          {matches.map((match) => {
            const active = match.id === selectedId;
            const matchTrend = match.engineTrend;
            return (
              <button
                key={match.id}
                onClick={() => setSelectedId(match.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${active ? 'border-emerald-500 bg-emerald-500/10' : 'border-border hover:bg-muted/50'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">{match.competition || 'Competição'}</span>
                  <span className="text-xs font-semibold text-emerald-400">{match.minute}'</span>
                </div>
                <p className="mt-2 font-bold">{match.homeTeam.name} x {match.awayTeam.name}</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span>{match.homeTeam.score}–{match.awayTeam.score}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {matchTrend && <TrendIcon status={matchTrend.status} />}
                    {matchTrend ? trendLabels[matchTrend.status] : 'Sem leitura'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {!selected ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
              Nenhuma partida selecionada.
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{selected.competition || 'Competição'}</p>
                    <h2 className="mt-1 text-2xl font-black">{selected.homeTeam.name} x {selected.awayTeam.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Última leitura: {formatTime(selected.engineUpdatedAt || lastUpdated)}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 px-5 py-3 text-center">
                    <p className="text-xs text-muted-foreground">Placar · minuto</p>
                    <p className="text-2xl font-black">{selected.homeTeam.score}–{selected.awayTeam.score} · {selected.minute}'</p>
                  </div>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Snapshots" value={history.length} />
                <Metric label="Escanteios atuais" value={selected.corners?.total ?? '—'} />
                <Metric label="Monitorado desde" value={formatTime(first?.capturedAt)} />
                <Metric label="Último registro" value={formatTime(latest?.capturedAt)} />
              </section>

              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-emerald-400" />
                  <h3 className="text-lg font-bold">Ritmo dos últimos 10 minutos</h3>
                </div>
                {trend ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-xl border border-border p-3">
                      <p className="text-xs text-muted-foreground">Classificação</p>
                      <p className="mt-1 flex items-center gap-2 text-lg font-bold"><TrendIcon status={trend.status} />{trendLabels[trend.status]}</p>
                    </div>
                    <Metric label="Δ Escanteios" value={trend.cornersDelta >= 0 ? `+${trend.cornersDelta}` : trend.cornersDelta} />
                    <Metric label="Δ Chutes" value={trend.shotsDelta >= 0 ? `+${trend.shotsDelta}` : trend.shotsDelta} />
                    <Metric label="Δ Ataques perigosos" value={trend.dangerousAttacksDelta >= 0 ? `+${trend.dangerousAttacksDelta}` : trend.dangerousAttacksDelta} />
                    <Metric label="Δ Tempo parado" value={`${trend.stoppedMinutesDelta.toFixed(1)} min`} />
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">O motor ainda está acumulando snapshots suficientes.</p>
                )}
              </section>

              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-lg font-bold">Linha do tempo registrada</h3>
                </div>
                <div className="mt-4 max-h-[520px] space-y-2 overflow-auto">
                  {[...history].reverse().map((item, index) => (
                    <div key={`${item.capturedAt}-${index}`} className="grid gap-2 rounded-xl border border-border bg-background/40 p-3 sm:grid-cols-[90px_80px_repeat(4,minmax(0,1fr))] sm:items-center">
                      <span className="text-xs text-muted-foreground">{formatTime(item.capturedAt)}</span>
                      <span className="font-bold">{item.minute}'</span>
                      <span className="flex items-center gap-1 text-sm"><Target className="h-4 w-4" />{item.homeScore}–{item.awayScore}</span>
                      <span className="flex items-center gap-1 text-sm"><CornerUpRight className="h-4 w-4 text-amber-400" />{item.totalCorners ?? '—'}</span>
                      <span className="text-sm">Chutes: {(item.homeShots ?? 0) + (item.awayShots ?? 0)}</span>
                      <span className="text-sm">Perigosos: {(item.homeDangerousAttacks ?? 0) + (item.awayDangerousAttacks ?? 0)}</span>
                    </div>
                  ))}
                  {history.length === 0 && <p className="text-sm text-muted-foreground">Nenhum snapshot registrado ainda.</p>}
                </div>
              </section>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
