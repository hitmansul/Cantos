'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BrainCircuit, MessageSquareText, RefreshCw, Search, Sparkles, WalletCards } from 'lucide-react';
import { PERFORMANCE_OPERATIONS_KEY, type PerformanceOperation } from '@/lib/performanceOperations';
import { formatUnits, readBettingUnitValue, readMaxDailyUnits, readMaxEntryUnits, stakeToUnits, unitsToStake } from '@/lib/unitSettings';

type Movement = { match: string; direction: 'QUEDA' | 'ALTA'; severityScore: number; severity: string; relativeChangePct: number; bookmaker: string };
type MovementResponse = { configured: boolean; movements: Movement[]; error?: string };
type Opportunity = { match: string; league: string; market: string; line: number; odds: number; probability: number; confidence: 'Alta' | 'Média' | 'Baixa'; liquidity: number; trend: number; context: number; patternStrength: number; portfolioRisk: number };
type Result = Opportunity & { ev: number; score: number; grade: string; decision: string; movement: Movement | null; recommendedUnits: number; recommendedStake: number };

const opportunities: Opportunity[] = [
  { match: 'Fluminense x Bahia', league: 'Brasileirão Série A', market: 'Mais de escanteios', line: 9.5, odds: 1.94, probability: 0.61, confidence: 'Alta', liquidity: 0.84, trend: 0.74, context: 0.82, patternStrength: 0.79, portfolioRisk: 0.22 },
  { match: 'Palmeiras x Fortaleza', league: 'Brasileirão Série A', market: 'Mais de escanteios', line: 8.5, odds: 1.82, probability: 0.58, confidence: 'Média', liquidity: 0.92, trend: 0.62, context: 0.68, patternStrength: 0.66, portfolioRisk: 0.48 },
  { match: 'River Plate x Racing', league: 'Liga Argentina', market: 'Mais de escanteios', line: 10.5, odds: 2.18, probability: 0.49, confidence: 'Baixa', liquidity: 0.56, trend: 0.81, context: 0.61, patternStrength: 0.58, portfolioRisk: 0.31 },
];

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const roundDownQuarter = (value: number) => Math.max(0, Math.floor((value + 1e-9) * 4) / 4);
function grade(score: number) { if (score >= 90) return 'S+'; if (score >= 82) return 'S'; if (score >= 72) return 'A'; if (score >= 60) return 'B'; if (score >= 45) return 'C'; return 'D'; }
function score(item: Opportunity, movement: Movement | null) { const ev = item.probability * item.odds - 1; const confidence = item.confidence === 'Alta' ? 1 : item.confidence === 'Média' ? 0.67 : 0.34; const movementImpact = movement ? (movement.direction === 'QUEDA' ? 1 : -0.65) * Math.min(8, movement.severityScore / 12.5) : 0; return clamp(item.probability * 25 + clamp(ev * 5, 0, 1) * 20 + confidence * 15 + item.patternStrength * 10 + item.liquidity * 5 + item.trend * 5 + item.context * 5 - item.portfolioRisk * 8 + movementImpact); }
function decision(item: Opportunity, scoreValue: number, movement: Movement | null) { const ev = item.probability * item.odds - 1; if (movement?.severity === 'CRÍTICA' && movement.direction === 'ALTA') return 'MERCADO INSTÁVEL'; if (scoreValue >= 78 && ev >= 0.06 && item.confidence !== 'Baixa') return 'ENTRAR AGORA'; if (movement?.direction === 'QUEDA' && movement.severityScore >= 40 && ev > 0) return 'OPORTUNIDADE PRÓXIMA'; if (scoreValue >= 64 && ev > 0) return 'AGUARDAR'; return 'NÃO ENTRAR'; }
function scoreUnits(scoreValue: number) { if (scoreValue >= 95) return 1.5; if (scoreValue >= 90) return 1; if (scoreValue >= 80) return 0.75; if (scoreValue >= 70) return 0.5; if (scoreValue >= 60) return 0.25; return 0; }

export default function AiAssistantPage() {
  const [question, setQuestion] = useState('Quais são as 3 melhores entradas agora?');
  const [submitted, setSubmitted] = useState(question);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [unitValue, setUnitValue] = useState(100);
  const [maxEntryUnits, setMaxEntryUnits] = useState(1);
  const [maxDailyUnits, setMaxDailyUnits] = useState(4);
  const [usedTodayUnits, setUsedTodayUnits] = useState(0);

  function loadRiskSettings() {
    const nextUnitValue = readBettingUnitValue();
    setUnitValue(nextUnitValue);
    setMaxEntryUnits(readMaxEntryUnits());
    setMaxDailyUnits(readMaxDailyUnits());
    try {
      const parsed = JSON.parse(window.localStorage.getItem(PERFORMANCE_OPERATIONS_KEY) || '[]');
      const operations: PerformanceOperation[] = Array.isArray(parsed) ? parsed : [];
      const today = new Date().toISOString().slice(0, 10);
      const stakeToday = operations.filter((item) => String(item.date).slice(0, 10) === today).reduce((sum, item) => sum + Number(item.stake || 0), 0);
      setUsedTodayUnits(stakeToUnits(stakeToday, nextUnitValue));
    } catch { setUsedTodayUnits(0); }
  }

  async function loadMovements() { setLoading(true); try { const response = await fetch('/api/odds/movements?minutes=30&limit=150', { cache: 'no-store' }); const payload = await response.json() as MovementResponse; setMovements(Array.isArray(payload.movements) ? payload.movements : []); } catch { setMovements([]); } finally { setLoading(false); } }
  useEffect(() => { loadRiskSettings(); void loadMovements(); }, []);

  const remainingDailyUnits = Math.max(0, maxDailyUnits - usedTodayUnits);
  const ranked = useMemo<Result[]>(() => opportunities.map((item) => {
    const movement = movements.find((candidate) => normalize(candidate.match) === normalize(item.match)) ?? null;
    const scoreValue = score(item, movement);
    const itemDecision = decision(item, scoreValue, movement);
    const units = itemDecision === 'ENTRAR AGORA' ? roundDownQuarter(Math.min(scoreUnits(scoreValue), maxEntryUnits, remainingDailyUnits)) : 0;
    return { ...item, movement, score: scoreValue, ev: item.probability * item.odds - 1, grade: grade(scoreValue), decision: itemDecision, recommendedUnits: units, recommendedStake: unitsToStake(units, unitValue) };
  }).sort((a, b) => b.score - a.score), [movements, maxEntryUnits, remainingDailyUnits, unitValue]);

  const answer = useMemo(() => {
    const q = normalize(submitted); let filtered = [...ranked];
    const evMatch = q.match(/ev\s*(?:maior|acima|superior)\s*(?:que|de)?\s*(\d+(?:[.,]\d+)?)/);
    const scoreMatch = q.match(/(?:score|nota)\s*(?:maior|acima|superior)\s*(?:que|de)?\s*(\d+)/);
    const unitsMatch = q.match(/(?:unidade|unidades|u)\s*(?:maior|acima|superior)\s*(?:que|de)?\s*(\d+(?:[.,]\d+)?)/);
    const topMatch = q.match(/(?:top|melhores|primeiras?)\s*(\d+)/);
    if (q.includes('entrar agora')) filtered = filtered.filter((item) => item.decision === 'ENTRAR AGORA');
    if (q.includes('serie a') || q.includes('brasileirao')) filtered = filtered.filter((item) => normalize(item.league).includes('brasileirao'));
    if (q.includes('queda')) filtered = filtered.filter((item) => item.movement?.direction === 'QUEDA');
    if (q.includes('s+')) filtered = filtered.filter((item) => item.grade === 'S+');
    if (q.includes('com stake') || q.includes('com unidade')) filtered = filtered.filter((item) => item.recommendedUnits > 0);
    if (evMatch) filtered = filtered.filter((item) => item.ev * 100 >= Number(evMatch[1].replace(',', '.')));
    if (scoreMatch) filtered = filtered.filter((item) => item.score >= Number(scoreMatch[1]));
    if (unitsMatch) filtered = filtered.filter((item) => item.recommendedUnits >= Number(unitsMatch[1].replace(',', '.')));
    const limit = topMatch ? Math.max(1, Math.min(10, Number(topMatch[1]))) : 5;
    return filtered.slice(0, limit);
  }, [ranked, submitted]);

  function submit(event: FormEvent) { event.preventDefault(); setSubmitted(question.trim()); }

  return <main className="mx-auto min-h-screen w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <header className="space-y-2"><div className="flex items-center gap-2 text-sm font-bold text-primary"><BrainCircuit className="h-4 w-4" /> IA Conversacional Operacional 2.0</div><h1 className="text-3xl font-black tracking-tight sm:text-4xl">Pergunte à IA Cantos</h1><p className="max-w-3xl text-muted-foreground">Consulte oportunidades por EV, score, liga, classificação, decisão, movimento de odds e stake disponível em unidades.</p></header>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Valor de 1 U" value={money.format(unitValue)} /><Metric label="Limite por entrada" value={formatUnits(maxEntryUnits)} /><Metric label="Uso diário" value={`${formatUnits(usedTodayUnits)} / ${formatUnits(maxDailyUnits)}`} /><Metric label="Saldo diário" value={formatUnits(remainingDailyUnits)} detail={money.format(unitsToStake(remainingDailyUnits, unitValue))} /></section>

    <form onSubmit={submit} className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-3 sm:flex-row"><div className="flex min-h-12 flex-1 items-center gap-3 rounded-2xl border bg-background px-4"><MessageSquareText className="h-5 w-5 text-primary" /><input value={question} onChange={(e) => setQuestion(e.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Ex.: Mostre entradas com stake acima de 0,5 unidade" /></div><button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-black text-primary-foreground"><Search className="h-4 w-4" /> Consultar</button><button type="button" onClick={() => { loadRiskSettings(); void loadMovements(); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 font-bold"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button></div><div className="mt-3 flex flex-wrap gap-2 text-xs">{['Quais são as 3 melhores entradas agora?', 'Mostre entradas com stake acima de 0,5 unidade', 'Quais oportunidades têm queda de odd?', 'Mostre score acima de 70'].map((example) => <button key={example} type="button" onClick={() => { setQuestion(example); setSubmitted(example); }} className="rounded-full border px-3 py-1.5 hover:bg-muted">{example}</button>)}</div></form>

    <section className="rounded-3xl border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><div><h2 className="text-xl font-black">Resposta operacional</h2><p className="text-sm text-muted-foreground">Consulta: “{submitted}”</p></div></div>{answer.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">Nenhuma oportunidade atende aos filtros identificados.</div> : <div className="space-y-3">{answer.map((item, index) => <article key={item.match} className="rounded-2xl border p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="text-xs font-black uppercase text-primary">#{index + 1} · {item.decision}</div><h3 className="mt-1 text-lg font-black">{item.match}</h3><p className="text-sm text-muted-foreground">{item.league} · {item.market} {item.line}</p>{item.recommendedUnits > 0 && <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-black text-primary"><WalletCards className="h-4 w-4" />{formatUnits(item.recommendedUnits)} · {money.format(item.recommendedStake)}</div>}</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-6"><Mini label="Score" value={item.score.toFixed(0)} /><Mini label="Nota" value={item.grade} /><Mini label="EV" value={`${item.ev >= 0 ? '+' : ''}${(item.ev * 100).toFixed(1)}%`} /><Mini label="Odd" value={item.odds.toFixed(2)} /><Mini label="Stake" value={item.recommendedUnits > 0 ? formatUnits(item.recommendedUnits) : 'Sem entrada'} /><Mini label="Mercado" value={item.movement ? `${item.movement.direction} ${item.movement.relativeChangePct.toFixed(1)}%` : 'Sem histórico'} /></div></div></article>)}</div>}</section>
  </main>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="rounded-2xl border bg-card p-4"><div className="text-xs font-bold uppercase text-muted-foreground">{label}</div><div className="mt-1 text-xl font-black">{value}</div>{detail && <div className="text-xs text-muted-foreground">{detail}</div>}</div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted px-3 py-2"><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div><div className="truncate text-sm font-black">{value}</div></div>; }
