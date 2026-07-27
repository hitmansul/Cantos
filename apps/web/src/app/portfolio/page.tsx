'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, Gauge, Layers3, ShieldCheck, Target } from 'lucide-react';
import { operationProfit, readPerformanceOperations, type PerformanceOperation } from '@/lib/performanceOperations';

const SETTINGS_KEY = 'ia-cantos-portfolio-settings-v1';

type PortfolioSettings = {
  initialBankroll: number;
  maxMatchExposurePct: number;
  maxLeagueExposurePct: number;
  maxDailyExposurePct: number;
  kellyFraction: 0.25 | 0.5 | 1;
};

const defaults: PortfolioSettings = {
  initialBankroll: 1000,
  maxMatchExposurePct: 5,
  maxLeagueExposurePct: 15,
  maxDailyExposurePct: 25,
  kellyFraction: 0.5,
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (value: number) => `${value.toFixed(1)}%`;

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function groupExposure(operations: PerformanceOperation[], key: (item: PerformanceOperation) => string) {
  const grouped = new Map<string, number>();
  operations.forEach((operation) => grouped.set(key(operation), (grouped.get(key(operation)) || 0) + operation.stake));
  return [...grouped.entries()].sort((a, b) => b[1] - a[1]);
}

export default function PortfolioPage() {
  const [operations, setOperations] = useState<PerformanceOperation[]>([]);
  const [settings, setSettings] = useState<PortfolioSettings>(defaults);
  const [probability, setProbability] = useState(58);
  const [odds, setOdds] = useState(1.9);

  useEffect(() => {
    setOperations(readPerformanceOperations());
    try {
      const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || 'null');
      if (saved) setSettings({ ...defaults, ...saved });
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const metrics = useMemo(() => {
    const settled = operations.filter((operation) => operation.result !== 'open');
    const open = operations.filter((operation) => operation.result === 'open');
    const profit = sum(settled.map(operationProfit));
    const settledStake = sum(settled.map((operation) => operation.stake));
    const openExposure = sum(open.map((operation) => operation.stake));
    const bankroll = settings.initialBankroll + profit;
    const roi = settledStake ? (profit / settledStake) * 100 : 0;
    const exposurePct = bankroll > 0 ? (openExposure / bankroll) * 100 : 0;
    return { settled, open, profit, settledStake, openExposure, bankroll, roi, exposurePct };
  }, [operations, settings.initialBankroll]);

  const byMatch = useMemo(() => groupExposure(metrics.open, (operation) => operation.match), [metrics.open]);
  const byLeague = useMemo(() => groupExposure(metrics.open, (operation) => operation.league), [metrics.open]);
  const byMarket = useMemo(() => groupExposure(metrics.open, (operation) => operation.market), [metrics.open]);

  const alerts = useMemo(() => {
    const result: string[] = [];
    const bankroll = Math.max(metrics.bankroll, 1);
    byMatch.forEach(([name, exposure]) => {
      if ((exposure / bankroll) * 100 > settings.maxMatchExposurePct) result.push(`Exposição elevada na partida ${name}: ${pct((exposure / bankroll) * 100)}.`);
    });
    byLeague.forEach(([name, exposure]) => {
      if ((exposure / bankroll) * 100 > settings.maxLeagueExposurePct) result.push(`Concentração elevada na liga ${name}: ${pct((exposure / bankroll) * 100)}.`);
    });
    if (metrics.exposurePct > settings.maxDailyExposurePct) result.push(`Exposição total aberta acima do limite diário: ${pct(metrics.exposurePct)}.`);
    if (!metrics.open.length) result.push('Nenhuma operação aberta. A exposição atual da banca está zerada.');
    return result;
  }, [byLeague, byMatch, metrics, settings]);

  const kelly = useMemo(() => {
    const p = probability / 100;
    const b = odds - 1;
    const raw = b > 0 ? Math.max(0, (b * p - (1 - p)) / b) : 0;
    const adjusted = raw * settings.kellyFraction;
    const riskCap = Math.min(settings.maxMatchExposurePct / 100, 0.05);
    const recommendedPct = Math.min(adjusted, riskCap);
    return { raw, adjusted, recommendedPct, stake: metrics.bankroll * recommendedPct };
  }, [metrics.bankroll, odds, probability, settings]);

  const card = 'rounded-2xl border bg-card p-5 shadow-sm';

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section>
        <p className="text-sm font-semibold text-primary">Portfolio Engine</p>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de banca e risco</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Centraliza resultado, exposição, concentração e recomendação de stake com base nas operações registradas em Minha Performance.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ['Banca inicial', money.format(settings.initialBankroll), Banknote],
          ['Banca atual', money.format(metrics.bankroll), ShieldCheck],
          ['Lucro/prejuízo', money.format(metrics.profit), Target],
          ['ROI', pct(metrics.roi), Gauge],
          ['Exposição aberta', money.format(metrics.openExposure), Layers3],
          ['Exposição da banca', pct(metrics.exposurePct), AlertTriangle],
        ].map(([label, value, Icon]) => (
          <article key={String(label)} className={card}>
            <Icon className="mb-3 h-5 w-5 text-primary" />
            <p className="text-xs font-semibold uppercase text-muted-foreground">{String(label)}</p>
            <p className="mt-1 text-xl font-bold">{String(value)}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className={`${card} lg:col-span-2`}>
          <h2 className="text-xl font-bold">Limites de risco</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">Banca inicial (R$)<input className="w-full rounded-xl border bg-background px-3 py-2" type="number" min="1" value={settings.initialBankroll} onChange={(event) => setSettings({ ...settings, initialBankroll: Number(event.target.value) || 0 })} /></label>
            <label className="space-y-1 text-sm">Limite por partida (%)<input className="w-full rounded-xl border bg-background px-3 py-2" type="number" min="1" max="100" value={settings.maxMatchExposurePct} onChange={(event) => setSettings({ ...settings, maxMatchExposurePct: Number(event.target.value) || 0 })} /></label>
            <label className="space-y-1 text-sm">Limite por liga (%)<input className="w-full rounded-xl border bg-background px-3 py-2" type="number" min="1" max="100" value={settings.maxLeagueExposurePct} onChange={(event) => setSettings({ ...settings, maxLeagueExposurePct: Number(event.target.value) || 0 })} /></label>
            <label className="space-y-1 text-sm">Limite diário (%)<input className="w-full rounded-xl border bg-background px-3 py-2" type="number" min="1" max="100" value={settings.maxDailyExposurePct} onChange={(event) => setSettings({ ...settings, maxDailyExposurePct: Number(event.target.value) || 0 })} /></label>
          </div>
        </article>

        <article className={card}>
          <h2 className="text-xl font-bold">Alertas inteligentes</h2>
          <div className="mt-4 space-y-3">
            {alerts.map((alert) => <div key={alert} className="rounded-xl border bg-muted/40 p-3 text-sm">{alert}</div>)}
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {[['Por partida', byMatch, settings.maxMatchExposurePct], ['Por liga', byLeague, settings.maxLeagueExposurePct], ['Por mercado', byMarket, settings.maxLeagueExposurePct]].map(([title, rows, limit]) => (
          <article key={String(title)} className={card}>
            <h2 className="text-lg font-bold">Exposição {String(title).toLowerCase()}</h2>
            <div className="mt-4 space-y-3">
              {(rows as [string, number][]).length ? (rows as [string, number][]).slice(0, 8).map(([name, value]) => {
                const percentage = metrics.bankroll > 0 ? (value / metrics.bankroll) * 100 : 0;
                return <div key={name}><div className="flex justify-between gap-3 text-sm"><span className="truncate">{name}</span><strong>{money.format(value)} · {pct(percentage)}</strong></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (percentage / Number(limit)) * 100)}%` }} /></div></div>;
              }) : <p className="text-sm text-muted-foreground">Sem operações abertas.</p>}
            </div>
          </article>
        ))}
      </section>

      <section className={`${card} grid gap-6 lg:grid-cols-2`}>
        <div>
          <h2 className="text-xl font-bold">Simulador de stake</h2>
          <p className="mt-1 text-sm text-muted-foreground">Compara a vantagem estimada com a cotação e aplica Kelly limitado pelo teto de risco por partida.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">Probabilidade da IA (%)<input className="w-full rounded-xl border bg-background px-3 py-2" type="number" min="1" max="99" value={probability} onChange={(event) => setProbability(Number(event.target.value) || 0)} /></label>
            <label className="space-y-1 text-sm">Cotação decimal<input className="w-full rounded-xl border bg-background px-3 py-2" type="number" min="1.01" step="0.01" value={odds} onChange={(event) => setOdds(Number(event.target.value) || 0)} /></label>
            <label className="space-y-1 text-sm sm:col-span-2">Perfil Kelly<select className="w-full rounded-xl border bg-background px-3 py-2" value={settings.kellyFraction} onChange={(event) => setSettings({ ...settings, kellyFraction: Number(event.target.value) as PortfolioSettings['kellyFraction'] })}><option value={0.25}>Conservador — ¼ Kelly</option><option value={0.5}>Equilibrado — ½ Kelly</option><option value={1}>Agressivo — Kelly integral</option></select></label>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border bg-muted/30 p-4"><p className="text-sm text-muted-foreground">Kelly integral</p><p className="text-2xl font-bold">{pct(kelly.raw * 100)}</p></div>
          <div className="rounded-2xl border bg-muted/30 p-4"><p className="text-sm text-muted-foreground">Kelly do perfil</p><p className="text-2xl font-bold">{pct(kelly.adjusted * 100)}</p></div>
          <div className="rounded-2xl border bg-muted/30 p-4"><p className="text-sm text-muted-foreground">Percentual recomendado</p><p className="text-2xl font-bold">{pct(kelly.recommendedPct * 100)}</p></div>
          <div className="rounded-2xl border bg-primary/10 p-4"><p className="text-sm text-muted-foreground">Stake recomendada</p><p className="text-2xl font-bold">{money.format(kelly.stake)}</p></div>
          <p className="text-xs text-muted-foreground sm:col-span-2">A recomendação é matemática e limitada pelo risco configurado. Não representa garantia de resultado.</p>
        </div>
      </section>
    </main>
  );
}
