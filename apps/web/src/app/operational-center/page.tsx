'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowDown, ArrowDownRight, ArrowUp, ArrowUpRight, BrainCircuit, CheckCircle2, Clock3, Gauge, Radar, RefreshCw, Save, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { PERFORMANCE_OPERATIONS_KEY, type PerformanceOperation } from '@/lib/performanceOperations';

type Recommendation = 'ENTRAR AGORA' | 'AGUARDAR' | 'NÃO ENTRAR' | 'MERCADO INSTÁVEL' | 'OPORTUNIDADE PRÓXIMA';
type Confidence = 'Alta' | 'Média' | 'Baixa';
type RiskProfile = 'Conservador' | 'Equilibrado' | 'Agressivo';
type Movement = {
  id: string; match: string; market: string; selection: string; bookmaker: string;
  previousOdd: number; currentOdd: number; relativeChangePct: number; velocityPctPerMinute: number;
  severityScore: number; severity: 'NORMAL' | 'MODERADA' | 'ALTA' | 'CRÍTICA';
  direction: 'QUEDA' | 'ALTA'; anomaly: boolean; capturedAt: string;
};
type MovementResponse = { configured: boolean; movements: Movement[]; error?: string; generatedAt: string };
type Opportunity = {
  id: string; match: string; league: string; minute: number; market: string; line: number; odds: number;
  probability: number; confidence: Confidence; liquidity: number; trend: number; context: number;
  leagueHistory: number; patternStrength: number; portfolioRisk: number; stoppageEstimate: number;
  officialStoppage?: number; dangerousAttacks: number; explanation: string;
};

const opportunities: Opportunity[] = [
  { id: '1', match: 'Fluminense x Bahia', league: 'Brasileirão Série A', minute: 68, market: 'Mais de escanteios', line: 9.5, odds: 1.94, probability: 0.61, confidence: 'Alta', liquidity: 0.84, trend: 0.74, context: 0.82, leagueHistory: 0.71, patternStrength: 0.79, portfolioRisk: 0.22, stoppageEstimate: 7, dangerousAttacks: 54, explanation: 'Pressão ofensiva sustentada, ritmo acima da média e preço ainda superior ao valor justo estimado.' },
  { id: '2', match: 'Palmeiras x Fortaleza', league: 'Brasileirão Série A', minute: 57, market: 'Mais de escanteios', line: 8.5, odds: 1.82, probability: 0.58, confidence: 'Média', liquidity: 0.92, trend: 0.62, context: 0.68, leagueHistory: 0.76, patternStrength: 0.66, portfolioRisk: 0.48, stoppageEstimate: 6, dangerousAttacks: 42, explanation: 'Mercado com boa liquidez, mas a exposição atual recomenda aguardar confirmação de nova sequência ofensiva.' },
  { id: '3', match: 'River Plate x Racing', league: 'Liga Argentina', minute: 76, market: 'Mais de escanteios', line: 10.5, odds: 2.18, probability: 0.49, confidence: 'Baixa', liquidity: 0.56, trend: 0.81, context: 0.61, leagueHistory: 0.54, patternStrength: 0.58, portfolioRisk: 0.31, stoppageEstimate: 8, dangerousAttacks: 47, explanation: 'A cotação subiu e criou potencial de valor, porém a amostra da liga e a confiança ainda são insuficientes.' }
];

function clamp(value: number, min = 0, max = 100) { return Math.max(min, Math.min(max, value)); }
function pct(value: number) { return `${(value * 100).toFixed(1)}%`; }
function signedPct(value: number) { return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`; }
function brl(value: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

function findMovement(item: Opportunity, movements: Movement[]) {
  const target = normalize(item.match);
  const candidates = movements.filter(movement => normalize(movement.match) === target);
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.severityScore - a.severityScore)[0];
}

function movementImpact(movement: Movement | null) {
  if (!movement) return 0;
  const strength = Math.min(8, movement.severityScore / 12.5);
  return movement.direction === 'QUEDA' ? strength : -strength * 0.65;
}

function calculateScore(item: Opportunity, movement: Movement | null) {
  const implied = 1 / item.odds;
  const ev = item.probability * item.odds - 1;
  const confidence = item.confidence === 'Alta' ? 1 : item.confidence === 'Média' ? 0.67 : 0.34;
  const score = item.probability * 25 + clamp(ev * 5, 0, 1) * 20 + confidence * 15 + clamp((item.probability - implied) * 8, 0, 1) * 10 + item.patternStrength * 10 + item.liquidity * 5 + item.trend * 5 + item.context * 5 + item.leagueHistory * 5 - item.portfolioRisk * 8 + movementImpact(movement);
  return clamp(score);
}

function grade(score: number) { if (score >= 90) return 'S+'; if (score >= 82) return 'S'; if (score >= 72) return 'A'; if (score >= 60) return 'B'; if (score >= 45) return 'C'; return 'D'; }
function recommendation(item: Opportunity, score: number, movement: Movement | null): Recommendation {
  const ev = item.probability * item.odds - 1;
  if (movement?.severity === 'CRÍTICA' && movement.direction === 'ALTA') return 'MERCADO INSTÁVEL';
  if (item.portfolioRisk > 0.7 || item.liquidity < 0.35) return 'MERCADO INSTÁVEL';
  if (score >= 78 && ev >= 0.06 && item.confidence !== 'Baixa') return 'ENTRAR AGORA';
  if (movement?.anomaly && movement.direction === 'QUEDA' && score >= 68 && ev > 0) return 'OPORTUNIDADE PRÓXIMA';
  if (score >= 64 && ev > 0) return 'AGUARDAR';
  if (item.trend > 0.75 && ev > -0.02) return 'OPORTUNIDADE PRÓXIMA';
  return 'NÃO ENTRAR';
}

export default function OperationalCenterPage() {
  const [risk, setRisk] = useState<RiskProfile>('Equilibrado');
  const [bankroll, setBankroll] = useState(1000);
  const [selected, setSelected] = useState(opportunities[0].id);
  const [cornerDelta, setCornerDelta] = useState(0);
  const [oddsDelta, setOddsDelta] = useState(0);
  const [stoppageDelta, setStoppageDelta] = useState(0);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movementConfigured, setMovementConfigured] = useState<boolean | null>(null);
  const [movementError, setMovementError] = useState('');
  const [movementLoading, setMovementLoading] = useState(true);
  const [registeredMessage, setRegisteredMessage] = useState('');

  async function loadMovements() {
    setMovementLoading(true); setMovementError('');
    try {
      const response = await fetch('/api/odds/movements?minutes=30&limit=150', { cache: 'no-store' });
      const payload = await response.json() as MovementResponse;
      setMovementConfigured(payload.configured);
      setMovements(Array.isArray(payload.movements) ? payload.movements : []);
      if (!response.ok || payload.error) setMovementError(payload.error || 'Não foi possível consultar os movimentos de odds.');
    } catch { setMovementError('Não foi possível consultar os movimentos de odds.'); }
    finally { setMovementLoading(false); }
  }

  useEffect(() => { void loadMovements(); }, []);

  const ranked = useMemo(() => opportunities.map(item => {
    const movement = findMovement(item, movements);
    const score = calculateScore(item, movement);
    const ev = item.probability * item.odds - 1;
    return { ...item, movement, movementImpact: movementImpact(movement), score, ev, grade: grade(score), recommendation: recommendation(item, score, movement) };
  }).sort((a, b) => b.score - a.score), [movements]);

  const current = ranked.find(item => item.id === selected) || ranked[0];
  const simulatedProbability = clamp((current.probability * 100) + cornerDelta * 5 + stoppageDelta * 0.7, 1, 99) / 100;
  const simulatedOdds = Math.max(1.01, current.odds + oddsDelta);
  const simulatedEv = simulatedProbability * simulatedOdds - 1;
  const fullKelly = Math.max(0, (simulatedProbability * simulatedOdds - 1) / (simulatedOdds - 1));
  const multiplier = risk === 'Conservador' ? 0.25 : risk === 'Equilibrado' ? 0.5 : 1;
  const recommendedStake = bankroll * fullKelly * multiplier;
  const simulatedScore = clamp(current.score + cornerDelta * 2 + stoppageDelta * 0.4 + oddsDelta * 10);

  function registerOperation() {
    const stake = Math.max(0, Number(recommendedStake.toFixed(2)));
    if (stake <= 0 || simulatedEv <= 0) {
      setRegisteredMessage('A entrada não foi registrada porque o cenário atual não possui stake positiva e EV favorável.');
      return;
    }
    try {
      const parsed = JSON.parse(window.localStorage.getItem(PERFORMANCE_OPERATIONS_KEY) || '[]');
      const operations: PerformanceOperation[] = Array.isArray(parsed) ? parsed : [];
      const operation: PerformanceOperation = {
        id: `operational-${Date.now()}-${current.id}`,
        date: new Date().toISOString(),
        match: current.match,
        league: current.league,
        market: `${current.market} ${current.line} · Score ${simulatedScore.toFixed(0)} · Nota ${grade(simulatedScore)}`,
        odds: Number(simulatedOdds.toFixed(2)),
        stake,
        result: 'open',
      };
      window.localStorage.setItem(PERFORMANCE_OPERATIONS_KEY, JSON.stringify([operation, ...operations]));
      setRegisteredMessage(`Entrada registrada em Minha Performance: ${brl(stake)} a ${simulatedOdds.toFixed(2)}.`);
    } catch {
      setRegisteredMessage('Não foi possível registrar a entrada no histórico local.');
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-2"><div className="flex items-center gap-2 text-sm font-semibold text-primary"><BrainCircuit className="h-4 w-4" /> Decision Center 2.2</div><h1 className="text-3xl font-bold tracking-tight">IA Operacional</h1><p className="max-w-3xl text-muted-foreground">Decisão consolidada com probabilidade, EV, risco, padrões, movimentações reais de odds e registro direto no histórico.</p></header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric icon={Target} label="Melhor score" value={`${ranked[0].score.toFixed(0)}/100`} detail={`Nota ${ranked[0].grade}`} />
        <Metric icon={Sparkles} label="Entradas agora" value={`${ranked.filter(x => x.recommendation === 'ENTRAR AGORA').length}`} detail="Oportunidades aprovadas" />
        <Metric icon={Radar} label="Movimentos ligados" value={`${ranked.filter(x => x.movement).length}`} detail="Partidas com histórico encontrado" />
        <Metric icon={ShieldCheck} label="Risco médio" value={pct(ranked.reduce((s, x) => s + x.portfolioRisk, 0) / ranked.length)} detail="Exposição consolidada" />
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-semibold">Ranking inteligente de entradas</h2><p className="text-sm text-muted-foreground">O movimento de mercado pode adicionar ou retirar até 8 pontos do Score Operacional.</p></div><div className="flex gap-2"><button onClick={() => void loadMovements()} disabled={movementLoading} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${movementLoading ? 'animate-spin' : ''}`} />Atualizar mercado</button><select value={risk} onChange={e => setRisk(e.target.value as RiskProfile)} className="rounded-xl border bg-background px-3 py-2 text-sm"><option>Conservador</option><option>Equilibrado</option><option>Agressivo</option></select></div></div>
        {(movementConfigured === false || movementError) && <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{movementError || 'O histórico de odds ainda não está configurado. As decisões continuam usando os demais fatores, sem inventar movimentações.'}</div>}
        <div className="space-y-3">{ranked.map((item, index) => <button key={item.id} onClick={() => { setSelected(item.id); setRegisteredMessage(''); }} className={`w-full rounded-2xl border p-4 text-left transition ${selected === item.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted font-bold">#{index + 1}</div><div><div className="font-semibold">{item.match}</div><div className="text-sm text-muted-foreground">{item.league} · {item.minute}' · {item.market} {item.line}</div>{item.movement && <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-primary">{item.movement.direction === 'QUEDA' ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}{item.movement.direction} {signedPct(item.movement.relativeChangePct)} · impacto {item.movementImpact > 0 ? '+' : ''}{item.movementImpact.toFixed(1)}</div>}</div></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><Mini label="Score" value={item.score.toFixed(0)} /><Mini label="Nota" value={item.grade} /><Mini label="EV" value={pct(item.ev)} /><Mini label="Odd" value={item.odds.toFixed(2)} /><Mini label="Decisão" value={item.recommendation} wide /></div></div></button>)}</div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Gauge className="h-5 w-5" /><h2 className="text-xl font-semibold">Decisão consolidada</h2></div><div className="space-y-4"><div className="rounded-xl bg-muted p-4"><div className="text-sm text-muted-foreground">Recomendação</div><div className="mt-1 text-2xl font-bold">{current.recommendation}</div></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Mini label="Probabilidade" value={pct(current.probability)} /><Mini label="EV" value={pct(current.ev)} /><Mini label="Liquidez" value={pct(current.liquidity)} /><Mini label="Confiança" value={current.confidence} /></div><p className="rounded-xl border p-4 text-sm leading-6">{current.explanation}</p><div className="grid gap-2 text-sm"><Reason icon={Activity} label="Ritmo e contexto" value={pct(current.context)} /><Reason icon={ArrowUp} label="Tendência de mercado" value={pct(current.trend)} /><Reason icon={BrainCircuit} label="Força dos padrões" value={pct(current.patternStrength)} /><Reason icon={ShieldCheck} label="Risco de portfólio" value={pct(current.portfolioRisk)} invert /><Reason icon={Clock3} label="Acréscimos estimados" value={`${current.stoppageEstimate} min`} /></div>{current.movement ? <div className="rounded-xl border bg-muted/40 p-4 text-sm"><div className="flex items-center justify-between"><span className="font-semibold">Leitura do mercado</span><span className="font-bold">{current.movement.severity}</span></div><p className="mt-2">{current.movement.bookmaker}: {current.movement.previousOdd.toFixed(2)} → {current.movement.currentOdd.toFixed(2)} ({signedPct(current.movement.relativeChangePct)}). Impacto no score: {current.movementImpact > 0 ? '+' : ''}{current.movementImpact.toFixed(1)}.</p><p className="mt-2 text-xs text-muted-foreground">A direção e a intensidade são fatos observados. A causa da movimentação não é presumida.</p></div> : <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhum histórico correspondente foi encontrado para esta partida. O fator mercado foi mantido neutro.</div>}</div></div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5" /><h2 className="text-xl font-semibold">Simulador “E se...”</h2></div><div className="space-y-4"><label className="block text-sm font-medium">Banca atual<input type="number" min="0" value={bankroll} onChange={e => setBankroll(Number(e.target.value) || 0)} className="mt-1 w-full rounded-xl border bg-background px-3 py-2" /></label><Scenario label="Novo escanteio" value={cornerDelta} setValue={setCornerDelta} min={-1} max={2} suffix="" /><Scenario label="Variação da odd" value={oddsDelta} setValue={setOddsDelta} min={-0.5} max={0.5} step={0.01} suffix="" /><Scenario label="Acréscimos adicionais" value={stoppageDelta} setValue={setStoppageDelta} min={-3} max={10} suffix=" min" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Mini label="Nova probabilidade" value={pct(simulatedProbability)} /><Mini label="Novo EV" value={pct(simulatedEv)} /><Mini label="Novo score" value={simulatedScore.toFixed(0)} /><Mini label="Nova nota" value={grade(simulatedScore)} /><Mini label="Kelly aplicado" value={pct(fullKelly * multiplier)} /><Mini label="Stake sugerida" value={brl(recommendedStake)} /></div>{simulatedEv < 0 && <div className="flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><AlertTriangle className="h-5 w-5 shrink-0" />O cenário simulado não apresenta valor esperado positivo. A IA não recomenda entrada.</div>}<button onClick={registerOperation} disabled={recommendedStake <= 0 || simulatedEv <= 0} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" />Registrar entrada em Minha Performance</button>{registeredMessage && <div className={`flex gap-2 rounded-xl border p-3 text-sm ${registeredMessage.startsWith('Entrada registrada') ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>{registeredMessage.startsWith('Entrada registrada') ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}{registeredMessage}</div>}</div></div>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail: string }) { return <div className="rounded-2xl border bg-card p-4 shadow-sm"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{label}</div><div className="mt-2 text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{detail}</div></div>; }
function Mini({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={`rounded-xl bg-muted px-3 py-2 ${wide ? 'sm:min-w-40' : ''}`}><div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div><div className="truncate text-sm font-semibold">{value}</div></div>; }
function Reason({ icon: Icon, label, value, invert = false }: { icon: typeof Activity; label: string; value: string; invert?: boolean }) { return <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2"><span className="flex items-center gap-2"><Icon className="h-4 w-4" />{label}</span><span className="font-semibold">{invert ? <ArrowDown className="mr-1 inline h-3 w-3" /> : null}{value}</span></div>; }
function Scenario({ label, value, setValue, min, max, step = 1, suffix }: { label: string; value: number; setValue: (value: number) => void; min: number; max: number; step?: number; suffix: string }) { return <label className="block"><div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="font-semibold">{value > 0 ? '+' : ''}{value}{suffix}</span></div><input type="range" min={min} max={max} step={step} value={value} onChange={e => setValue(Number(e.target.value))} className="w-full" /></label>; }