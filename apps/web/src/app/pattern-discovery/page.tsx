'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Brain, CalendarDays, Gauge, RefreshCw, SearchCheck, Sparkles, Target, TrendingUp } from 'lucide-react';
import { isSettledOperation, operationProfit, readPerformanceOperations, type PerformanceOperation } from '@/lib/performanceOperations';

type Pattern = {
  id: string;
  title: string;
  segment: string;
  sample: number;
  wins: number;
  losses: number;
  profit: number;
  roi: number;
  hitRate: number;
  confidence: 'Baixa' | 'Em formação' | 'Moderada' | 'Alta';
  status: 'Promissor' | 'Neutro' | 'Risco';
  explanation: string;
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function oddBand(odds: number) {
  if (odds < 1.7) return 'Cotação até 1,69';
  if (odds < 2) return 'Cotação de 1,70 a 1,99';
  if (odds < 2.5) return 'Cotação de 2,00 a 2,49';
  return 'Cotação de 2,50 ou mais';
}

function weekday(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? 'Data não informada' : new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(parsed);
}

function patternFromRows(id: string, title: string, segment: string, rows: PerformanceOperation[]): Pattern {
  const wins = rows.filter((row) => row.result === 'win').length;
  const losses = rows.filter((row) => row.result === 'loss').length;
  const stake = rows.reduce((sum, row) => sum + row.stake, 0);
  const profit = rows.reduce((sum, row) => sum + operationProfit(row), 0);
  const decisions = wins + losses;
  const roi = stake > 0 ? profit / stake * 100 : 0;
  const hitRate = decisions > 0 ? wins / decisions * 100 : 0;
  const confidence = rows.length >= 100 ? 'Alta' : rows.length >= 50 ? 'Moderada' : rows.length >= 20 ? 'Em formação' : 'Baixa';
  const status = rows.length < 5 || Math.abs(roi) < 2 ? 'Neutro' : roi > 0 ? 'Promissor' : 'Risco';
  const explanation = status === 'Promissor'
    ? `O segmento apresenta retorno positivo, mas precisa manter estabilidade em novas operações antes de influenciar o modelo.`
    : status === 'Risco'
      ? `O segmento apresenta retorno negativo e deve ser investigado antes de novas exposições.`
      : `Ainda não existe evidência suficiente para classificar este segmento como vantagem ou risco.`;
  return { id, title, segment, sample: rows.length, wins, losses, profit, roi, hitRate, confidence, status, explanation };
}

function groupPatterns(rows: PerformanceOperation[], key: 'league' | 'market' | 'odds' | 'weekday') {
  const groups = new Map<string, PerformanceOperation[]>();
  rows.forEach((row) => {
    const name = key === 'league' ? row.league.trim() || 'Liga não informada'
      : key === 'market' ? row.market.trim() || 'Mercado não informado'
        : key === 'odds' ? oddBand(row.odds)
          : weekday(row.date);
    groups.set(name, [...(groups.get(name) ?? []), row]);
  });
  return [...groups.entries()].map(([name, group]) => patternFromRows(`${key}-${name}`, name, key, group));
}

export default function PatternDiscoveryPage() {
  const [operations, setOperations] = useState<PerformanceOperation[]>([]);
  const [filter, setFilter] = useState<'all' | 'positive' | 'risk'>('all');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setOperations(readPerformanceOperations());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const analysis = useMemo(() => {
    const settled = operations.filter(isSettledOperation);
    const patterns = [
      ...groupPatterns(settled, 'league'),
      ...groupPatterns(settled, 'market'),
      ...groupPatterns(settled, 'odds'),
      ...groupPatterns(settled, 'weekday'),
    ].filter((pattern) => pattern.sample > 0)
      .sort((a, b) => Math.abs(b.roi) - Math.abs(a.roi) || b.sample - a.sample);
    const visible = patterns.filter((pattern) => filter === 'all' || (filter === 'positive' ? pattern.status === 'Promissor' : pattern.status === 'Risco'));
    const promising = patterns.filter((pattern) => pattern.status === 'Promissor');
    const risks = patterns.filter((pattern) => pattern.status === 'Risco');
    const validated = patterns.filter((pattern) => pattern.sample >= 30 && pattern.status !== 'Neutro');
    return { settled, patterns, visible, promising, risks, validated };
  }, [filter, operations]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-black text-primary"><SearchCheck className="h-4 w-4" /> Descoberta de Padrões</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Motor de Padrões da IA</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">Procura vantagens e riscos recorrentes por liga, mercado, faixa de cotação e dia da semana, sempre separando indício de evidência validada.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Reprocessar padrões</button>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Target} label="Operações analisadas" value={String(analysis.settled.length)} />
        <Metric icon={TrendingUp} label="Padrões promissores" value={String(analysis.promising.length)} />
        <Metric icon={Gauge} label="Padrões de risco" value={String(analysis.risks.length)} />
        <Metric icon={Brain} label="Padrões validáveis" value={String(analysis.validated.length)} />
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-xl font-black">Mapa de padrões encontrados</h2><p className="mt-1 text-sm text-muted-foreground">Resultados com amostra pequena continuam visíveis, mas recebem confiança baixa.</p></div>
          <div className="flex flex-wrap gap-2">
            {([['all', 'Todos'], ['positive', 'Promissores'], ['risk', 'Riscos']] as const).map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-xl border px-3 py-2 text-sm font-bold ${filter === value ? 'bg-primary text-primary-foreground' : 'bg-background'}`}>{label}</button>)}
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {analysis.visible.slice(0, 20).map((pattern) => <PatternCard key={pattern.id} pattern={pattern} />)}
          {!loading && analysis.visible.length === 0 && <div className="lg:col-span-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Ainda não existem operações liquidadas suficientes para revelar padrões.</div>}
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        <Guard icon={Activity} title="Indício" text="Aparece com qualquer amostra, mas não pode alterar pesos nem recomendações." />
        <Guard icon={CalendarDays} title="Validação" text="Exige pelo menos 30 operações no segmento e estabilidade fora da amostra original." />
        <Guard icon={Sparkles} title="Aplicação" text="Somente padrões confirmados seguem para o Modelo Desafiante e para o Laboratório de Previsões." />
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return <div className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div>;
}

function PatternCard({ pattern }: { pattern: Pattern }) {
  const tone = pattern.status === 'Promissor' ? 'text-emerald-500' : pattern.status === 'Risco' ? 'text-red-500' : 'text-muted-foreground';
  return <article className="rounded-xl border bg-background p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{pattern.segment}</p><h3 className="mt-1 text-lg font-black">{pattern.title}</h3></div><span className={`rounded-full border px-2 py-1 text-xs font-black ${tone}`}>{pattern.status}</span></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Small label="Amostra" value={String(pattern.sample)} /><Small label="ROI" value={`${pattern.roi > 0 ? '+' : ''}${number.format(pattern.roi)}%`} /><Small label="Acerto" value={`${number.format(pattern.hitRate)}%`} /><Small label="Resultado" value={money.format(pattern.profit)} /></div><p className="mt-3 text-sm text-muted-foreground">{pattern.explanation}</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full border px-2 py-1">Confiança: {pattern.confidence}</span><span className="rounded-full border px-2 py-1">{pattern.wins} acertos · {pattern.losses} erros</span></div></article>;
}

function Small({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border p-2"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 font-black">{value}</p></div>; }
function Guard({ icon: Icon, title, text }: { icon: typeof Target; title: string; text: string }) { return <article className="rounded-2xl border bg-card p-4"><Icon className="h-5 w-5 text-primary" /><h3 className="mt-3 font-black">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{text}</p></article>; }
