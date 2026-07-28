'use client';

import { useMemo, useState } from 'react';
import { Activity, Clock3, Flame, Gauge, Radar, Sparkles, Target, TrendingUp } from 'lucide-react';

type IntervalPrediction = {
  label: string;
  start: number;
  end: number;
  baseProbability: number;
  expectedCorners: number;
  pressure: number;
  volatility: number;
};

type MatchProfile = {
  id: string;
  match: string;
  league: string;
  minute: number;
  corners: number;
  dangerousAttacks: number;
  stoppageEstimate: number;
  pace: number;
  intervals: IntervalPrediction[];
};

const matches: MatchProfile[] = [
  {
    id: 'flu-bah',
    match: 'Fluminense x Bahia',
    league: 'Brasileirão Série A',
    minute: 68,
    corners: 7,
    dangerousAttacks: 54,
    stoppageEstimate: 7,
    pace: 0.79,
    intervals: [
      { label: '0–15', start: 0, end: 15, baseProbability: 0.38, expectedCorners: 1.1, pressure: 0.42, volatility: 0.34 },
      { label: '16–30', start: 16, end: 30, baseProbability: 0.46, expectedCorners: 1.3, pressure: 0.51, volatility: 0.39 },
      { label: '31–45+', start: 31, end: 48, baseProbability: 0.57, expectedCorners: 1.7, pressure: 0.64, volatility: 0.44 },
      { label: '46–60', start: 46, end: 60, baseProbability: 0.52, expectedCorners: 1.5, pressure: 0.59, volatility: 0.41 },
      { label: '61–75', start: 61, end: 75, baseProbability: 0.74, expectedCorners: 2.1, pressure: 0.82, volatility: 0.58 },
      { label: '76–90+', start: 76, end: 99, baseProbability: 0.81, expectedCorners: 2.5, pressure: 0.88, volatility: 0.65 },
    ],
  },
  {
    id: 'pal-for',
    match: 'Palmeiras x Fortaleza',
    league: 'Brasileirão Série A',
    minute: 57,
    corners: 5,
    dangerousAttacks: 42,
    stoppageEstimate: 6,
    pace: 0.67,
    intervals: [
      { label: '0–15', start: 0, end: 15, baseProbability: 0.41, expectedCorners: 1.2, pressure: 0.47, volatility: 0.31 },
      { label: '16–30', start: 16, end: 30, baseProbability: 0.49, expectedCorners: 1.4, pressure: 0.55, volatility: 0.36 },
      { label: '31–45+', start: 31, end: 48, baseProbability: 0.55, expectedCorners: 1.6, pressure: 0.61, volatility: 0.43 },
      { label: '46–60', start: 46, end: 60, baseProbability: 0.63, expectedCorners: 1.8, pressure: 0.71, volatility: 0.49 },
      { label: '61–75', start: 61, end: 75, baseProbability: 0.68, expectedCorners: 1.9, pressure: 0.75, volatility: 0.52 },
      { label: '76–90+', start: 76, end: 99, baseProbability: 0.72, expectedCorners: 2.1, pressure: 0.78, volatility: 0.59 },
    ],
  },
  {
    id: 'riv-rac',
    match: 'River Plate x Racing',
    league: 'Liga Argentina',
    minute: 76,
    corners: 8,
    dangerousAttacks: 47,
    stoppageEstimate: 8,
    pace: 0.72,
    intervals: [
      { label: '0–15', start: 0, end: 15, baseProbability: 0.35, expectedCorners: 1.0, pressure: 0.39, volatility: 0.42 },
      { label: '16–30', start: 16, end: 30, baseProbability: 0.44, expectedCorners: 1.2, pressure: 0.48, volatility: 0.46 },
      { label: '31–45+', start: 31, end: 48, baseProbability: 0.51, expectedCorners: 1.5, pressure: 0.56, volatility: 0.51 },
      { label: '46–60', start: 46, end: 60, baseProbability: 0.58, expectedCorners: 1.7, pressure: 0.63, volatility: 0.55 },
      { label: '61–75', start: 61, end: 75, baseProbability: 0.69, expectedCorners: 2.0, pressure: 0.74, volatility: 0.63 },
      { label: '76–90+', start: 76, end: 99, baseProbability: 0.77, expectedCorners: 2.3, pressure: 0.83, volatility: 0.71 },
    ],
  },
];

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function pct(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function intensity(probability: number) {
  if (probability >= 0.78) return 'Muito alta';
  if (probability >= 0.66) return 'Alta';
  if (probability >= 0.52) return 'Moderada';
  if (probability >= 0.4) return 'Baixa';
  return 'Muito baixa';
}

export default function IntervalPredictionPage() {
  const [selectedId, setSelectedId] = useState(matches[0].id);
  const [pressureDelta, setPressureDelta] = useState(0);
  const [stoppageDelta, setStoppageDelta] = useState(0);
  const [paceDelta, setPaceDelta] = useState(0);

  const current = matches.find(match => match.id === selectedId) || matches[0];

  const adjusted = useMemo(() => current.intervals.map(interval => {
    const future = current.minute <= interval.end;
    const liveBoost = future ? pressureDelta * 0.012 + paceDelta * 0.01 : 0;
    const stoppageBoost = interval.label.includes('90') ? stoppageDelta * 0.008 : 0;
    const probability = clamp(interval.baseProbability + liveBoost + stoppageBoost);
    return {
      ...interval,
      probability,
      expectedCorners: Math.max(0, interval.expectedCorners + liveBoost * 3 + stoppageBoost * 2),
    };
  }), [current, paceDelta, pressureDelta, stoppageDelta]);

  const futureIntervals = adjusted.filter(interval => current.minute <= interval.end);
  const best = futureIntervals.reduce((winner, item) => item.probability > winner.probability ? item : winner, futureIntervals[0] || adjusted[adjusted.length - 1]);
  const next = futureIntervals[0] || adjusted[adjusted.length - 1];
  const projectedRemaining = futureIntervals.reduce((sum, interval) => sum + interval.expectedCorners, 0);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Clock3 className="h-4 w-4" /> Motor de Predição Temporal</div>
        <h1 className="text-3xl font-bold tracking-tight">Predição de Escanteios por Intervalo</h1>
        <p className="max-w-3xl text-muted-foreground">Probabilidade, ritmo e pressão ofensiva distribuídos em janelas de jogo, incluindo acréscimos estimados e mapa de calor temporal.</p>
      </header>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <label className="text-sm font-medium">Partida analisada</label>
        <select value={selectedId} onChange={event => setSelectedId(event.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2 sm:max-w-md">
          {matches.map(match => <option key={match.id} value={match.id}>{match.match} · {match.league}</option>)}
        </select>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric icon={Target} label="Melhor janela futura" value={best.label} detail={`${pct(best.probability)} de chance`} />
        <Metric icon={Radar} label="Próxima janela" value={next.label} detail={intensity(next.probability)} />
        <Metric icon={TrendingUp} label="Escanteios projetados" value={projectedRemaining.toFixed(1)} detail="Até o fim da partida" />
        <Metric icon={Clock3} label="Fim real projetado" value={`${90 + current.stoppageEstimate + stoppageDelta}'`} detail="Com acréscimos da IA" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2"><Flame className="h-5 w-5" /><h2 className="text-xl font-semibold">Mapa de calor temporal</h2></div>
          <div className="space-y-4">
            {adjusted.map(interval => {
              const elapsed = current.minute > interval.end;
              const active = current.minute >= interval.start && current.minute <= interval.end;
              return (
                <div key={interval.label} className={`rounded-2xl border p-4 ${active ? 'border-primary bg-primary/5' : ''}`}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{interval.label} minutos {active && <span className="ml-2 text-xs text-primary">JANELA ATUAL</span>}</div>
                      <div className="text-sm text-muted-foreground">{elapsed ? 'Intervalo concluído' : intensity(interval.probability)}</div>
                    </div>
                    <div className="text-right"><div className="text-2xl font-bold">{pct(interval.probability)}</div><div className="text-xs text-muted-foreground">chance de novo escanteio</div></div>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${interval.probability * 100}%`, opacity: elapsed ? 0.45 : 1 }} /></div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    <Mini label="Esperados" value={interval.expectedCorners.toFixed(1)} />
                    <Mini label="Pressão" value={pct(interval.pressure)} />
                    <Mini label="Volatilidade" value={pct(interval.volatility)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2"><Gauge className="h-5 w-5" /><h2 className="text-xl font-semibold">Estado atual</h2></div>
            <div className="grid grid-cols-2 gap-3">
              <Mini label="Minuto" value={`${current.minute}'`} />
              <Mini label="Escanteios" value={`${current.corners}`} />
              <Mini label="Ataques perigosos" value={`${current.dangerousAttacks}`} />
              <Mini label="Ritmo" value={pct(current.pace)} />
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5" /><h2 className="text-xl font-semibold">Simulação dinâmica</h2></div>
            <div className="space-y-4">
              <Slider label="Pressão ofensiva" value={pressureDelta} setValue={setPressureDelta} min={-10} max={20} suffix=" pts" />
              <Slider label="Variação de ritmo" value={paceDelta} setValue={setPaceDelta} min={-10} max={20} suffix=" pts" />
              <Slider label="Acréscimos adicionais" value={stoppageDelta} setValue={setStoppageDelta} min={-3} max={10} suffix=" min" />
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2"><Activity className="h-5 w-5" /><h2 className="text-xl font-semibold">Leitura da IA</h2></div>
            <p className="text-sm leading-6 text-muted-foreground">A janela <strong className="text-foreground">{best.label}</strong> concentra a maior probabilidade futura. O modelo combina ritmo, pressão, volatilidade e tempo efetivo restante. Acréscimos maiores elevam especialmente a projeção da faixa final.</p>
          </section>
        </div>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border bg-card p-4 shadow-sm"><div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{label}</div><div className="text-2xl font-bold">{value}</div><div className="mt-1 text-sm text-muted-foreground">{detail}</div></div>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-muted p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-semibold">{value}</div></div>;
}

function Slider({ label, value, setValue, min, max, suffix }: { label: string; value: number; setValue: (value: number) => void; min: number; max: number; suffix: string }) {
  return <label className="block text-sm"><div className="mb-2 flex items-center justify-between"><span className="font-medium">{label}</span><span className="text-muted-foreground">{value > 0 ? '+' : ''}{value}{suffix}</span></div><input type="range" min={min} max={max} value={value} onChange={event => setValue(Number(event.target.value))} className="w-full" /></label>;
}
