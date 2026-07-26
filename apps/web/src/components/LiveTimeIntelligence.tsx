'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Clock3, RefreshCw, ShieldCheck, TimerReset } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type PeriodKey = 'firstHalf' | 'secondHalf';
type Incident = { durationMs?: number; consideredMs?: number; considered?: boolean; reason?: string; timeline?: string };
type Period = { totalStoppedMinutes?: number | null; rawStoppedMinutes?: number | null; consideredStoppedMinutes?: number | null; predictedAddedMinutes?: number | null; actualAddedMinutes?: number | null; incidents?: Incident[]; source?: string };
type Match = {
  id: number;
  minute: number | string;
  statusText?: string;
  competition?: string;
  homeTeam: { name: string; score: number };
  awayTeam: { name: string; score: number };
  stoppage?: { periods?: { firstHalf?: Period; secondHalf?: Period } };
  periodStoppage?: { firstHalf?: Period; secondHalf?: Period };
};

type Row = {
  key: string;
  match: Match;
  period: PeriodKey;
  raw: number | null;
  considered: number | null;
  predicted: number | null;
  official: number | null;
  stoppedInsideAdded: number;
  projectedEnd: number | null;
  remaining: number | null;
  reliability: 'confirmado' | 'estimado' | 'insuficiente';
};

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const fmt = (value: number | null, plus = false) => value == null ? 'Não informado' : `${plus ? '+' : ''}${value.toFixed(1).replace('.0', '')} min`;

function minuteValue(match: Match) {
  if (typeof match.minute === 'number') return match.minute;
  const raw = String(match.minute ?? match.statusText ?? '');
  const added = raw.match(/(45|90)\s*\+\s*(\d{1,2})/);
  if (added) return Number(added[1]) + Number(added[2]);
  return Number(raw.match(/\d{1,3}/)?.[0] ?? 0);
}

function periodOf(match: Match): PeriodKey {
  const raw = `${match.minute ?? ''} ${match.statusText ?? ''}`.toLowerCase();
  if (/45\s*\+/.test(raw) || /1h|1st|primeiro|intervalo/.test(raw)) return 'firstHalf';
  return minuteValue(match) > 45 ? 'secondHalf' : 'firstHalf';
}

function summary(match: Match, period: PeriodKey): Period | undefined {
  return match.periodStoppage?.[period] ?? match.stoppage?.periods?.[period];
}

function officialFromClock(match: Match, period: PeriodKey) {
  const raw = `${match.minute ?? ''} ${match.statusText ?? ''}`;
  const base = period === 'firstHalf' ? 45 : 90;
  const found = raw.match(new RegExp(`${base}\\s*\\+\\s*(\\d{1,2})`));
  return found ? Number(found[1]) : null;
}

function buildRow(match: Match): Row {
  const period = periodOf(match);
  const data = summary(match, period);
  const base = period === 'firstHalf' ? 45 : 90;
  const current = minuteValue(match);
  const raw = data?.rawStoppedMinutes ?? data?.totalStoppedMinutes ?? null;
  const considered = data?.consideredStoppedMinutes ?? data?.totalStoppedMinutes ?? null;
  const predicted = data?.predictedAddedMinutes ?? null;
  const official = data?.actualAddedMinutes ?? officialFromClock(match, period);
  const stoppedInsideAdded = current > base && official != null
    ? Math.max(0, (data?.incidents ?? []).filter((item) => item.considered !== false).reduce((total, item) => total + ((item.consideredMs ?? item.durationMs ?? 0) / 60000), 0) - (considered ?? 0))
    : 0;
  const effectiveAdded = official ?? predicted;
  const projectedEnd = effectiveAdded == null ? null : base + effectiveAdded + stoppedInsideAdded;
  const remaining = projectedEnd == null ? null : Math.max(0, projectedEnd - current);
  const reliability: Row['reliability'] = official != null ? 'confirmado' : predicted != null ? 'estimado' : 'insuficiente';
  return { key: `${match.id}-${period}`, match, period, raw, considered, predicted, official, stoppedInsideAdded, projectedEnd, remaining, reliability };
}

export function LiveTimeIntelligence() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/live', { cache: 'no-store' });
      const payload = await response.json() as { matches?: Match[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar a inteligência de tempo.');
      setMatches(payload.matches ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar os dados ao vivo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const timer = setInterval(() => void load(), 25000); return () => clearInterval(timer); }, [load]);

  const rows = useMemo(() => matches.map(buildRow).sort((a, b) => (b.official != null ? 1 : 0) - (a.official != null ? 1 : 0) || minuteValue(b.match) - minuteValue(a.match)), [matches]);
  const confirmed = rows.filter((row) => row.official != null).length;
  const withStoppedTime = rows.filter((row) => row.considered != null).length;

  return (
    <section className="space-y-4 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-card to-emerald-500/5 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-amber-500/30 text-amber-300"><TimerReset className="mr-1 h-3.5 w-3.5" /> Inteligência de tempo</Badge>
            <Badge variant="secondary">{confirmed} acréscimos oficiais</Badge>
            <Badge variant="secondary">{withStoppedTime} com tempo parado</Badge>
          </div>
          <h2 className="mt-3 text-xl font-black">Paralisações e acréscimos reais</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Distingue tempo bruto parado, tempo considerado pela IA, previsão e acréscimo efetivamente indicado pelo árbitro. O encerramento projetado inclui novas paralisações ocorridas durante os acréscimos.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</Button>
      </div>

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {!loading && !error && rows.length === 0 && <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Não há partidas ao vivo neste momento.</div>}

      <div className="grid gap-3 lg:grid-cols-2">
        {rows.slice(0, 8).map((row) => (
          <Card key={row.key} className="overflow-hidden p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="truncate text-xs text-muted-foreground">{row.match.competition || 'Competição'}</p><h3 className="mt-1 break-words font-black">{row.match.homeTeam.name} x {row.match.awayTeam.name}</h3><p className="mt-1 text-sm text-muted-foreground">{row.period === 'firstHalf' ? '1º tempo' : '2º tempo'} · {String(row.match.minute || row.match.statusText || 'Ao vivo')}</p></div>
              <Badge className={row.reliability === 'confirmado' ? 'bg-emerald-500/15 text-emerald-300' : row.reliability === 'estimado' ? 'bg-amber-500/15 text-amber-300' : 'bg-muted text-muted-foreground'}>{row.reliability}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label="Tempo bruto parado" value={fmt(row.raw)} icon={Activity} />
              <Metric label="Tempo considerado" value={fmt(row.considered)} icon={ShieldCheck} />
              <Metric label="Previsão da IA" value={fmt(row.predicted, true)} icon={Clock3} />
              <Metric label="Acréscimo do árbitro" value={fmt(row.official, true)} icon={Clock3} emphasized />
              <Metric label="Parado nos acréscimos" value={fmt(row.stoppedInsideAdded || null)} icon={AlertTriangle} />
              <Metric label="Tempo real restante" value={fmt(row.remaining)} icon={TimerReset} emphasized />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Encerramento projetado: {row.projectedEnd == null ? 'não calculado' : `${row.projectedEnd.toFixed(1).replace('.0', '')}'`}. Valores ausentes não são simulados.</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, icon: Icon, emphasized = false }: { label: string; value: string; icon: typeof Clock3; emphasized?: boolean }) {
  return <div className={`rounded-xl border p-3 ${emphasized ? 'border-emerald-500/25 bg-emerald-500/5' : 'bg-background/40'}`}><div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div><p className={`mt-1 text-sm font-black ${emphasized ? 'text-emerald-300' : ''}`}>{value}</p></div>;
}
