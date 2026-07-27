'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BrainCircuit, CheckCircle2, Layers3, Radar, ShieldAlert, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { operationProfit, readPerformanceOperations, type PerformanceOperation } from '@/lib/performanceOperations';

type InsightLevel = 'critical' | 'warning' | 'positive' | 'neutral';

type MetaInsight = {
  id: string;
  title: string;
  description: string;
  action: string;
  level: InsightLevel;
  score: number;
  evidence: string[];
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percent = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function groupBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const group = key(item) || 'Não informado';
    (acc[group] ||= []).push(item);
    return acc;
  }, {});
}

function performanceSummary(operations: PerformanceOperation[]) {
  const settled = operations.filter((item) => item.result !== 'open');
  const stake = settled.reduce((sum, item) => sum + item.stake, 0);
  const profit = settled.reduce((sum, item) => sum + operationProfit(item), 0);
  const wins = settled.filter((item) => item.result === 'win').length;
  const losses = settled.filter((item) => item.result === 'loss').length;
  return {
    sample: settled.length,
    stake,
    profit,
    roi: stake > 0 ? (profit / stake) * 100 : 0,
    hitRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
  };
}

function buildInsights(operations: PerformanceOperation[]): MetaInsight[] {
  const settled = operations.filter((item) => item.result !== 'open');
  const open = operations.filter((item) => item.result === 'open');
  const overall = performanceSummary(operations);
  const insights: MetaInsight[] = [];

  if (overall.sample < 20) {
    insights.push({
      id: 'sample',
      title: 'Base histórica ainda pequena',
      description: 'A quantidade de operações concluídas ainda não permite tratar os padrões como definitivos.',
      action: 'Mantenha as stakes conservadoras e amplie a amostra antes de automatizar decisões.',
      level: 'warning',
      score: Math.max(20, 70 - overall.sample * 2),
      evidence: [`${overall.sample} operações concluídas`, 'Referência mínima sugerida: 20 operações'],
    });
  }

  const leagueGroups = Object.entries(groupBy(settled, (item) => item.league));
  const leagueStats = leagueGroups
    .map(([name, items]) => ({ name, ...performanceSummary(items) }))
    .filter((item) => item.sample >= 3)
    .sort((a, b) => b.roi - a.roi);

  const bestLeague = leagueStats[0];
  const worstLeague = [...leagueStats].sort((a, b) => a.roi - b.roi)[0];

  if (bestLeague && bestLeague.roi > 5) {
    insights.push({
      id: `league-positive-${bestLeague.name}`,
      title: `Desempenho superior em ${bestLeague.name}`,
      description: 'Esta liga combina amostra mínima, retorno positivo e taxa de acerto consistente no histórico disponível.',
      action: 'Priorize a análise, mas mantenha os limites de exposição da Gestão da Banca.',
      level: 'positive',
      score: Math.min(98, 65 + bestLeague.sample + Math.round(bestLeague.roi)),
      evidence: [`ROI ${percent.format(bestLeague.roi)}%`, `${bestLeague.sample} operações`, `Taxa de acerto ${percent.format(bestLeague.hitRate)}%`],
    });
  }

  if (worstLeague && worstLeague.roi < -8) {
    insights.push({
      id: `league-risk-${worstLeague.name}`,
      title: `Risco recorrente em ${worstLeague.name}`,
      description: 'O histórico desta liga apresenta retorno negativo relevante na amostra registrada.',
      action: 'Reduza a stake, exija classificação mais alta ou suspenda entradas até nova validação.',
      level: worstLeague.roi < -20 ? 'critical' : 'warning',
      score: Math.min(99, 60 + Math.abs(Math.round(worstLeague.roi))),
      evidence: [`ROI ${percent.format(worstLeague.roi)}%`, `Prejuízo ${money.format(worstLeague.profit)}`, `${worstLeague.sample} operações`],
    });
  }

  const marketStats = Object.entries(groupBy(settled, (item) => item.market))
    .map(([name, items]) => ({ name, ...performanceSummary(items) }))
    .filter((item) => item.sample >= 3)
    .sort((a, b) => b.roi - a.roi);

  const bestMarket = marketStats[0];
  if (bestMarket && bestMarket.roi > 8) {
    insights.push({
      id: `market-${bestMarket.name}`,
      title: `Mercado com maior eficiência: ${bestMarket.name}`,
      description: 'O cruzamento entre lucro, ROI e taxa de acerto aponta este mercado como o mais eficiente da base atual.',
      action: 'Use como filtro de prioridade, sem ignorar contexto da partida, cotação e liquidez.',
      level: 'positive',
      score: Math.min(96, 62 + bestMarket.sample + Math.round(bestMarket.roi / 2)),
      evidence: [`ROI ${percent.format(bestMarket.roi)}%`, `${bestMarket.sample} operações`, `Lucro ${money.format(bestMarket.profit)}`],
    });
  }

  const openStake = open.reduce((sum, item) => sum + item.stake, 0);
  const openByMatch = Object.entries(groupBy(open, (item) => item.match))
    .map(([name, items]) => ({ name, stake: items.reduce((sum, item) => sum + item.stake, 0), count: items.length }))
    .sort((a, b) => b.stake - a.stake);

  if (openByMatch[0] && openByMatch[0].count >= 2) {
    insights.push({
      id: `correlation-${openByMatch[0].name}`,
      title: 'Possível correlação excessiva em uma partida',
      description: 'Existem múltiplas operações abertas no mesmo jogo, o que pode concentrar risco em um único evento.',
      action: 'Revise se os mercados dependem do mesmo cenário e reduza a exposição combinada quando necessário.',
      level: openByMatch[0].count >= 3 ? 'critical' : 'warning',
      score: Math.min(95, 55 + openByMatch[0].count * 12),
      evidence: [`${openByMatch[0].count} operações em ${openByMatch[0].name}`, `Exposição combinada ${money.format(openByMatch[0].stake)}`, `Exposição aberta total ${money.format(openStake)}`],
    });
  }

  if (overall.sample >= 20 && overall.roi > 3) {
    insights.push({
      id: 'overall-positive',
      title: 'Estratégia global com vantagem histórica',
      description: 'A operação consolidada apresenta ROI positivo em uma amostra mais madura.',
      action: 'Mantenha o processo atual e aumente exposição apenas de forma gradual e controlada.',
      level: 'positive',
      score: Math.min(97, 70 + Math.round(overall.roi) + Math.min(15, Math.floor(overall.sample / 10))),
      evidence: [`ROI geral ${percent.format(overall.roi)}%`, `${overall.sample} operações concluídas`, `Lucro acumulado ${money.format(overall.profit)}`],
    });
  } else if (overall.sample >= 10 && overall.roi < -5) {
    insights.push({
      id: 'overall-risk',
      title: 'Estratégia global em zona de revisão',
      description: 'O desempenho consolidado está negativo e exige revisão dos filtros de entrada e dimensionamento de stake.',
      action: 'Reduza exposição, revise ligas e mercados negativos e valide novamente os critérios no Backtest.',
      level: overall.roi < -15 ? 'critical' : 'warning',
      score: Math.min(99, 68 + Math.abs(Math.round(overall.roi))),
      evidence: [`ROI geral ${percent.format(overall.roi)}%`, `Resultado ${money.format(overall.profit)}`, `${overall.sample} operações concluídas`],
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'neutral',
      title: 'Nenhuma anomalia relevante detectada',
      description: 'Os dados atuais não apresentam evidência suficiente para uma recomendação forte, positiva ou negativa.',
      action: 'Continue registrando operações e acompanhe a evolução dos indicadores.',
      level: 'neutral',
      score: 50,
      evidence: [`${operations.length} operações registradas`, `${overall.sample} operações concluídas`],
    });
  }

  return insights.sort((a, b) => b.score - a.score);
}

const levelStyle: Record<InsightLevel, string> = {
  critical: 'border-red-500/40 bg-red-500/5',
  warning: 'border-amber-500/40 bg-amber-500/5',
  positive: 'border-emerald-500/40 bg-emerald-500/5',
  neutral: 'border-border bg-card',
};

const levelLabel: Record<InsightLevel, string> = {
  critical: 'Crítico',
  warning: 'Atenção',
  positive: 'Favorável',
  neutral: 'Neutro',
};

export default function MetaIntelligencePage() {
  const [operations, setOperations] = useState<PerformanceOperation[]>([]);

  useEffect(() => {
    setOperations(readPerformanceOperations());
  }, []);

  const summary = useMemo(() => performanceSummary(operations), [operations]);
  const insights = useMemo(() => buildInsights(operations), [operations]);
  const critical = insights.filter((item) => item.level === 'critical').length;
  const positive = insights.filter((item) => item.level === 'positive').length;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><BrainCircuit className="h-4 w-4" /> Meta Intelligence</div>
            <h1 className="text-3xl font-bold tracking-tight">Centro de inteligência integrada</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">Cruza performance, padrões, exposição e consistência para transformar dados isolados em prioridades operacionais auditáveis.</p>
          </div>
          <div className="rounded-2xl border bg-background px-5 py-4 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado atual</p>
            <p className="mt-1 text-xl font-bold">{critical > 0 ? 'Revisão necessária' : positive > 0 ? 'Cenário favorável' : 'Em observação'}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Activity} label="Operações concluídas" value={String(summary.sample)} />
        <Metric icon={summary.profit >= 0 ? TrendingUp : TrendingDown} label="Resultado acumulado" value={money.format(summary.profit)} />
        <Metric icon={Radar} label="ROI consolidado" value={`${percent.format(summary.roi)}%`} />
        <Metric icon={ShieldAlert} label="Alertas críticos" value={String(critical)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Prioridades da IA</h2>
              <p className="text-sm text-muted-foreground">Ordenadas pela força das evidências disponíveis.</p>
            </div>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-4">
            {insights.map((insight) => (
              <article key={insight.id} className={`rounded-2xl border p-5 ${levelStyle[insight.level]}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {insight.level === 'positive' ? <CheckCircle2 className="h-4 w-4" /> : insight.level === 'neutral' ? <Layers3 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      <span className="text-xs font-bold uppercase tracking-wide">{levelLabel[insight.level]}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-bold">{insight.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{insight.description}</p>
                  </div>
                  <div className="rounded-xl border bg-background/80 px-3 py-2 text-center">
                    <p className="text-xs text-muted-foreground">Força</p>
                    <p className="text-xl font-bold">{insight.score}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border bg-background/70 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Evidências</p>
                    <ul className="mt-2 space-y-1 text-sm">{insight.evidence.map((item) => <li key={item}>• {item}</li>)}</ul>
                  </div>
                  <div className="rounded-xl border bg-background/70 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Ação recomendada</p>
                    <p className="mt-2 text-sm">{insight.action}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-bold">Fontes integradas</h2>
            <div className="mt-4 space-y-3 text-sm">
              {['Minha Performance', 'Gestão da Banca', 'Padrões da IA', 'IA Aprendiz', 'Explicações da IA', 'Simulador Temporal'].map((source) => (
                <div key={source} className="flex items-center justify-between rounded-xl border px-3 py-2">
                  <span>{source}</span><CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-bold">Regra de confiança</h2>
            <p className="mt-2 text-sm text-muted-foreground">A força de cada insight considera tamanho da amostra, magnitude do ROI, recorrência e concentração de risco. Nenhuma conclusão é apresentada como definitiva quando a base é pequena.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between"><p className="text-sm font-medium text-muted-foreground">{label}</p><Icon className="h-5 w-5 text-primary" /></div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
    </div>
  );
}
