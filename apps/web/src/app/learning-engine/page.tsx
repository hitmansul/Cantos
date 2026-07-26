'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, BrainCircuit, Gauge, RefreshCw, Scale, Sparkles, Target, TrendingUp } from 'lucide-react';

type Operation = {
  league?: string;
  market?: string;
  odd: number;
  stake: number;
  result: 'pending' | 'win' | 'loss' | 'push';
};

type GroupMetric = {
  name: string;
  settled: number;
  wins: number;
  profit: number;
  roi: number;
  hitRate: number;
};

const PERFORMANCE_KEY = 'ia-cantos-performance-v1';

function readOperations(): Operation[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PERFORMANCE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function profit(operation: Operation) {
  if (operation.result === 'win') return operation.stake * (operation.odd - 1);
  if (operation.result === 'loss') return -operation.stake;
  return 0;
}

function buildGroups(operations: Operation[], key: 'league' | 'market'): GroupMetric[] {
  const groups = new Map<string, Operation[]>();
  operations.forEach((operation) => {
    const name = operation[key]?.trim() || 'Não informado';
    groups.set(name, [...(groups.get(name) ?? []), operation]);
  });
  return [...groups.entries()].map(([name, rows]) => {
    const settled = rows.filter((row) => row.result !== 'pending');
    const wins = settled.filter((row) => row.result === 'win').length;
    const totalStake = settled.reduce((sum, row) => sum + row.stake, 0);
    const totalProfit = settled.reduce((sum, row) => sum + profit(row), 0);
    return {
      name,
      settled: settled.length,
      wins,
      profit: totalProfit,
      roi: totalStake > 0 ? (totalProfit / totalStake) * 100 : 0,
      hitRate: settled.length > 0 ? (wins / settled.length) * 100 : 0,
    };
  }).sort((a, b) => b.roi - a.roi || b.settled - a.settled);
}

function oddBand(value: number) {
  if (value < 1.7) return 'Abaixo de 1,70';
  if (value < 2) return '1,70 a 1,99';
  if (value < 2.5) return '2,00 a 2,49';
  return '2,50 ou mais';
}

export default function LearningEnginePage() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setOperations(readOperations());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const metrics = useMemo(() => {
    const settled = operations.filter((operation) => operation.result !== 'pending');
    const wins = settled.filter((operation) => operation.result === 'win').length;
    const totalStake = settled.reduce((sum, operation) => sum + operation.stake, 0);
    const totalProfit = settled.reduce((sum, operation) => sum + profit(operation), 0);
    const leagues = buildGroups(settled, 'league');
    const markets = buildGroups(settled, 'market');
    const bands = new Map<string, Operation[]>();
    settled.forEach((operation) => {
      const band = oddBand(operation.odd);
      bands.set(band, [...(bands.get(band) ?? []), operation]);
    });
    const odds = [...bands.entries()].map(([name, rows]) => {
      const stake = rows.reduce((sum, row) => sum + row.stake, 0);
      const result = rows.reduce((sum, row) => sum + profit(row), 0);
      const bandWins = rows.filter((row) => row.result === 'win').length;
      return { name, settled: rows.length, wins: bandWins, profit: result, roi: stake > 0 ? result / stake * 100 : 0, hitRate: rows.length ? bandWins / rows.length * 100 : 0 };
    }).sort((a, b) => b.roi - a.roi);
    const sampleStatus = settled.length >= 100 ? 'Confiável' : settled.length >= 30 ? 'Em formação' : 'Amostra insuficiente';
    return {
      settled,
      wins,
      totalProfit,
      roi: totalStake > 0 ? totalProfit / totalStake * 100 : 0,
      hitRate: settled.length ? wins / settled.length * 100 : 0,
      leagues,
      markets,
      odds,
      sampleStatus,
    };
  }, [operations]);

  const bestLeague = metrics.leagues[0];
  const bestMarket = metrics.markets[0];
  const bestOdds = metrics.odds[0];

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-black text-primary"><BrainCircuit className="h-4 w-4" /> IA Aprendiz</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Motor de Aprendizado</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">Acompanha os resultados registrados, identifica padrões e prepara recomendações para evolução dos pesos da IA.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar aprendizado</button>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Target} label="Operações liquidadas" value={String(metrics.settled.length)} />
        <Metric icon={TrendingUp} label="ROI observado" value={`${metrics.roi.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`} />
        <Metric icon={Activity} label="Taxa de acerto" value={`${metrics.hitRate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`} />
        <Metric icon={Gauge} label="Qualidade da amostra" value={metrics.sampleStatus} />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        <Insight title="Melhor liga" value={bestLeague?.name ?? 'Sem dados'} detail={bestLeague ? `${bestLeague.roi.toFixed(1)}% de ROI em ${bestLeague.settled} operações` : 'Registre operações para iniciar o aprendizado.'} />
        <Insight title="Melhor mercado" value={bestMarket?.name ?? 'Sem dados'} detail={bestMarket ? `${bestMarket.hitRate.toFixed(1)}% de acerto` : 'Aguardando histórico liquidado.'} />
        <Insight title="Melhor faixa de cotação" value={bestOdds?.name ?? 'Sem dados'} detail={bestOdds ? `${bestOdds.roi.toFixed(1)}% de ROI` : 'Aguardando histórico liquidado.'} />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Ranking title="Aprendizado por liga" rows={metrics.leagues} />
        <Ranking title="Aprendizado por mercado" rows={metrics.markets} />
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2"><Scale className="h-5 w-5 text-primary" /><h2 className="text-xl font-black">Campeão × Desafiante</h2></div>
        <p className="mt-1 text-sm text-muted-foreground">A comparação automática será liberada quando houver amostra suficiente para testar novos pesos sem comprometer o modelo principal.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ModelCard name="Modelo Campeão" status="Produção" description="Mantém as regras e pesos atualmente utilizados nas recomendações." />
          <ModelCard name="Modelo Desafiante" status={metrics.settled.length >= 30 ? 'Pronto para simulação' : 'Aguardando amostra'} description={metrics.settled.length >= 30 ? 'Pode testar ajustes com base nos padrões observados, sem alterar o modelo de produção.' : `Faltam ${Math.max(0, 30 - metrics.settled.length)} operações liquidadas para a primeira simulação controlada.`} />
        </div>
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><h2 className="text-xl font-black">Recomendações do aprendizado</h2></div>
        <div className="mt-4 space-y-3 text-sm">
          {metrics.settled.length < 30 ? <Recommendation text="Ainda não ajustar pesos automaticamente: a amostra é pequena e pode gerar conclusões instáveis." /> : null}
          {bestLeague ? <Recommendation text={`Priorizar a análise da liga ${bestLeague.name}, que apresenta o melhor ROI observado até agora.`} /> : null}
          {bestMarket ? <Recommendation text={`Monitorar o mercado ${bestMarket.name}, atualmente com melhor desempenho relativo.`} /> : null}
          {bestOdds ? <Recommendation text={`A faixa ${bestOdds.name} merece validação no Laboratório de Previsões antes de qualquer ajuste definitivo.`} /> : null}
          {metrics.settled.length === 0 ? <Recommendation text="Registre e liquide operações em Minha Performance para alimentar o Motor de Aprendizado." /> : null}
        </div>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return <div className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div>;
}

function Insight({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <article className="rounded-2xl border bg-card p-4"><p className="text-xs font-semibold text-muted-foreground">{title}</p><h2 className="mt-2 text-xl font-black">{value}</h2><p className="mt-2 text-sm text-muted-foreground">{detail}</p></article>;
}

function Ranking({ title, rows }: { title: string; rows: GroupMetric[] }) {
  return <section className="rounded-2xl border bg-card p-5"><h2 className="text-xl font-black">{title}</h2><div className="mt-4 space-y-2">{rows.slice(0, 8).map((row, index) => <div key={row.name} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border bg-background p-3"><span className="text-xs font-black text-primary">#{index + 1}</span><div className="min-w-0"><div className="truncate font-bold">{row.name}</div><div className="text-xs text-muted-foreground">{row.settled} operações · {row.hitRate.toFixed(1)}% de acerto</div></div><div className={`text-right font-black ${row.roi > 0 ? 'text-emerald-500' : row.roi < 0 ? 'text-red-500' : ''}`}>{row.roi > 0 ? '+' : ''}{row.roi.toFixed(1)}%</div></div>)}{rows.length === 0 && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Sem histórico suficiente para este ranking.</div>}</div></section>;
}

function ModelCard({ name, status, description }: { name: string; status: string; description: string }) {
  return <article className="rounded-xl border bg-background p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-black">{name}</h3><span className="rounded-full border px-2 py-1 text-xs font-bold text-primary">{status}</span></div><p className="mt-3 text-sm text-muted-foreground">{description}</p></article>;
}

function Recommendation({ text }: { text: string }) {
  return <div className="flex items-start gap-2 rounded-xl border bg-background p-3"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p>{text}</p></div>;
}
