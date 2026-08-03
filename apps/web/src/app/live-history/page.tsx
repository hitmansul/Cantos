'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Clock3,
  CornerUpRight,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

type TrendStatus = 'accelerating' | 'stable' | 'cooling' | 'insufficient-data';

interface Snapshot {
  capturedAt?: string | null;
  minute?: number | string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  totalCorners?: number | null;
  homeShots?: number | null;
  awayShots?: number | null;
  homeDangerousAttacks?: number | null;
  awayDangerousAttacks?: number | null;
}

interface Trend {
  status?: TrendStatus | string | null;
  cornersDelta?: number | null;
  shotsDelta?: number | null;
  dangerousAttacksDelta?: number | null;
  stoppedMinutesDelta?: number | null;
}

interface LiveMatch {
  id: number;
  minute: number | string;
  competition?: string;
  homeTeam: { name: string; score: number };
  awayTeam: { name: string; score: number };
  corners?: { home: number; away: number; total: number };
  engineHistory: Snapshot[];
  engineTrend?: Trend;
  engineUpdatedAt?: string;
}

const trendLabels: Record<TrendStatus, string> = {
  accelerating: 'Acelerando',
  stable: 'Estável',
  cooling: 'Esfriando',
  'insufficient-data': 'Coletando histórico',
};

function asNumber(value: unknown, fallback = 0) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function validTrendStatus(value: unknown): TrendStatus {
  return value === 'accelerating' || value === 'stable' || value === 'cooling'
    ? value
    : 'insufficient-data';
}

function normalizeSnapshot(value: unknown): Snapshot | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  return {
    capturedAt: typeof item.capturedAt === 'string' ? item.capturedAt : null,
    minute:
      typeof item.minute === 'number' || typeof item.minute === 'string'
        ? item.minute
        : null,
    homeScore: asNullableNumber(item.homeScore),
    awayScore: asNullableNumber(item.awayScore),
    totalCorners: asNullableNumber(item.totalCorners ?? item.corners),
    homeShots: asNullableNumber(item.homeShots),
    awayShots: asNullableNumber(item.awayShots),
    homeDangerousAttacks: asNullableNumber(item.homeDangerousAttacks),
    awayDangerousAttacks: asNullableNumber(item.awayDangerousAttacks),
  };
}

function normalizeMatch(value: unknown): LiveMatch | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const home = item.homeTeam && typeof item.homeTeam === 'object'
    ? (item.homeTeam as Record<string, unknown>)
    : null;
  const away = item.awayTeam && typeof item.awayTeam === 'object'
    ? (item.awayTeam as Record<string, unknown>)
    : null;

  if (!home || !away) return null;

  const rawId = asNumber(item.id, NaN);
  if (!Number.isFinite(rawId)) return null;

  const cornersRaw = item.corners && typeof item.corners === 'object'
    ? (item.corners as Record<string, unknown>)
    : null;
  const history = Array.isArray(item.engineHistory)
    ? item.engineHistory.map(normalizeSnapshot).filter((entry): entry is Snapshot => Boolean(entry))
    : [];
  const trendRaw = item.engineTrend && typeof item.engineTrend === 'object'
    ? (item.engineTrend as Record<string, unknown>)
    : null;

  return {
    id: rawId,
    minute:
      typeof item.minute === 'number' || typeof item.minute === 'string'
        ? item.minute
        : '—',
    competition: typeof item.competition === 'string' ? item.competition : 'Competição',
    homeTeam: {
      name: typeof home.name === 'string' && home.name.trim() ? home.name : 'Mandante',
      score: asNumber(home.score),
    },
    awayTeam: {
      name: typeof away.name === 'string' && away.name.trim() ? away.name : 'Visitante',
      score: asNumber(away.score),
    },
    corners: cornersRaw
      ? {
          home: asNumber(cornersRaw.home),
          away: asNumber(cornersRaw.away),
          total: asNumber(cornersRaw.total, asNumber(cornersRaw.home) + asNumber(cornersRaw.away)),
        }
      : undefined,
    engineHistory: history,
    engineTrend: trendRaw
      ? {
          status: validTrendStatus(trendRaw.status),
          cornersDelta: asNullableNumber(trendRaw.cornersDelta),
          shotsDelta: asNullableNumber(trendRaw.shotsDelta),
          dangerousAttacksDelta: asNullableNumber(trendRaw.dangerousAttacksDelta),
          stoppedMinutesDelta: asNullableNumber(trendRaw.stoppedMinutesDelta),
        }
      : undefined,
    engineUpdatedAt: typeof item.engineUpdatedAt === 'string' ? item.engineUpdatedAt : undefined,
  };
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch {
    return '—';
  }
}

function signed(value?: number | null) {
  const safe = Number.isFinite(value) ? Number(value) : 0;
  return safe >= 0 ? `+${safe}` : String(safe);
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function TrendIcon({ status }: { status: TrendStatus }) {
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
      const data = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Falha ao carregar histórico ao vivo');
      }

      const next = Array.isArray(data.matches)
        ? data.matches.map(normalizeMatch).filter((match): match is LiveMatch => Boolean(match))
        : [];

      setMatches(next);
      setLastUpdated(typeof data.lastUpdated === 'string' ? data.lastUpdated : null);
      setSelectedId((current) =>
        current !== null && next.some((match) => match.id === current)
          ? current
          : next[0]?.id ?? null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 25_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const selected = useMemo(
    () => matches.find((match) => match.id === selectedId) ?? null,
    [matches, selectedId]
  );
  const history = selected?.engineHistory ?? [];
  const first = history.length > 0 ? history[0] : undefined;
  const latest = history.length > 0 ? history[history.length - 1] : undefined;
  const trendStatus = validTrendStatus(selected?.engineTrend?.status);

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

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          {error}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="max-h-[72vh] space-y-2 overflow-auto rounded-2xl border border-border bg-card p-3">
          <div className="mb-3 flex items-center justify-between px-2">
            <span className="font-bold">Jogos monitorados</span>
            <span className="text-xs text-muted-foreground">{matches.length} ao vivo</span>
          </div>

          {matches.length === 0 && !loading && (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Nenhuma partida válida foi retornada pelo motor neste momento.
            </p>
          )}

          {matches.map((match) => {
            const active = match.id === selectedId;
            const status = validTrendStatus(match.engineTrend?.status);
            return (
              <button
                key={match.id}
                onClick={() => setSelectedId(match.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">{match.competition}</span>
                  <span className="text-xs font-semibold text-emerald-400">{match.minute}'</span>
                </div>
                <p className="mt-2 font-bold">
                  {match.homeTeam.name} x {match.awayTeam.name}
                </p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span>{match.homeTeam.score}–{match.awayTeam.score}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <TrendIcon status={status} />
                    {trendLabels[status]}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {!selected ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
              {loading ? 'Carregando partidas monitoradas...' : 'Nenhuma partida selecionada.'}
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{selected.competition}</p>
                    <h2 className="mt-1 text-2xl font-black">
                      {selected.homeTeam.name} x {selected.awayTeam.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Última leitura: {formatTime(selected.engineUpdatedAt || lastUpdated)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 px-5 py-3 text-center">
                    <p className="text-xs text-muted-foreground">Placar · minuto</p>
                    <p className="text-2xl font-black">
                      {selected.homeTeam.score}–{selected.awayTeam.score} · {selected.minute}'
                    </p>
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
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-xs text-muted-foreground">Classificação</p>
                    <p className="mt-1 flex items-center gap-2 text-lg font-bold">
                      <TrendIcon status={trendStatus} />
                      {trendLabels[trendStatus]}
                    </p>
                  </div>
                  <Metric label="Δ Escanteios" value={signed(selected.engineTrend?.cornersDelta)} />
                  <Metric label="Δ Chutes" value={signed(selected.engineTrend?.shotsDelta)} />
                  <Metric
                    label="Δ Ataques perigosos"
                    value={signed(selected.engineTrend?.dangerousAttacksDelta)}
                  />
                  <Metric
                    label="Δ Tempo parado"
                    value={`${asNumber(selected.engineTrend?.stoppedMinutesDelta).toFixed(1)} min`}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-lg font-bold">Linha do tempo registrada</h3>
                </div>
                <div className="mt-4 max-h-[520px] space-y-2 overflow-auto">
                  {[...history].reverse().map((item, index) => (
                    <div
                      key={`${item.capturedAt ?? 'snapshot'}-${index}`}
                      className="grid gap-2 rounded-xl border border-border bg-background/40 p-3 sm:grid-cols-[90px_80px_repeat(4,minmax(0,1fr))] sm:items-center"
                    >
                      <span className="text-xs text-muted-foreground">{formatTime(item.capturedAt)}</span>
                      <span className="font-bold">{item.minute ?? '—'}'</span>
                      <span className="flex items-center gap-1 text-sm">
                        <Target className="h-4 w-4" />
                        {asNumber(item.homeScore)}–{asNumber(item.awayScore)}
                      </span>
                      <span className="flex items-center gap-1 text-sm">
                        <CornerUpRight className="h-4 w-4 text-amber-400" />
                        {item.totalCorners ?? '—'}
                      </span>
                      <span className="text-sm">
                        Chutes: {asNumber(item.homeShots) + asNumber(item.awayShots)}
                      </span>
                      <span className="text-sm">
                        Perigosos: {asNumber(item.homeDangerousAttacks) + asNumber(item.awayDangerousAttacks)}
                      </span>
                    </div>
                  ))}
                  {history.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum snapshot registrado ainda.</p>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
