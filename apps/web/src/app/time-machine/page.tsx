'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { AlertTriangle, BrainCircuit, Clock3, FileJson, Gauge, History, LineChart, ShieldCheck, Target } from 'lucide-react';

type Snapshot = {
  minute: number;
  label?: string;
  score?: string;
  corners?: number;
  shots?: number;
  dangerousAttacks?: number;
  possession?: number;
  stoppedMinutes?: number;
  predictedAddedMinutes?: number;
  officialAddedMinutes?: number;
  marketLine?: number;
  bestOdd?: number;
  probability?: number;
  expectedValue?: number;
  grade?: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D';
  decision?: 'bet' | 'monitor' | 'avoid';
  explanation?: string;
};

type ReplayMatch = {
  id: string;
  match: string;
  league?: string;
  date?: string;
  finalResult?: string;
  snapshots: Snapshot[];
};

const STORAGE_KEY = 'ia-cantos-temporal-replays-v1';

function readReplays(): ReplayMatch[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeReplay(input: unknown): ReplayMatch[] {
  const rows = Array.isArray(input) ? input : [input];
  return rows.filter((item): item is ReplayMatch => {
    if (!item || typeof item !== 'object') return false;
    const value = item as ReplayMatch;
    return typeof value.id === 'string' && typeof value.match === 'string' && Array.isArray(value.snapshots);
  }).map((item) => ({
    ...item,
    snapshots: item.snapshots
      .filter((snapshot) => snapshot && Number.isFinite(Number(snapshot.minute)))
      .map((snapshot) => ({ ...snapshot, minute: Number(snapshot.minute) }))
      .sort((a, b) => a.minute - b.minute),
  }));
}

function decisionLabel(value?: Snapshot['decision']) {
  if (value === 'bet') return 'Entrada recomendada';
  if (value === 'monitor') return 'Monitorar';
  if (value === 'avoid') return 'Evitar';
  return 'Não calculado';
}

function formatNumber(value?: number, suffix = '') {
  return Number.isFinite(value) ? `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${suffix}` : 'Não informado';
}

export default function TimeMachinePage() {
  const [replays, setReplays] = useState<ReplayMatch[]>(() => readReplays());
  const [selectedId, setSelectedId] = useState(() => readReplays()[0]?.id ?? '');
  const [minuteIndex, setMinuteIndex] = useState(0);
  const [error, setError] = useState('');

  const selected = replays.find((item) => item.id === selectedId) ?? replays[0];
  const snapshot = selected?.snapshots[Math.min(minuteIndex, Math.max(0, (selected?.snapshots.length ?? 1) - 1))];

  const peak = useMemo(() => {
    if (!selected?.snapshots.length) return null;
    return [...selected.snapshots]
      .filter((item) => Number.isFinite(item.expectedValue))
      .sort((a, b) => (b.expectedValue ?? -Infinity) - (a.expectedValue ?? -Infinity))[0] ?? null;
  }, [selected]);

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const parsed = JSON.parse(await file.text());
      const imported = normalizeReplay(parsed);
      if (!imported.length) throw new Error('O arquivo não contém partidas e snapshots válidos.');
      const merged = [...replays.filter((existing) => !imported.some((item) => item.id === existing.id)), ...imported];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      setReplays(merged);
      setSelectedId(imported[0].id);
      setMinuteIndex(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível importar o arquivo.');
    } finally {
      event.target.value = '';
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-black text-primary"><History className="h-4 w-4" /> Simulador Temporal</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Máquina do Tempo da Partida</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">Reproduz somente os dados que estavam disponíveis em cada minuto, permitindo auditar a decisão da IA sem usar informações futuras.</p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground"><FileJson className="h-4 w-4" /> Importar replay JSON<input type="file" accept="application/json,.json" className="hidden" onChange={importJson} /></label>
      </header>

      {error && <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">{error}</div>}

      {!selected ? (
        <section className="mt-6 rounded-2xl border border-dashed bg-card p-8 text-center">
          <FileJson className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-xl font-black">Nenhum replay temporal disponível</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">Importe snapshots históricos reais. O módulo não cria números de exemplo nem reconstrói dados que não tenham sido capturados durante a partida.</p>
        </section>
      ) : (
        <>
          <section className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto]">
            <select value={selected.id} onChange={(event) => { setSelectedId(event.target.value); setMinuteIndex(0); }} className="min-h-11 rounded-xl border bg-card px-4 font-bold">
              {replays.map((item) => <option key={item.id} value={item.id}>{item.match}{item.league ? ` — ${item.league}` : ''}</option>)}
            </select>
            <div className="rounded-xl border bg-card px-4 py-3 text-sm"><span className="text-muted-foreground">Snapshots:</span> <strong>{selected.snapshots.length}</strong></div>
          </section>

          <section className="mt-5 rounded-2xl border bg-card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-xl font-black">{selected.match}</h2><p className="text-sm text-muted-foreground">{selected.league ?? 'Liga não informada'}{selected.date ? ` · ${new Date(selected.date).toLocaleDateString('pt-BR')}` : ''}</p></div>
              <div className="rounded-xl border bg-background px-4 py-2 text-center"><div className="text-xs text-muted-foreground">Minuto selecionado</div><div className="text-2xl font-black text-primary">{snapshot?.label ?? `${snapshot?.minute ?? 0}'`}</div></div>
            </div>
            <input type="range" min={0} max={Math.max(0, selected.snapshots.length - 1)} value={Math.min(minuteIndex, Math.max(0, selected.snapshots.length - 1))} onChange={(event) => setMinuteIndex(Number(event.target.value))} className="mt-5 w-full" />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{selected.snapshots[0]?.label ?? `${selected.snapshots[0]?.minute ?? 0}'`}</span><span>{selected.snapshots.at(-1)?.label ?? `${selected.snapshots.at(-1)?.minute ?? 0}'`}</span></div>
          </section>

          <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric icon={Clock3} label="Placar" value={snapshot?.score ?? 'Não informado'} />
            <Metric icon={Target} label="Escanteios" value={formatNumber(snapshot?.corners)} />
            <Metric icon={Gauge} label="Probabilidade" value={formatNumber(snapshot?.probability, '%')} />
            <Metric icon={ShieldCheck} label="Decisão da IA" value={decisionLabel(snapshot?.decision)} />
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" /><h2 className="text-xl font-black">Replay da decisão</h2></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Data label="Linha disponível" value={formatNumber(snapshot?.marketLine)} />
                <Data label="Melhor cotação" value={formatNumber(snapshot?.bestOdd)} />
                <Data label="Valor esperado" value={formatNumber(snapshot?.expectedValue, '%')} />
                <Data label="Classificação" value={snapshot?.grade ?? 'Não calculada'} />
                <Data label="Tempo parado" value={formatNumber(snapshot?.stoppedMinutes, ' min')} />
                <Data label="Acréscimos estimados" value={formatNumber(snapshot?.predictedAddedMinutes, ' min')} />
                <Data label="Acréscimos oficiais" value={formatNumber(snapshot?.officialAddedMinutes, ' min')} />
                <Data label="Ataques perigosos" value={formatNumber(snapshot?.dangerousAttacks)} />
              </div>
              <div className="mt-4 rounded-xl border bg-background p-4"><p className="text-xs font-semibold text-muted-foreground">Explicação registrada naquele momento</p><p className="mt-2 text-sm">{snapshot?.explanation ?? 'A fonte histórica não armazenou uma explicação para este snapshot.'}</p></div>
            </article>

            <article className="rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-2"><LineChart className="h-5 w-5 text-primary" /><h2 className="text-xl font-black">Evolução temporal</h2></div>
              <div className="mt-4 space-y-2">
                {selected.snapshots.map((item, index) => (
                  <button key={`${item.minute}-${index}`} onClick={() => setMinuteIndex(index)} className={`grid w-full grid-cols-[60px_1fr_auto] items-center gap-3 rounded-xl border p-3 text-left ${index === minuteIndex ? 'border-primary bg-primary/5' : 'bg-background'}`}>
                    <span className="font-black text-primary">{item.label ?? `${item.minute}'`}</span>
                    <span className="text-sm text-muted-foreground">{decisionLabel(item.decision)}</span>
                    <span className="font-black">{Number.isFinite(item.probability) ? `${item.probability}%` : '—'}</span>
                  </button>
                ))}
              </div>
            </article>
          </section>

          <section className="mt-5 grid gap-4 md:grid-cols-3">
            <Summary title="Melhor momento de valor" value={peak ? (peak.label ?? `${peak.minute}'`) : 'Não calculado'} detail={peak ? `EV registrado: ${formatNumber(peak.expectedValue, '%')}` : 'Nenhum snapshot possui EV registrado.'} />
            <Summary title="Resultado final" value={selected.finalResult ?? 'Não informado'} detail="O resultado é exibido apenas para comparação posterior e não interfere nos cálculos anteriores." />
            <Summary title="Integridade temporal" value="Sem visão do futuro" detail="Cada minuto usa exclusivamente o snapshot capturado até aquele ponto da partida." />
          </section>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><p>Este módulo depende de snapshots históricos persistidos durante o jogo. Quando um campo não foi capturado, ele permanece como “Não informado”; o sistema não deve estimar retrospectivamente valores ausentes.</p></div>
        </>
      )}
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return <div className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><div className="mt-2 break-words text-xl font-black">{value}</div></div>;
}

function Data({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-black">{value}</p></div>;
}

function Summary({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <article className="rounded-2xl border bg-card p-4"><p className="text-xs font-semibold text-muted-foreground">{title}</p><h3 className="mt-2 text-xl font-black">{value}</h3><p className="mt-2 text-sm text-muted-foreground">{detail}</p></article>;
}
