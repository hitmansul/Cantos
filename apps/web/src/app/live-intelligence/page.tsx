'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, RefreshCw, Sparkles, Target, TrendingUp } from 'lucide-react';

type NumericPair = { home?: number | null; away?: number | null; total?: number | null };
type EngineTrend = {
  pace?: 'accelerating' | 'stable' | 'cooling' | 'insufficient-data';
  samples?: number;
  cornersDelta?: NumericPair;
  shotsDelta?: NumericPair;
  shotsOnTargetDelta?: NumericPair;
  dangerousAttacksDelta?: NumericPair;
};
type Snapshot = {
  minuteNumber?: number | null;
  corners?: NumericPair;
  shots?: NumericPair;
  shotsOnTarget?: NumericPair;
  dangerousAttacks?: NumericPair;
};
type LiveMatch = {
  id: number;
  minute: number | string;
  competition?: string;
  homeTeam: { name: string; score: number };
  awayTeam: { name: string; score: number };
  corners?: { home: number; away: number; total: number };
  engineHistory?: Snapshot[];
  engineTrend?: EngineTrend;
  engineSnapshotCount?: number;
  engineUpdatedAt?: string;
};

type Intelligence = {
  match: LiveMatch;
  score: number;
  confidence: number;
  projectedCorners: number | null;
  currentCorners: number | null;
  recentCorners: number;
  recentShots: number;
  recentShotsOnTarget: number;
  recentDangerousAttacks: number;
  pace: 'accelerating' | 'stable' | 'cooling' | 'insufficient-data';
  decision: 'ANALISAR' | 'AGUARDAR' | 'SEM DADOS';
  reasons: string[];
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

function minuteOf(value: number | string) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const match = String(value).match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/);
  return match ? Number(match[1]) + Number(match[2] ?? 0) : 0;
}

function total(pair?: NumericPair) {
  return nullable(pair?.total) ?? ((nullable(pair?.home) ?? 0) + (nullable(pair?.away) ?? 0));
}

function buildIntelligence(match: LiveMatch): Intelligence {
  const trend = match.engineTrend;
  const pace = trend?.pace ?? 'insufficient-data';
  const minute = minuteOf(match.minute);
  const currentCorners = nullable(match.corners?.total);
  const recentCorners = total(trend?.cornersDelta);
  const recentShots = total(trend?.shotsDelta);
  const recentShotsOnTarget = total(trend?.shotsOnTargetDelta);
  const recentDangerousAttacks = total(trend?.dangerousAttacksDelta);
  const samples = number(trend?.samples, number(match.engineSnapshotCount));

  const elapsed = Math.max(1, minute);
  const cornerRate = currentCorners === null ? null : currentCorners / elapsed;
  const projectedCorners = cornerRate === null ? null : Math.round(cornerRate * 90 * 10) / 10;

  let score = 20;
  score += Math.min(24, recentCorners * 8);
  score += Math.min(20, recentShotsOnTarget * 5);
  score += Math.min(16, recentShots * 2);
  score += Math.min(20, recentDangerousAttacks * 0.8);
  if (pace === 'accelerating') score += 15;
  if (pace === 'stable') score += 6;
  if (pace === 'cooling') score -= 10;
  if (minute >= 55 && minute <= 85) score += 5;
  if (currentCorners !== null && currentCorners >= 6) score += 5;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const dataSignals = [currentCorners !== null, samples >= 2, recentShots > 0, recentDangerousAttacks > 0].filter(Boolean).length;
  const confidence = Math.min(100, Math.round((dataSignals / 4) * 70 + Math.min(30, samples * 5)));

  const reasons: string[] = [];
  if (pace === 'accelerating') reasons.push('Ritmo recente em aceleração.');
  if (recentCorners > 0) reasons.push(`${recentCorners} escanteio(s) na janela recente.`);
  if (recentShotsOnTarget > 0) reasons.push(`${recentShotsOnTarget} chute(s) no alvo na janela recente.`);
  if (recentDangerousAttacks > 0) reasons.push(`${recentDangerousAttacks} ataque(s) perigoso(s) recentes.`);
  if (projectedCorners !== null) reasons.push(`Projeção atual de ${projectedCorners} escanteios até 90 minutos.`);
  if (reasons.length === 0) reasons.push('O motor ainda está acumulando sinais suficientes.');

  const decision: Intelligence['decision'] =
    confidence < 35 || samples < 2
      ? 'SEM DADOS'
      : score >= 70
        ? 'ANALISAR'
        : 'AGUARDAR';

  return {
    match,
    score,
    confidence,
    projectedCorners,
    currentCorners,
    recentCorners,
    recentShots,
    recentShotsOnTarget,
    recentDangerousAttacks,
    pace,
    decision,
    reasons,
  };
}

function paceLabel(value: Intelligence['pace']) {
  if (value === 'accelerating') return 'Acelerando';
  if (value === 'stable') return 'Estável';
  if (value === 'cooling') return 'Esfriando';
  return 'Coletando histórico';
}

export default function LiveIntelligencePage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const suffix = force ? `?refresh=1&history=summary&t=${Date.now()}` : '?history=summary';
      const response = await fetch(`/api/live/central${suffix}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao carregar inteligência ao vivo');
      setMatches(Array.isArray(data.matches) ? data.matches : []);
      setLastUpdated(typeof data.lastUpdated === 'string' ? data.lastUpdated : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const ranking = useMemo(
    () => matches.map(buildIntelligence).sort((a, b) => b.score - a.score),
    [matches]
  );

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-400"><Sparkles className="h-4 w-4" /> Motor Central Ao Vivo</p>
            <h1 className="mt-1 text-3xl font-black">Ranking de inteligência ao vivo</h1>
            <p className="mt-2 text-sm text-muted-foreground">Prioriza partidas por ritmo, pressão e qualidade dos dados. Não representa recomendação automática de aposta.</p>
          </div>
          <button onClick={() => void load(true)} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 font-bold disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Última leitura: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('pt-BR') : '—'}</p>
      </section>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>}
      {loading && <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-cyan-200">Analisando ritmo, escanteios e pressão dos jogos ao vivo…</div>}

      {!loading && ranking.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">Nenhuma partida ao vivo disponível neste momento.</div>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        {ranking.map((item, index) => (
          <article key={item.match.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-emerald-400">#{index + 1} · {item.decision}</p>
                <h2 className="mt-1 text-xl font-black">{item.match.homeTeam.name} x {item.match.awayTeam.name}</h2>
                <p className="text-sm text-muted-foreground">{item.match.competition || 'Competição'} · {item.match.minute}' · {item.match.homeTeam.score}–{item.match.awayTeam.score}</p>
              </div>
              <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-center">
                <p className="text-xs text-muted-foreground">Score</p>
                <p className="text-2xl font-black">{item.score}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Confiança</p><p className="mt-1 font-bold">{item.confidence}%</p></div>
              <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Escanteios</p><p className="mt-1 font-bold">{item.currentCorners ?? '—'}</p></div>
              <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Projeção</p><p className="mt-1 font-bold">{item.projectedCorners ?? '—'}</p></div>
              <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Ritmo</p><p className="mt-1 font-bold">{paceLabel(item.pace)}</p></div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-xl bg-background/40 p-3"><Target className="h-4 w-4 text-amber-400" /><span className="text-sm">Δ cantos: <strong>{item.recentCorners}</strong></span></div>
              <div className="flex items-center gap-2 rounded-xl bg-background/40 p-3"><TrendingUp className="h-4 w-4 text-cyan-400" /><span className="text-sm">Δ chutes: <strong>{item.recentShots}</strong></span></div>
              <div className="flex items-center gap-2 rounded-xl bg-background/40 p-3"><Activity className="h-4 w-4 text-emerald-400" /><span className="text-sm">Δ perigosos: <strong>{item.recentDangerousAttacks}</strong></span></div>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background/40 p-4">
              <p className="flex items-center gap-2 text-sm font-bold"><AlertTriangle className="h-4 w-4" /> Leitura do motor</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {item.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
              </ul>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
