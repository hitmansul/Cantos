'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BrainCircuit, RefreshCw, Search, Sparkles } from 'lucide-react';

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

const confidenceOrder: Record<string, number> = { high: 3, alta: 3, medium: 2, media: 2, média: 2, low: 1, baixa: 1 };

function confidenceLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === 'high' || normalized === 'alta') return 'Alta';
  if (normalized === 'medium' || normalized === 'media' || normalized === 'média') return 'Média';
  if (normalized === 'low' || normalized === 'baixa') return 'Baixa';
  return value || 'Não informada';
}

function isCornerMarket(alert: Alert) {
  return `${alert.marketName} ${alert.selectionLabel}`.toLowerCase().includes('corner') || `${alert.marketName} ${alert.selectionLabel}`.toLowerCase().includes('escante');
}

export default function OpportunitiesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [minimumEdge, setMinimumEdge] = useState(8);
  const [onlyCorners, setOnlyCorners] = useState(true);
  const [minimumConfidence, setMinimumConfidence] = useState('all');
  const [query, setQuery] = useState('');

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

  const alerts = useMemo(() => {
    const minimumConfidenceValue = minimumConfidence === 'all' ? 0 : confidenceOrder[minimumConfidence] ?? 0;
    const normalizedQuery = query.trim().toLowerCase();
    return (data?.alerts ?? [])
      .filter((alert) => alert.edgePct >= minimumEdge)
      .filter((alert) => !onlyCorners || isCornerMarket(alert))
      .filter((alert) => (confidenceOrder[alert.confidence.toLowerCase()] ?? 0) >= minimumConfidenceValue)
      .filter((alert) => !normalizedQuery || `${alert.homeTeam} ${alert.awayTeam} ${alert.leagueName} ${alert.marketName}`.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => b.edgePct - a.edgePct || b.bookmakersCompared - a.bookmakersCompared);
  }, [data, minimumEdge, onlyCorners, minimumConfidence, query]);

  const summary = useMemo(() => ({
    total: alerts.length,
    strong: alerts.filter((alert) => alert.edgePct >= 15).length,
    averageEdge: alerts.length ? alerts.reduce((sum, alert) => sum + alert.edgePct, 0) / alerts.length : 0,
    leagues: new Set(alerts.map((alert) => alert.leagueName)).size,
  }), [alerts]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-bold text-primary"><Sparkles className="h-4 w-4" /> Radar de oportunidades</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Onde as casas estão divergindo</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">Esta tela identifica diferença de preço entre casas. Ela não garante uma boa aposta: use o botão <b>Analisar com a IA</b> para validar histórico, probabilidade, EV, risco e entrada sugerida.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Oportunidades no filtro" value={String(summary.total)} />
        <Metric label="Diferença acima de 15%" value={String(summary.strong)} />
        <Metric label="Diferença média" value={`${summary.averageEdge.toFixed(1)}%`} />
        <Metric label="Competições" value={String(summary.leagues)} />
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-2 text-sm font-semibold">Diferença mínima entre casas: {minimumEdge}%
            <input type="range" min="0" max="30" value={minimumEdge} onChange={(event) => setMinimumEdge(Number(event.target.value))} />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Confiança informada
            <select value={minimumConfidence} onChange={(event) => setMinimumConfidence(event.target.value)} className="min-h-11 rounded-xl border bg-background px-3">
              <option value="all">Todas</option><option value="low">Baixa ou superior</option><option value="medium">Média ou superior</option><option value="high">Somente alta</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Pesquisar partida ou competição
            <div className="flex min-h-11 items-center gap-2 rounded-xl border bg-background px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: Fluminense" className="w-full bg-transparent outline-none" /></div>
          </label>
          <label className="flex items-center gap-3 self-end rounded-xl border bg-background p-3 text-sm font-semibold"><input type="checkbox" checked={onlyCorners} onChange={(event) => setOnlyCorners(event.target.checked)} /> Mostrar somente escanteios</label>
        </div>
      </section>

      <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
        <p className="font-black">Como interpretar</p>
        <p className="mt-1 text-muted-foreground"><b>Diferença entre casas</b> mostra que uma casa está pagando mais que a mediana. <b>Valor estatístico</b> só existe quando a probabilidade calculada pela IA também supera a probabilidade implícita da odd.</p>
      </div>

      {error && <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">{error}</div>}
      {!loading && !error && alerts.length === 0 && <div className="mt-5 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Nenhuma oportunidade atende aos filtros atuais.</div>}

      <section className="mt-5 grid gap-4">
        {alerts.map((alert, index) => {
          const analysisUrl = `/ia-cantos?home=${encodeURIComponent(alert.homeTeam)}&away=${encodeURIComponent(alert.awayTeam)}&date=${encodeURIComponent(alert.startTime.slice(0, 10))}&competition=${encodeURIComponent(alert.leagueName)}`;
          return (
            <article key={alert.id} className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-primary/10 px-2 py-1 font-bold text-primary">#{index + 1}</span><span>{alert.leagueName}</span><span>•</span><span>{new Date(alert.startTime).toLocaleString('pt-BR')}</span><span>•</span><span>Confiança: {confidenceLabel(alert.confidence)}</span></div>
                  <h2 className="mt-2 break-words text-xl font-black">{alert.homeTeam} x {alert.awayTeam}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{alert.marketName} — {alert.selectionLabel}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric label="Melhor casa" value={alert.bestBookmaker} />
                  <Metric label="Melhor odd" value={alert.bestOdd.toFixed(2)} />
                  <Metric label="Acima da mediana" value={`+${alert.edgePct.toFixed(1)}%`} />
                  <Metric label="Casas comparadas" value={String(alert.bookmakersCompared)} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 border-t pt-4">
                {isCornerMarket(alert) && <Link href={analysisUrl} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><BrainCircuit className="h-4 w-4" /> Analisar com a IA <ArrowRight className="h-4 w-4" /></Link>}
                <Link href={`/odds-intelligence?home=${encodeURIComponent(alert.homeTeam)}&away=${encodeURIComponent(alert.awayTeam)}&date=${encodeURIComponent(alert.startTime.slice(0, 10))}&competition=${encodeURIComponent(alert.leagueName)}`} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold">Comparar todas as casas</Link>
                <Link href={`/market-replay?home=${encodeURIComponent(alert.homeTeam)}&away=${encodeURIComponent(alert.awayTeam)}`} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold">Ver movimento das odds</Link>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl bg-muted/50 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 truncate font-black" title={value}>{value}</div></div>;
}
