'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, Gauge, Layers3, ShieldCheck, Target } from 'lucide-react';
import { operationProfit, readPerformanceOperations, type PerformanceOperation } from '@/lib/performanceOperations';
import { formatUnits, readBankrollValue, readBettingUnitValue, readMaxDailyUnits, readMaxEntryUnits, stakeToUnits, unitsToStake } from '@/lib/unitSettings';

const SETTINGS_KEY = 'ia-cantos-portfolio-settings-v1';
type PortfolioSettings = { maxMatchExposurePct: number; maxLeagueExposurePct: number; kellyFraction: 0.25 | 0.5 | 1 };
const defaults: PortfolioSettings = { maxMatchExposurePct: 5, maxLeagueExposurePct: 15, kellyFraction: 0.5 };
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (value: number) => `${value.toFixed(1)}%`;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const roundDownQuarter = (value: number) => Math.max(0, Math.floor((value + 1e-9) * 4) / 4);

function groupExposure(operations: PerformanceOperation[], key: (item: PerformanceOperation) => string) {
  const grouped = new Map<string, number>();
  operations.forEach((operation) => grouped.set(key(operation), (grouped.get(key(operation)) || 0) + operation.stake));
  return [...grouped.entries()].sort((a, b) => b[1] - a[1]);
}

export default function PortfolioPage() {
  const [operations, setOperations] = useState<PerformanceOperation[]>([]);
  const [settings, setSettings] = useState<PortfolioSettings>(defaults);
  const [bankrollBase, setBankrollBase] = useState(1000);
  const [unitValue, setUnitValue] = useState(100);
  const [maxEntryUnits, setMaxEntryUnits] = useState(1);
  const [maxDailyUnits, setMaxDailyUnits] = useState(4);
  const [probability, setProbability] = useState(58);
  const [odds, setOdds] = useState(1.9);

  useEffect(() => {
    setOperations(readPerformanceOperations());
    setBankrollBase(readBankrollValue());
    setUnitValue(readBettingUnitValue());
    setMaxEntryUnits(readMaxEntryUnits());
    setMaxDailyUnits(readMaxDailyUnits());
    try {
      const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || 'null');
      if (saved) setSettings({ ...defaults, ...saved });
    } catch {}
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const metrics = useMemo(() => {
    const settled = operations.filter((operation) => operation.result !== 'open');
    const open = operations.filter((operation) => operation.result === 'open');
    const profit = sum(settled.map(operationProfit));
    const settledStake = sum(settled.map((operation) => operation.stake));
    const openExposure = sum(open.map((operation) => operation.stake));
    const bankroll = bankrollBase + profit;
    const roi = settledStake ? (profit / settledStake) * 100 : 0;
    const exposurePct = bankroll > 0 ? (openExposure / bankroll) * 100 : 0;
    const today = new Date().toISOString().slice(0, 10);
    const todayStake = sum(
      operations
        .filter((operation) => String(operation.date).slice(0, 10) === today)
        .map((operation) => operation.stake),
    );
    const todayUnits = stakeToUnits(todayStake, unitValue);
    const dailyRemainingUnits = Math.max(0, maxDailyUnits - todayUnits);
    return { settled, open, profit, settledStake, openExposure, bankroll, roi, exposurePct, todayUnits, dailyRemainingUnits };
  }, [operations, bankrollBase, unitValue, maxDailyUnits]);

  const byMatch = useMemo(() => groupExposure(metrics.open, (operation) => operation.match), [metrics.open]);
  const byLeague = useMemo(() => groupExposure(metrics.open, (operation) => operation.league), [metrics.open]);
  const byMarket = useMemo(() => groupExposure(metrics.open, (operation) => operation.market), [metrics.open]);

  const alerts = useMemo(() => {
    const result: string[] = [];
    const bankroll = Math.max(metrics.bankroll, 1);
    byMatch.forEach(([name, exposure]) => {
      if ((exposure / bankroll) * 100 > settings.maxMatchExposurePct) {
        result.push(`Exposição elevada na partida ${name}: ${pct((exposure / bankroll) * 100)}.`);
      }
    });
    byLeague.forEach(([name, exposure]) => {
      if ((exposure / bankroll) * 100 > settings.maxLeagueExposurePct) {
        result.push(`Concentração elevada na liga ${name}: ${pct((exposure / bankroll) * 100)}.`);
      }
    });
    if (metrics.todayUnits >= maxDailyUnits) {
      result.push(`Limite diário atingido: ${formatUnits(metrics.todayUnits)} de ${formatUnits(maxDailyUnits)}.`);
    } else if (metrics.todayUnits >= maxDailyUnits * 0.75) {
      result.push(`Atenção: ${formatUnits(metrics.todayUnits)} já utilizadas hoje; restam ${formatUnits(metrics.dailyRemainingUnits)}.`);
    }
    if (!metrics.open.length) result.push('Nenhuma operação aberta. A exposição atual da banca está zerada.');
    return result;
  }, [byLeague, byMatch, metrics, settings, maxDailyUnits]);

  const kelly = useMemo(() => {
    const p = probability / 100;
    const b = odds - 1;
    const raw = b > 0 ? Math.max(0, (b * p - (1 - p)) / b) : 0;
    const adjusted = raw * settings.kellyFraction;
    const percentageCap = Math.min(settings.maxMatchExposurePct / 100, 0.05);
    const mathematicalStake = metrics.bankroll * Math.min(adjusted, percentageCap);
    const mathematicalUnits = stakeToUnits(mathematicalStake, unitValue);
    const recommendedUnits = roundDownQuarter(Math.min(mathematicalUnits, maxEntryUnits, metrics.dailyRemainingUnits));
    return { raw, adjusted, mathematicalStake, mathematicalUnits, recommendedUnits, stake: unitsToStake(recommendedUnits, unitValue) };
  }, [metrics.bankroll, metrics.dailyRemainingUnits, odds, probability, settings, unitValue, maxEntryUnits]);

  const card = 'rounded-2xl border bg-card p-5 shadow-sm';

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section>
        <p className="text-sm font-semibold text-primary">Portfolio Engine 2.0</p>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de banca, unidades e risco</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Centraliza resultado, exposição, concentração e dimensionamento de stake usando a unidade definida pelo usuário.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-8">
        <Metric icon={Banknote} label="Banca atual" value={money.format(metrics.bankroll)} />
        <Metric icon={Target} label="Lucro/prejuízo" value={money.format(metrics.profit)} detail={formatUnits(stakeToUnits(metrics.profit, unitValue))} />
        <Metric icon={Gauge} label="ROI" value={pct(metrics.roi)} />
        <Metric icon={Layers3} label="Exposição aberta" value={money.format(metrics.openExposure)} detail={formatUnits(stakeToUnits(metrics.openExposure, unitValue))} />
        <Metric icon={AlertTriangle} label="Exposição da banca" value={pct(metrics.exposurePct)} />
        <Metric icon={ShieldCheck} label="Valor de 1 U" value={money.format(unitValue)} />
        <Metric icon={Gauge} label="Uso diário" value={formatUnits(metrics.todayUnits)} detail={`Limite ${formatUnits(maxDailyUnits)}`} />
        <Metric icon={ShieldCheck} label="Saldo diário" value={formatUnits(metrics.dailyRemainingUnits)} detail={money.format(unitsToStake(metrics.dailyRemainingUnits, unitValue))} />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className={`${card} lg:col-span-2`}>
          <h2 className="text-xl font-bold">Limites complementares</h2>
          <p className="mt-1 text-sm text-muted-foreground">Banca, unidade e limites por entrada/dia são administrados em Configurações da Banca.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Limite por partida (%)" value={settings.maxMatchExposurePct} onChange={(value) => setSettings({ ...settings, maxMatchExposurePct: value })} />
            <Field label="Limite por liga (%)" value={settings.maxLeagueExposurePct} onChange={(value) => setSettings({ ...settings, maxLeagueExposurePct: value })} />
            <label className="space-y-1 text-sm">
              Perfil Kelly
              <select className="w-full rounded-xl border bg-background px-3 py-2" value={settings.kellyFraction} onChange={(event) => setSettings({ ...settings, kellyFraction: Number(event.target.value) as PortfolioSettings['kellyFraction'] })}>
                <option value={0.25}>Conservador — ¼ Kelly</option>
                <option value={0.5}>Equilibrado — ½ Kelly</option>
                <option value={1}>Agressivo — Kelly integral</option>
              </select>
            </label>
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
        {[
          ['Por partida', byMatch, settings.maxMatchExposurePct],
          ['Por liga', byLeague, settings.maxLeagueExposurePct],
          ['Por mercado', byMarket, settings.maxLeagueExposurePct],
        ].map(([title, rows, limit]) => (
          <article key={String(title)} className={card}>
            <h2 className="text-lg font-bold">Exposição {String(title).toLowerCase()}</h2>
            <div className="mt-4 space-y-3">
              {(rows as [string, number][]).length ? (
                (rows as [string, number][]).slice(0, 8).map(([name, value]) => {
                  const percentage = metrics.bankroll > 0 ? (value / metrics.bankroll) * 100 : 0;
                  return (
                    <div key={name}>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="truncate">{name}</span>
                        <strong>{formatUnits(stakeToUnits(value, unitValue))} · {money.format(value)}</strong>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, (percentage / Number(limit)) * 100)}%` }} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{pct(percentage)} da banca</div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">Sem operações abertas.</p>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className={`${card} grid gap-6 lg:grid-cols-2`}>
        <div>
          <h2 className="text-xl font-bold">Simulador de stake em unidades</h2>
          <p className="mt-1 text-sm text-muted-foreground">Aplica Kelly, limite percentual, teto por entrada e saldo diário, arredondando para múltiplos de 0,25 U.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Probabilidade da IA (%)" value={probability} onChange={setProbability} />
            <label className="space-y-1 text-sm">
              Cotação decimal
              <input className="w-full rounded-xl border bg-background px-3 py-2" type="number" min="1.01" step="0.01" value={odds} onChange={(event) => setOdds(Number(event.target.value) || 0)} />
            </label>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Result label="Kelly integral" value={pct(kelly.raw * 100)} />
          <Result label="Kelly do perfil" value={pct(kelly.adjusted * 100)} />
          <Result label="Kelly convertido" value={formatUnits(kelly.mathematicalUnits)} detail={money.format(kelly.mathematicalStake)} />
          <Result label="Limite por entrada" value={formatUnits(maxEntryUnits)} detail={money.format(unitsToStake(maxEntryUnits, unitValue))} />
          <Result label="Unidades recomendadas" value={formatUnits(kelly.recommendedUnits)} highlight />
          <Result label="Stake recomendada" value={money.format(kelly.stake)} highlight />
          <p className="text-xs text-muted-foreground sm:col-span-2">A recomendação respeita simultaneamente o Kelly, o limite por entrada e o saldo diário. Não representa garantia de resultado.</p>
        </div>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Target; label: string; value: string; detail?: string }) {
  return <article className="rounded-2xl border bg-card p-4 shadow-sm"><Icon className="mb-3 h-5 w-5 text-primary" /><p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p>{detail && <p className="text-xs text-muted-foreground">{detail}</p>}</article>;
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="space-y-1 text-sm">{label}<input className="w-full rounded-xl border bg-background px-3 py-2" type="number" min="0" step="0.25" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} /></label>;
}

function Result({ label, value, detail, highlight = false }: { label: string; value: string; detail?: string; highlight?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${highlight ? 'bg-primary/10' : 'bg-muted/30'}`}><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p>{detail && <p className="text-xs text-muted-foreground">{detail}</p>}</div>;
}
