'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, BrainCircuit, RefreshCw, ShieldCheck, Target, Trophy } from 'lucide-react';

type ModelMetric = {
  model_key: string;
  model_name: string;
  model_version: string;
  status: string;
  predictions: number;
  settled_offers: number;
  wins: number;
  losses: number;
  pushes: number;
  stake_units: number;
  profit_units: number;
  roi_percent: number | null;
  hit_rate_percent: number | null;
  average_expected_value: number | null;
};

type RankingMetric = {
  name: string;
  settled: number;
  wins: number;
  losses: number;
  profit_units: number;
  roi_percent: number | null;
};

type CalibrationMetric = {
  band_start: number;
  band_end: number;
  samples: number;
  predicted_percent: number;
  actual_percent: number | null;
};

type Payload = {
  configured: boolean;
  models: ModelMetric[];
  competitions: RankingMetric[];
  markets: RankingMetric[];
  calibration: CalibrationMetric[];
  generatedAt?: string;
  note?: string;
  error?: string;
};

const number = (value: number | null | undefined, suffix = '') => value == null ? '—' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`;
const signed = (value: number | null | undefined, suffix = '') => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`;

export default function AiPerformancePage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/ai-corners/performance', { cache: 'no-store' });
      const payload = await response.json() as Payload;
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar a performance da IA.');
      setData(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar a performance da IA.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const production = useMemo(() => data?.models.find((model) => model.status === 'production') ?? data?.models[0], [data]);
  const calibrationError = useMemo(() => {
    const rows = data?.calibration.filter((row) => row.actual_percent != null) ?? [];
    if (!rows.length) return null;
    const total = rows.reduce((sum, row) => sum + row.samples, 0);
    return rows.reduce((sum, row) => sum + Math.abs(row.predicted_percent - (row.actual_percent ?? 0)) * row.samples, 0) / Math.max(total, 1);
  }, [data]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-bold text-primary"><BrainCircuit className="h-4 w-4" /> Evaluation Framework</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Performance da IA</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">Acompanhe ROI, precisão, lucro, calibração e desempenho por competição e mercado. As tabelas, classificações e jogos de todas as ligas permanecem disponíveis na área Estatísticas.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </header>

      {error && <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">{error}</div>}
      {!data?.configured && <div className="mt-5 rounded-xl border bg-card p-4 text-muted-foreground">{data?.note || 'Banco ainda não configurado.'}</div>}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Trophy} label="ROI do modelo" value={signed(production?.roi_percent, '%')} />
        <Metric icon={Target} label="Taxa de acerto" value={number(production?.hit_rate_percent, '%')} />
        <Metric icon={Activity} label="Lucro acumulado" value={signed(production?.profit_units, ' un.')} />
        <Metric icon={ShieldCheck} label="Erro de calibração" value={number(calibrationError, ' p.p.')} />
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" /><h2 className="text-xl font-black">Modelos avaliados</h2></div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-muted-foreground"><tr className="border-b"><th className="p-3">Modelo</th><th className="p-3">Status</th><th className="p-3">Predições</th><th className="p-3">Liquidadas</th><th className="p-3">Acerto</th><th className="p-3">ROI</th><th className="p-3">Lucro</th><th className="p-3">EV médio</th></tr></thead>
            <tbody>{(data?.models ?? []).map((model) => <tr key={model.model_key} className="border-b last:border-0"><td className="p-3"><div className="font-black">{model.model_name}</div><div className="text-xs text-muted-foreground">v{model.model_version}</div></td><td className="p-3"><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{statusLabel(model.status)}</span></td><td className="p-3 font-bold">{model.predictions}</td><td className="p-3">{model.settled_offers}</td><td className="p-3">{number(model.hit_rate_percent, '%')}</td><td className={`p-3 font-black ${tone(model.roi_percent)}`}>{signed(model.roi_percent, '%')}</td><td className={`p-3 font-black ${tone(model.profit_units)}`}>{signed(model.profit_units, ' un.')}</td><td className="p-3">{number(model.average_expected_value, '%')}</td></tr>)}</tbody>
          </table>
        </div>
        {!loading && (data?.models.length ?? 0) === 0 && <Empty text="Ainda não existem previsões liquidadas suficientes para avaliar os modelos." />}
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Ranking title="ROI por competição" icon={Trophy} rows={data?.competitions ?? []} />
        <Ranking title="ROI por mercado" icon={BarChart3} rows={data?.markets ?? []} />
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /><h2 className="text-xl font-black">Calibração das probabilidades</h2></div>
        <p className="mt-1 text-sm text-muted-foreground">Compara a probabilidade informada pelo modelo com a taxa real de acerto em cada faixa.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="text-left text-muted-foreground"><tr className="border-b"><th className="p-3">Faixa</th><th className="p-3">Amostra</th><th className="p-3">Previsto</th><th className="p-3">Realizado</th><th className="p-3">Diferença</th></tr></thead>
            <tbody>{(data?.calibration ?? []).map((row) => { const gap = row.actual_percent == null ? null : row.actual_percent - row.predicted_percent; return <tr key={`${row.band_start}-${row.band_end}`} className="border-b last:border-0"><td className="p-3 font-bold">{row.band_start}–{row.band_end}%</td><td className="p-3">{row.samples}</td><td className="p-3">{number(row.predicted_percent, '%')}</td><td className="p-3">{number(row.actual_percent, '%')}</td><td className={`p-3 font-bold ${tone(gap == null ? null : -Math.abs(gap))}`}>{gap == null ? '—' : signed(gap, ' p.p.')}</td></tr>; })}</tbody>
          </table>
        </div>
        {!loading && (data?.calibration.length ?? 0) === 0 && <Empty text="A curva de calibração aparecerá após existirem apostas WIN ou LOSS liquidadas." />}
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return <div className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div>;
}

function Ranking({ title, icon: Icon, rows }: { title: string; icon: typeof Trophy; rows: RankingMetric[] }) {
  return <section className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" /><h2 className="text-xl font-black">{title}</h2></div><div className="mt-4 space-y-2">{rows.map((row, index) => <div key={row.name} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl bg-muted/40 p-3"><span className="text-xs font-black text-primary">#{index + 1}</span><div className="min-w-0"><div className="truncate font-bold" title={row.name}>{row.name}</div><div className="text-xs text-muted-foreground">{row.settled} liquidadas · {row.wins}V · {row.losses}D</div></div><div className={`text-right font-black ${tone(row.roi_percent)}`}><div>{signed(row.roi_percent, '%')}</div><div className="text-xs">{signed(row.profit_units, ' un.')}</div></div></div>)}{rows.length === 0 && <Empty text="Sem dados liquidados para este ranking." />}</div></section>;
}

function Empty({ text }: { text: string }) { return <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</div>; }
function tone(value: number | null | undefined) { return value == null || value === 0 ? '' : value > 0 ? 'text-emerald-500' : 'text-red-500'; }
function statusLabel(status: string) { return status === 'production' ? 'Produção' : status === 'challenger' ? 'Desafiante' : status === 'experimental' ? 'Experimental' : 'Aposentado'; }
