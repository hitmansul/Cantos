'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Filter, FlaskConical, RefreshCw, ShieldAlert, Target, Trophy } from 'lucide-react';

type Summary = {
  settled: number;
  wins: number;
  losses: number;
  pushes: number;
  profitUnits: number;
  roiPercent: number | null;
  hitRatePercent: number | null;
  averageOdd: number | null;
  averageEv: number | null;
  maximumDrawdownUnits: number;
  longestLosingStreak: number;
};

type Ranking = { name: string; settled: number; wins: number; losses: number; pushes: number; profit: number; roiPercent: number | null };
type Bet = {
  prediction_key: string;
  competition_name?: string;
  competition_key?: string;
  home_team_name: string;
  away_team_name: string;
  kickoff_at?: string;
  bookmaker: string;
  line: number;
  side: string;
  odd: number;
  score_ia: number;
  confidence_score: number;
  expected_value: number;
  kelly_fraction: number;
  result: string;
  profit_units: number;
};
type Payload = { configured: boolean; summary: Summary | null; byCompetition: Ranking[]; byMarket: Ranking[]; bets: Bet[]; note?: string; error?: string };

type Filters = {
  minScore: number;
  minConfidence: number;
  minEv: number;
  minKelly: number;
  minOdd: number;
  maxOdd: number;
  competition: string;
  side: string;
  rating: string;
  onlyValue: boolean;
  dateFrom: string;
  dateTo: string;
};

const initialFilters: Filters = {
  minScore: 0,
  minConfidence: 0,
  minEv: 0,
  minKelly: 0,
  minOdd: 1.01,
  maxOdd: 10,
  competition: '',
  side: '',
  rating: '',
  onlyValue: true,
  dateFrom: '',
  dateTo: '',
};

const number = (value: number | null | undefined, suffix = '') => value == null ? '—' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`;
const signed = (value: number | null | undefined, suffix = '') => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`;

export default function BacktestPage() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function run(next = filters) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(next).forEach(([key, value]) => {
        if (typeof value === 'boolean') params.set(key, String(value));
        else if (value !== '') params.set(key, String(value));
      });
      const response = await fetch(`/api/ai-corners/backtest?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json() as Payload;
      if (!response.ok) throw new Error(payload.error || 'Não foi possível executar o backtest.');
      setData(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao executar o backtest.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void run(initialFilters); }, []);
  const summary = data?.summary;
  const strategyLabel = useMemo(() => {
    const parts = [];
    if (filters.minScore > 0) parts.push(`Score ≥ ${filters.minScore}`);
    if (filters.minConfidence > 0) parts.push(`Confiança ≥ ${filters.minConfidence}%`);
    if (filters.minEv > 0) parts.push(`EV ≥ ${filters.minEv}%`);
    if (filters.minKelly > 0) parts.push(`Kelly ≥ ${filters.minKelly}%`);
    if (filters.side) parts.push(filters.side === 'over' ? 'Somente Over' : 'Somente Under');
    if (filters.competition) parts.push(filters.competition);
    return parts.length ? parts.join(' · ') : 'Todos os mercados liquidados';
  }, [filters]);

  function set<K extends keyof Filters>(key: K, value: Filters[K]) { setFilters((current) => ({ ...current, [key]: value })); }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-bold text-primary"><FlaskConical className="h-4 w-4" /> Backtest Engine</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Laboratório de estratégias históricas</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">Teste regras de Score IA, confiança, EV, Kelly, odds, mercado e competição usando somente previsões já liquidadas. As tabelas, classificações e jogos das ligas permanecem preservados em Estatísticas.</p>
        </div>
        <button onClick={() => void run()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Executar backtest</button>
      </header>

      <section className="mt-6 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2"><Filter className="h-5 w-5 text-primary" /><h2 className="text-xl font-black">Regras da estratégia</h2></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Numeric label="Score IA mínimo" value={filters.minScore} onChange={(value) => set('minScore', value)} min={0} max={100} />
          <Numeric label="Confiança mínima (%)" value={filters.minConfidence} onChange={(value) => set('minConfidence', value)} min={0} max={100} />
          <Numeric label="EV mínimo (%)" value={filters.minEv} onChange={(value) => set('minEv', value)} min={-100} max={500} step={0.5} />
          <Numeric label="Kelly mínimo (%)" value={filters.minKelly} onChange={(value) => set('minKelly', value)} min={0} max={100} step={0.1} />
          <Numeric label="Odd mínima" value={filters.minOdd} onChange={(value) => set('minOdd', value)} min={1.01} max={100} step={0.01} />
          <Numeric label="Odd máxima" value={filters.maxOdd} onChange={(value) => set('maxOdd', value)} min={1.01} max={100} step={0.01} />
          <label className="flex flex-col gap-2 text-sm font-semibold">Competição<input value={filters.competition} onChange={(event) => set('competition', event.target.value)} placeholder="Ex.: Premier League" className="min-h-11 rounded-xl border bg-background px-3" /></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Mercado<select value={filters.side} onChange={(event) => set('side', event.target.value)} className="min-h-11 rounded-xl border bg-background px-3"><option value="">Over e Under</option><option value="over">Somente Over</option><option value="under">Somente Under</option></select></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Classificação<select value={filters.rating} onChange={(event) => set('rating', event.target.value)} className="min-h-11 rounded-xl border bg-background px-3"><option value="">Todas</option><option value="strong-value">Strong value</option><option value="value">Value</option><option value="watch">Monitorar</option><option value="avoid">Evitar</option></select></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Data inicial<input type="date" value={filters.dateFrom} onChange={(event) => set('dateFrom', event.target.value)} className="min-h-11 rounded-xl border bg-background px-3" /></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Data final<input type="date" value={filters.dateTo} onChange={(event) => set('dateTo', event.target.value)} className="min-h-11 rounded-xl border bg-background px-3" /></label>
          <label className="flex items-center gap-3 self-end rounded-xl border bg-background p-3 text-sm font-semibold"><input type="checkbox" checked={filters.onlyValue} onChange={(event) => set('onlyValue', event.target.checked)} /> Somente apostas de valor</label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3"><button onClick={() => void run()} disabled={loading} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Aplicar estratégia</button><button onClick={() => { setFilters(initialFilters); void run(initialFilters); }} className="rounded-xl border px-4 py-2 text-sm font-bold">Limpar filtros</button></div>
      </section>

      <div className="mt-5 rounded-xl border bg-muted/30 p-4 text-sm"><b>Estratégia atual:</b> {strategyLabel}</div>
      {error && <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">{error}</div>}
      {!data?.configured && <div className="mt-5 rounded-xl border bg-card p-4 text-muted-foreground">{data?.note || 'Banco ainda não configurado.'}</div>}

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Trophy} label="ROI da estratégia" value={signed(summary?.roiPercent, '%')} />
        <Metric icon={Target} label="Taxa de acerto" value={number(summary?.hitRatePercent, '%')} />
        <Metric icon={Activity} label="Lucro acumulado" value={signed(summary?.profitUnits, ' un.')} />
        <Metric icon={ShieldAlert} label="Drawdown máximo" value={signed(summary?.maximumDrawdownUnits, ' un.')} />
        <Metric icon={BarChart3} label="Apostas liquidadas" value={number(summary?.settled)} />
        <Metric icon={Target} label="Odd média" value={number(summary?.averageOdd)} />
        <Metric icon={Activity} label="EV médio" value={number(summary?.averageEv, '%')} />
        <Metric icon={ShieldAlert} label="Maior sequência de perdas" value={number(summary?.longestLosingStreak)} />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <RankingCard title="Desempenho por competição" rows={data?.byCompetition ?? []} />
        <RankingCard title="Desempenho por mercado" rows={data?.byMarket ?? []} />
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-black">Apostas consideradas pelo backtest</h2>
        <p className="mt-1 text-sm text-muted-foreground">Mostra as previsões liquidadas que passaram por todos os filtros selecionados.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="text-left text-muted-foreground"><tr className="border-b"><th className="p-3">Partida</th><th className="p-3">Competição</th><th className="p-3">Mercado</th><th className="p-3">Odd</th><th className="p-3">Score</th><th className="p-3">Confiança</th><th className="p-3">EV</th><th className="p-3">Kelly</th><th className="p-3">Resultado</th><th className="p-3">Lucro</th></tr></thead>
            <tbody>{(data?.bets ?? []).map((bet) => <tr key={`${bet.prediction_key}-${bet.bookmaker}-${bet.side}-${bet.line}`} className="border-b last:border-0"><td className="p-3"><div className="font-bold">{bet.home_team_name} x {bet.away_team_name}</div><div className="text-xs text-muted-foreground">{bet.bookmaker}</div></td><td className="p-3">{bet.competition_name || bet.competition_key || '—'}</td><td className="p-3 font-bold">{bet.side.toUpperCase()} {number(bet.line)}</td><td className="p-3">{number(bet.odd)}</td><td className="p-3">{number(bet.score_ia)}</td><td className="p-3">{number(bet.confidence_score * 100, '%')}</td><td className="p-3">{signed(bet.expected_value * 100, '%')}</td><td className="p-3">{number(bet.kelly_fraction * 100, '%')}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${bet.result === 'win' ? 'bg-emerald-500/10 text-emerald-500' : bet.result === 'loss' ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'}`}>{bet.result.toUpperCase()}</span></td><td className={`p-3 font-black ${tone(bet.profit_units)}`}>{signed(bet.profit_units, ' un.')}</td></tr>)}</tbody>
          </table>
        </div>
        {!loading && (data?.bets.length ?? 0) === 0 && <div className="mt-4 rounded-xl border border-dashed p-8 text-center text-muted-foreground">Nenhuma previsão liquidada atende aos filtros atuais.</div>}
      </section>
    </main>
  );
}

function Numeric({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step?: number }) {
  return <label className="flex flex-col gap-2 text-sm font-semibold">{label}<input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} min={min} max={max} step={step} className="min-h-11 rounded-xl border bg-background px-3" /></label>;
}
function Metric({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) { return <div className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div>; }
function RankingCard({ title, rows }: { title: string; rows: Ranking[] }) { return <section className="rounded-2xl border bg-card p-5"><h2 className="text-xl font-black">{title}</h2><div className="mt-4 space-y-2">{rows.slice(0, 10).map((row, index) => <div key={row.name} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl bg-muted/40 p-3"><span className="text-xs font-black text-primary">#{index + 1}</span><div className="min-w-0"><div className="truncate font-bold" title={row.name}>{row.name}</div><div className="text-xs text-muted-foreground">{row.settled} apostas · {row.wins}V · {row.losses}D · {row.pushes}P</div></div><div className={`text-right font-black ${tone(row.roiPercent)}`}><div>{signed(row.roiPercent, '%')}</div><div className="text-xs">{signed(row.profit, ' un.')}</div></div></div>)}{rows.length === 0 && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Sem dados para o recorte selecionado.</div>}</div></section>; }
function tone(value: number | null | undefined) { return value == null || value === 0 ? '' : value > 0 ? 'text-emerald-500' : 'text-red-500'; }
