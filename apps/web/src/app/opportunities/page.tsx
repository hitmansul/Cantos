'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, RefreshCw, Sparkles } from 'lucide-react';

type Alert = {
  id: string;
  eventId: number;
  startTime: string;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  marketName: string;
  selectionLabel: string;
  bestBookmaker: string;
  bestOdd: number;
  medianOdd: number;
  edgePct: number;
  confidence: string;
  bookmakersCompared: number;
};

type Payload = { configured: boolean; alerts: Alert[]; lastUpdated: string; note?: string };

export default function OpportunitiesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [minimumEdge, setMinimumEdge] = useState(8);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/odds/alerts?scope=all', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? 'Não foi possível carregar as oportunidades.');
      setData(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar oportunidades.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const alerts = useMemo(
    () => (data?.alerts ?? []).filter((alert) => alert.edgePct >= minimumEdge).sort((a, b) => b.edgePct - a.edgePct),
    [data, minimumEdge]
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-bold text-primary"><Sparkles className="h-4 w-4" /> Opportunity Feed</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Oportunidades do mercado</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Área independente das estatísticas das ligas. Aqui o sistema reúne somente mercados com diferença relevante entre casas.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </header>

      <section className="mt-6 rounded-2xl border bg-card p-4">
        <label className="flex flex-col gap-2 text-sm font-semibold sm:max-w-sm">Valor mínimo sobre a mediana: {minimumEdge}%
          <input type="range" min="0" max="30" value={minimumEdge} onChange={(event) => setMinimumEdge(Number(event.target.value))} />
        </label>
      </section>

      {error && <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">{error}</div>}
      {!loading && !error && alerts.length === 0 && <div className="mt-5 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Nenhuma oportunidade atende ao filtro atual.</div>}

      <section className="mt-5 grid gap-4">
        {alerts.map((alert, index) => (
          <article key={alert.id} className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-primary/10 px-2 py-1 font-bold text-primary">#{index + 1}</span><span>{alert.leagueName}</span><span>•</span><span>{new Date(alert.startTime).toLocaleString('pt-BR')}</span></div>
                <h2 className="mt-2 break-words text-xl font-black">{alert.homeTeam} x {alert.awayTeam}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{alert.marketName} — {alert.selectionLabel}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Melhor casa" value={alert.bestBookmaker} />
                <Metric label="Odd" value={alert.bestOdd.toFixed(2)} />
                <Metric label="Valor" value={`+${alert.edgePct.toFixed(1)}%`} />
                <Metric label="Casas" value={String(alert.bookmakersCompared)} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 border-t pt-4">
              <Link href={`/odds-intelligence?home=${encodeURIComponent(alert.homeTeam)}&away=${encodeURIComponent(alert.awayTeam)}&date=${encodeURIComponent(alert.startTime.slice(0, 10))}&competition=${encodeURIComponent(alert.leagueName)}`} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Comparar casas <ArrowRight className="h-4 w-4" /></Link>
              <Link href={`/market-replay?home=${encodeURIComponent(alert.homeTeam)}&away=${encodeURIComponent(alert.awayTeam)}`} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold">Abrir Market Replay</Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl bg-muted/50 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 truncate font-black" title={value}>{value}</div></div>;
}
