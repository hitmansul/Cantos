'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Clock3, RefreshCw, ScanSearch, ShieldAlert } from 'lucide-react';

type Movement = {
  id: string;
  match: string;
  competition: string;
  market: string;
  selection: string;
  line: number | null;
  bookmaker: string;
  previousOdd: number;
  currentOdd: number;
  absoluteChange: number;
  relativeChangePct: number;
  velocityPctPerMinute: number;
  observations: number;
  severityScore: number;
  severity: 'CRÍTICA' | 'ALTA' | 'MODERADA' | 'NORMAL';
  direction: 'QUEDA' | 'ALTA';
  anomaly: boolean;
  capturedAt: string;
  baselineAt: string;
};

type ApiResponse = {
  configured: boolean;
  windowMinutes?: number;
  movements: Movement[];
  summary?: { total: number; anomalous: number; critical: number; drops: number };
  generatedAt: string;
  error?: string;
};

function number(value: number) {
  return value.toFixed(2).replace('.', ',');
}

function pct(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1).replace('.', ',')}%`;
}

export default function OddsMovementsPage() {
  const [minutes, setMinutes] = useState(30);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onlyAnomalies, setOnlyAnomalies] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/odds/movements?minutes=${minutes}&limit=150`, { cache: 'no-store' });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(payload.error || 'Falha ao analisar movimentações.');
      setData(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha inesperada.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [minutes]);

  const movements = useMemo(() => {
    const items = data?.movements || [];
    return onlyAnomalies ? items.filter((item) => item.anomaly) : items;
  }, [data, onlyAnomalies]);

  const summary = data?.summary || { total: 0, anomalous: 0, critical: 0, drops: 0 };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary"><ScanSearch className="h-4 w-4" /> Odds Movement Intelligence</div>
        <h1 className="text-3xl font-black tracking-tight">Movimentações Anormais de Odds</h1>
        <p className="max-w-3xl text-muted-foreground">Detecta mudanças rápidas de preço e diferencia oscilações rotineiras de movimentos que merecem atenção operacional. A análise usa apenas capturas realmente persistidas em <code>odds_prices</code>.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric icon={Activity} label="Movimentos analisados" value={String(summary.total)} detail={`Janela de ${minutes} min`} />
        <Metric icon={ShieldAlert} label="Anomalias" value={String(summary.anomalous)} detail="Score ≥ 40" />
        <Metric icon={AlertTriangle} label="Críticas" value={String(summary.critical)} detail="Score ≥ 80" />
        <Metric icon={ArrowDownRight} label="Quedas de odd" value={String(summary.drops)} detail="Preço encurtando" />
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold">Monitor de mercado</h2>
            <p className="text-sm text-muted-foreground">O score combina variação percentual, velocidade, ruído recente e número de observações.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="rounded-xl border bg-background px-3 py-2 text-sm">
              <option value={10}>10 minutos</option>
              <option value={20}>20 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={60}>60 minutos</option>
              <option value={120}>120 minutos</option>
            </select>
            <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium">
              <input type="checkbox" checked={onlyAnomalies} onChange={(e) => setOnlyAnomalies(e.target.checked)} /> Apenas anomalias
            </label>
            <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>
        </div>
      </section>

      {!data?.configured && !loading && (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm">
          O banco persistente ainda não está configurado neste ambiente. Defina <code>DATABASE_URL</code> e execute a migration do pipeline para habilitar a detecção real.
        </section>
      )}

      {error && <section className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive">{error}</section>}

      {data?.configured && !loading && movements.length === 0 && !error && (
        <section className="rounded-2xl border border-dashed p-10 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-bold">Nenhuma movimentação relevante encontrada</h2>
          <p className="mt-1 text-sm text-muted-foreground">Isso pode significar mercado estável ou ausência de snapshots suficientes na janela selecionada.</p>
        </section>
      )}

      <section className="space-y-3">
        {movements.map((item) => (
          <article key={item.id} className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border px-2.5 py-1 text-xs font-black">{item.severity}</span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">Score {item.severityScore.toFixed(0)}</span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{item.bookmaker}</span>
                </div>
                <h2 className="text-lg font-black sm:text-xl">{item.match}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{item.competition} · {item.selection}{item.line !== null ? ` · Linha ${item.line}` : ''}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.market}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
                <Mini label="Odd anterior" value={number(item.previousOdd)} />
                <Mini label="Odd atual" value={number(item.currentOdd)} />
                <Mini label="Variação" value={pct(item.relativeChangePct)} />
                <Mini label="Velocidade" value={`${item.velocityPctPerMinute.toFixed(2).replace('.', ',')}%/min`} />
              </div>
            </div>

            <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="flex items-start gap-2 text-sm">
                {item.direction === 'QUEDA' ? <ArrowDownRight className="mt-0.5 h-4 w-4 shrink-0" /> : <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0" />}
                <p>{item.direction === 'QUEDA' ? 'A odd encurtou rapidamente. Isso pode indicar aumento de demanda ou nova informação absorvida pelo mercado.' : 'A odd alongou rapidamente. Isso pode indicar redução de confiança do mercado ou busca por equilíbrio de preço.'} A IA classifica o movimento pela intensidade, não presume a causa.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-4 w-4" /> {item.observations} capturas</div>
            </div>
          </article>
        ))}
      </section>

      {data?.generatedAt && <p className="text-center text-xs text-muted-foreground">Última análise: {new Date(data.generatedAt).toLocaleString('pt-BR')}</p>}
    </main>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border bg-card p-4 shadow-sm"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{label}</div><div className="mt-2 text-2xl font-black">{value}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></div>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-muted p-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-lg font-black tabular-nums">{value}</div></div>;
}
