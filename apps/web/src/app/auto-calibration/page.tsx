'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, BrainCircuit, Gauge, RefreshCw, Scale, ShieldCheck, SlidersHorizontal, Sparkles, Target } from 'lucide-react';
import { isSettledOperation, operationProfit, readPerformanceOperations, type PerformanceOperation } from '@/lib/performanceOperations';

type Weight = {
  key: string;
  label: string;
  current: number;
  proposed: number;
  reason: string;
};

const CALIBRATION_KEY = 'ia-cantos-calibration-draft-v1';

const BASE_WEIGHTS = [
  { key: 'iaScore', label: 'Nota da IA', current: 25 },
  { key: 'ev', label: 'Valor esperado', current: 20 },
  { key: 'confidence', label: 'Confiança', current: 15 },
  { key: 'kelly', label: 'Kelly', current: 10 },
  { key: 'consensus', label: 'Consenso', current: 10 },
  { key: 'liquidity', label: 'Liquidez', current: 5 },
  { key: 'volatility', label: 'Volatilidade', current: 5 },
  { key: 'trend', label: 'Tendência', current: 5 },
  { key: 'context', label: 'Contexto', current: 5 },
];

function normalizedWeights(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const scaled = values.map((value) => Math.round((value / total) * 100));
  const difference = 100 - scaled.reduce((sum, value) => sum + value, 0);
  scaled[0] += difference;
  return scaled;
}

export default function AutoCalibrationPage() {
  const [operations, setOperations] = useState<PerformanceOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  function load() {
    setLoading(true);
    setOperations(readPerformanceOperations());
    setSaved(false);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const analysis = useMemo(() => {
    const settled = operations.filter(isSettledOperation);
    const decisive = settled.filter((operation) => operation.result === 'win' || operation.result === 'loss');
    const wins = decisive.filter((operation) => operation.result === 'win').length;
    const stake = settled.reduce((sum, operation) => sum + operation.stake, 0);
    const result = settled.reduce((sum, operation) => sum + operationProfit(operation), 0);
    const roi = stake > 0 ? result / stake * 100 : 0;
    const hitRate = decisive.length ? wins / decisive.length * 100 : 0;
    const enough = settled.length >= 30;
    const reliable = settled.length >= 100;

    const adjustments = BASE_WEIGHTS.map((weight) => {
      let delta = 0;
      let reason = 'Peso preservado até existir evidência suficiente.';
      if (enough) {
        if (weight.key === 'ev') {
          delta = roi > 5 ? 3 : roi < 0 ? -2 : 1;
          reason = roi > 5 ? 'ROI positivo favorece maior influência do valor esperado.' : roi < 0 ? 'ROI negativo recomenda redução temporária.' : 'ROI estável permite pequeno teste controlado.';
        } else if (weight.key === 'confidence') {
          delta = hitRate >= 60 ? 2 : hitRate < 50 ? -2 : 0;
          reason = hitRate >= 60 ? 'Taxa de acerto sustenta maior peso para confiança.' : hitRate < 50 ? 'Taxa de acerto baixa exige cautela.' : 'Taxa de acerto ainda neutra.';
        } else if (weight.key === 'volatility') {
          delta = roi < 0 ? 2 : -1;
          reason = roi < 0 ? 'Resultado negativo aumenta a proteção contra mercados voláteis.' : 'Desempenho positivo permite reduzir levemente a penalização.';
        } else if (weight.key === 'context') {
          delta = reliable ? 1 : 0;
          reason = reliable ? 'Amostra confiável permite testar maior influência contextual.' : 'Amostra ainda em formação.';
        }
      }
      return { ...weight, raw: Math.max(1, weight.current + delta), reason };
    });

    const proposedValues = normalizedWeights(adjustments.map((item) => item.raw));
    const weights: Weight[] = adjustments.map((item, index) => ({
      key: item.key,
      label: item.label,
      current: item.current,
      proposed: proposedValues[index],
      reason: item.reason,
    }));

    const maxChange = Math.max(...weights.map((weight) => Math.abs(weight.proposed - weight.current)));
    const status = !enough ? 'Bloqueada por amostra' : reliable ? 'Pronta para simulação' : 'Simulação controlada';
    return { settled, roi, hitRate, weights, maxChange, status, enough, reliable };
  }, [operations]);

  function saveDraft() {
    if (!analysis.enough || typeof window === 'undefined') return;
    window.localStorage.setItem(CALIBRATION_KEY, JSON.stringify({
      createdAt: new Date().toISOString(),
      sampleSize: analysis.settled.length,
      roi: analysis.roi,
      hitRate: analysis.hitRate,
      weights: analysis.weights,
      mode: 'simulation-only',
    }));
    setSaved(true);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-black text-primary"><SlidersHorizontal className="h-4 w-4" /> Calibração Automática</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Centro de Calibração dos Pesos</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">Transforma o aprendizado observado em uma proposta auditável de novos pesos, sem alterar automaticamente o modelo que está em produção.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Recalcular</button>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Target} label="Amostra liquidada" value={String(analysis.settled.length)} />
        <Metric icon={Activity} label="ROI observado" value={`${analysis.roi.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`} />
        <Metric icon={Gauge} label="Taxa de acerto" value={`${analysis.hitRate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`} />
        <Metric icon={ShieldCheck} label="Situação" value={analysis.status} />
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2"><Scale className="h-5 w-5 text-primary" /><h2 className="text-xl font-black">Pesos atuais × proposta do desafiante</h2></div>
        <p className="mt-1 text-sm text-muted-foreground">A soma permanece em 100%. Nenhuma alteração ultrapassa o limite de segurança definido para a primeira simulação.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-muted-foreground"><tr className="border-b"><th className="p-3">Fator</th><th className="p-3">Atual</th><th className="p-3">Proposto</th><th className="p-3">Variação</th><th className="p-3">Justificativa</th></tr></thead>
            <tbody>{analysis.weights.map((weight) => { const change = weight.proposed - weight.current; return <tr key={weight.key} className="border-b last:border-0"><td className="p-3 font-black">{weight.label}</td><td className="p-3">{weight.current}%</td><td className="p-3 font-black text-primary">{weight.proposed}%</td><td className={`p-3 font-bold ${change > 0 ? 'text-emerald-500' : change < 0 ? 'text-red-500' : ''}`}>{change > 0 ? '+' : ''}{change} p.p.</td><td className="p-3 text-muted-foreground">{weight.reason}</td></tr>; })}</tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        <Guard title="Amostra mínima" value={analysis.enough ? 'Aprovada' : 'Não atingida'} description={analysis.enough ? 'Há pelo menos 30 operações liquidadas para criar um desafiante.' : `Faltam ${Math.max(0, 30 - analysis.settled.length)} operações liquidadas.`} />
        <Guard title="Limite de mudança" value={`${analysis.maxChange} p.p.`} description="Mudanças pequenas reduzem o risco de sobreajuste e preservam a estabilidade do modelo." />
        <Guard title="Destino da proposta" value="Somente simulação" description="O rascunho será enviado ao Laboratório de Previsões e não altera o modelo Campeão." />
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" /><h2 className="text-xl font-black">Governança da calibração</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Step number="1" title="Aprender" text="Consolidar resultados reais e medir estabilidade da amostra." />
          <Step number="2" title="Simular" text="Aplicar os pesos propostos apenas ao Modelo Desafiante." />
          <Step number="3" title="Promover" text="Trocar o Campeão somente após superioridade consistente e auditável." />
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{analysis.enough ? 'A proposta pode ser salva para a próxima simulação controlada.' : 'A calibração permanece bloqueada até atingir a amostra mínima.'}</p>
          <button onClick={saveDraft} disabled={!analysis.enough} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"><Sparkles className="h-4 w-4" /> {saved ? 'Proposta salva' : 'Salvar proposta de simulação'}</button>
        </div>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return <div className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div>;
}

function Guard({ title, value, description }: { title: string; value: string; description: string }) {
  return <article className="rounded-2xl border bg-card p-4"><p className="text-xs font-semibold text-muted-foreground">{title}</p><h3 className="mt-2 text-xl font-black">{value}</h3><p className="mt-2 text-sm text-muted-foreground">{description}</p></article>;
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <article className="rounded-xl border bg-background p-4"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-sm font-black text-primary">{number}</span><h3 className="mt-3 font-black">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{text}</p></article>;
}
