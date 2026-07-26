'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BrainCircuit, CheckCircle2, Gauge, RefreshCw, Scale, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { buildSmartAlerts, type SmartAlert, type SmartAlertInput } from '@/lib/corners/smartAlertsEngine';

type Payload = { alerts?: SmartAlertInput[]; lastUpdated?: string; error?: string };

type Factor = {
  label: string;
  value: number;
  maximum: number;
  explanation: string;
  tone: 'positive' | 'neutral' | 'risk';
};

const confidencePoints: Record<string, number> = {
  high: 25,
  alta: 25,
  medium: 16,
  media: 16,
  média: 16,
  moderada: 16,
  low: 8,
  baixa: 8,
  fraca: 8,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function explain(alert: SmartAlert): Factor[] {
  const source = alert.source;
  const edge = clamp(source.edgePct / 20, 0, 1) * 50;
  const confidence = confidencePoints[source.confidence.toLowerCase()] ?? 3;
  const liquidity = clamp(source.bookmakersCompared / 6, 0, 1) * 15;
  const validation = source.discovery ? 0 : 10;

  return [
    {
      label: 'Vantagem sobre a referência',
      value: edge,
      maximum: 50,
      explanation: `${source.edgePct.toFixed(1)}% de vantagem observada. Este é o fator de maior peso na nota atual.`,
      tone: source.edgePct >= 7 ? 'positive' : source.edgePct < 2 ? 'risk' : 'neutral',
    },
    {
      label: 'Confiança do modelo',
      value: confidence,
      maximum: 25,
      explanation: `Confiança informada como “${source.confidence}”. Quanto maior a estabilidade do modelo, maior esta contribuição.`,
      tone: confidence >= 20 ? 'positive' : confidence <= 8 ? 'risk' : 'neutral',
    },
    {
      label: 'Cobertura de mercado',
      value: liquidity,
      maximum: 15,
      explanation: `${source.bookmakersCompared} casa(s) comparada(s). Mais fontes reduzem o risco de uma cotação isolada distorcer a leitura.`,
      tone: source.bookmakersCompared >= 4 ? 'positive' : source.bookmakersCompared < 2 ? 'risk' : 'neutral',
    },
    {
      label: 'Validação da oportunidade',
      value: validation,
      maximum: 10,
      explanation: source.discovery ? 'Mercado ainda em descoberta, por isso não recebe bônus de validação.' : 'Mercado validado pelas regras atuais e com bônus integral de confirmação.',
      tone: source.discovery ? 'risk' : 'positive',
    },
  ];
}

function decision(alert: SmartAlert) {
  if (alert.grade === 'S+' || alert.grade === 'S') return { label: 'Priorizar análise', tone: 'positive' as const, text: 'A nota e os fatores disponíveis justificam análise imediata, mantendo a checagem de contexto e risco.' };
  if (alert.grade === 'A' || alert.grade === 'B') return { label: 'Monitorar', tone: 'neutral' as const, text: 'Há sinais relevantes, mas ainda não suficientes para tratar o cenário como oportunidade premium.' };
  return { label: 'Evitar por enquanto', tone: 'risk' as const, text: 'A combinação atual de vantagem, confiança ou cobertura de mercado é insuficiente.' };
}

export default function ExplainabilityPage() {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/odds/alerts?scope=all', { cache: 'no-store' });
      const payload = await response.json() as Payload;
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar as decisões da IA.');
      const built = buildSmartAlerts(payload.alerts ?? []);
      setAlerts(built);
      setSelectedId((current) => current && built.some((item) => item.id === current) ? current : built[0]?.id ?? '');
      setLastUpdated(payload.lastUpdated ?? new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar as explicações.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const selected = useMemo(() => alerts.find((item) => item.id === selectedId) ?? alerts[0], [alerts, selectedId]);
  const factors = useMemo(() => selected ? explain(selected) : [], [selected]);
  const verdict = selected ? decision(selected) : null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-black text-primary"><BrainCircuit className="h-4 w-4" /> Explicabilidade da IA</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Por que a IA recomendou isso?</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">Abra cada oportunidade e veja, de forma auditável, quais fatores formaram a nota, quais riscos reduziram a recomendação e o que ainda falta para uma decisão mais forte.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </header>

      {error && <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">{error}</div>}

      <section className="mt-6 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3"><h2 className="font-black">Decisões atuais</h2><span className="text-xs text-muted-foreground">{alerts.length} cenário(s)</span></div>
          <div className="mt-4 space-y-2">
            {alerts.map((alert) => (
              <button key={alert.id} onClick={() => setSelectedId(alert.id)} className={`w-full rounded-xl border p-3 text-left transition ${selected?.id === alert.id ? 'border-primary bg-primary/5' : 'bg-background hover:border-primary/40'}`}>
                <div className="flex items-center justify-between gap-2"><span className="rounded-full border px-2 py-0.5 text-xs font-black">{alert.grade} · {alert.score}</span><span className="truncate text-xs text-muted-foreground">{alert.leagueName}</span></div>
                <div className="mt-2 font-black">{alert.match}</div>
                <div className="mt-1 text-sm text-muted-foreground">{alert.market}</div>
              </button>
            ))}
            {!loading && alerts.length === 0 && <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Nenhuma oportunidade disponível para explicar neste momento.</div>}
          </div>
        </aside>

        <section className="space-y-4">
          {selected && verdict ? (
            <>
              <article className="rounded-2xl border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-sm font-semibold text-primary">{selected.leagueName}</p><h2 className="mt-1 text-2xl font-black">{selected.match}</h2><p className="mt-1 text-muted-foreground">{selected.market}</p></div>
                  <div className="rounded-2xl border bg-background px-4 py-3 text-center"><p className="text-xs text-muted-foreground">Nota final</p><p className="text-3xl font-black">{selected.score}</p><p className="text-sm font-bold text-primary">Classe {selected.grade}</p></div>
                </div>
                <div className={`mt-5 rounded-xl border p-4 ${verdict.tone === 'positive' ? 'border-emerald-500/30 bg-emerald-500/10' : verdict.tone === 'risk' ? 'border-red-500/30 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
                  <div className="flex items-center gap-2 font-black">{verdict.tone === 'positive' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : verdict.tone === 'risk' ? <AlertTriangle className="h-5 w-5 text-red-500" /> : <ShieldCheck className="h-5 w-5 text-amber-500" />}{verdict.label}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{verdict.text}</p>
                </div>
              </article>

              <article className="rounded-2xl border bg-card p-5">
                <div className="flex items-center gap-2"><Scale className="h-5 w-5 text-primary" /><h2 className="text-xl font-black">Composição da nota</h2></div>
                <div className="mt-4 space-y-4">
                  {factors.map((factor) => <FactorRow key={factor.label} factor={factor} />)}
                </div>
              </article>

              <article className="rounded-2xl border bg-card p-5">
                <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><h2 className="text-xl font-black">Leitura auditável</h2></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Audit label="Melhor cotação" value={selected.source.bestOdd.toFixed(2)} />
                  <Audit label="Casa com melhor cotação" value={selected.source.bestBookmaker || 'Não informada'} />
                  <Audit label="Vantagem calculada" value={`${selected.source.edgePct.toFixed(1)}%`} />
                  <Audit label="Casas comparadas" value={String(selected.source.bookmakersCompared)} />
                  <Audit label="Confiança informada" value={selected.source.confidence} />
                  <Audit label="Situação do mercado" value={selected.source.discovery ? 'Em descoberta' : 'Validado pelas regras atuais'} />
                </div>
                <p className="mt-4 text-xs text-muted-foreground">Esta explicação reproduz a regra atual de pontuação. Ela não substitui a análise de contexto da partida, liquidez real e atualização das cotações.</p>
              </article>
            </>
          ) : <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-muted-foreground">Selecione uma decisão para visualizar a explicação.</div>}
        </section>
      </section>

      {lastUpdated && <p className="mt-5 text-xs text-muted-foreground">Dados atualizados em {new Date(lastUpdated).toLocaleString('pt-BR')}.</p>}
    </main>
  );
}

function FactorRow({ factor }: { factor: Factor }) {
  const width = Math.min(100, Math.max(0, factor.value / factor.maximum * 100));
  const tone = factor.tone === 'positive' ? 'text-emerald-500' : factor.tone === 'risk' ? 'text-red-500' : 'text-amber-500';
  return <div className="rounded-xl border bg-background p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-black"><Gauge className={`h-4 w-4 ${tone}`} />{factor.label}</div><div className="font-black">{factor.value.toFixed(1)} / {factor.maximum}</div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} /></div><p className="mt-3 text-sm text-muted-foreground">{factor.explanation}</p></div>;
}

function Audit({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-black">{value}</p></div>;
}
