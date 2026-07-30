'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BrainCircuit, Loader2, MessageSquareText, RefreshCw, Search, Sparkles } from 'lucide-react';
import { PERFORMANCE_OPERATIONS_KEY, type PerformanceOperation } from '@/lib/performanceOperations';
import { formatUnits, readBettingUnitValue, readMaxDailyUnits, readMaxEntryUnits, readMaxMonthlyUnits, stakeToUnits } from '@/lib/unitSettings';

type LiveStat = { key?: string; label?: string; home?: string; away?: string };
type LiveMatch = { id: number; minute: number | string; statusText?: string; competition?: string; homeTeam: { name: string; score: number }; awayTeam: { name: string; score: number }; corners?: { home: number; away: number; total: number }; liveStats?: LiveStat[] };
type LiveResponse = { matches?: LiveMatch[] };
type Movement = { match: string; direction: 'QUEDA' | 'ALTA'; severityScore: number; relativeChangePct: number; bookmaker: string };
type MovementResponse = { movements?: Movement[] };
type Decision = 'ANALISAR AGORA' | 'AGUARDAR' | 'NÃO ENTRAR' | 'DADOS INSUFICIENTES';
type ScoreFactor = { label: string; impact: number; detail: string };
type Assessment = {
  match: LiveMatch;
  score: number;
  grade: string;
  decision: Decision;
  confidence: number;
  dataReliability: 'Alta' | 'Média' | 'Baixa';
  corners: number | null;
  shots: string | null;
  dangerousAttacks: string | null;
  movement: Movement | null;
  suggestedMarket: string | null;
  triggerText: string;
  factors: ScoreFactor[];
  reasons: string[];
  risks: string[];
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(fc|cf|sc|ec|ac|club|clube)\b/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const minuteNumber = (value: number | string) => Number(String(value).match(/\d{1,3}/)?.[0] ?? 0);
const safeRemaining = (limit: number, used: number) => Number.isFinite(limit) ? Math.max(0, limit - used) : Number.POSITIVE_INFINITY;
const displayUsage = (used: number, limit: number) => Number.isFinite(limit) ? `${formatUnits(used)} / ${formatUnits(limit)}` : `${formatUnits(used)} / Sem limite`;

function grade(score: number) { if (score >= 90) return 'S+'; if (score >= 82) return 'S'; if (score >= 72) return 'A'; if (score >= 60) return 'B'; if (score >= 45) return 'C'; return 'D'; }
function statRow(match: LiveMatch, terms: string[]) { return match.liveStats?.find((row) => { const text = normalize(`${row.key ?? ''} ${row.label ?? ''}`); return terms.some((term) => text.includes(term)); }) ?? null; }
function statPair(match: LiveMatch, terms: string[]) { const row = statRow(match, terms); if (!row) return null; const home = String(row.home ?? '').trim(); const away = String(row.away ?? '').trim(); if (!home || !away) return null; return `${home}–${away}`; }
function statTotal(match: LiveMatch, terms: string[]) { const row = statRow(match, terms); if (!row) return null; const homeRaw = String(row.home ?? '').trim(); const awayRaw = String(row.away ?? '').trim(); if (!homeRaw || !awayRaw) return null; const home = Number(homeRaw.replace(',', '.')); const away = Number(awayRaw.replace(',', '.')); return Number.isFinite(home) && Number.isFinite(away) ? home + away : null; }
function matchLabel(match: LiveMatch) { return `${match.homeTeam.name} x ${match.awayTeam.name}`; }
function findMovement(match: LiveMatch, movements: Movement[]) { const target = normalize(matchLabel(match)); return movements.find((item) => normalize(item.match) === target) ?? null; }
function signed(value: number) { return `${value >= 0 ? '+' : ''}${value.toFixed(0)}`; }

function buildAssessment(match: LiveMatch, movements: Movement[]): Assessment {
  const minute = minuteNumber(match.minute);
  const corners = match.corners?.total ?? statTotal(match, ['corner', 'escante']);
  const shotsTotal = statTotal(match, ['shots', 'chutes']);
  const dangerousTotal = statTotal(match, ['dangerous attack', 'ataques perigosos']);
  const shots = statPair(match, ['shots', 'chutes']);
  const dangerousAttacks = statPair(match, ['dangerous attack', 'ataques perigosos']);
  const movement = findMovement(match, movements);
  const factors: ScoreFactor[] = [];
  let score = 35;

  if (corners !== null) {
    const impact = Math.min(28, corners * 4);
    score += impact;
    factors.push({ label: 'Volume de escanteios', impact, detail: `${corners} escanteios registrados.` });
  }
  if (shotsTotal !== null) {
    const impact = Math.min(16, shotsTotal * 0.8);
    score += impact;
    factors.push({ label: 'Finalizações', impact, detail: `${shotsTotal} chutes somados.` });
  }
  if (dangerousTotal !== null) {
    const impact = Math.min(12, dangerousTotal * 0.08);
    score += impact;
    factors.push({ label: 'Ataques perigosos', impact, detail: `${dangerousTotal} ataques perigosos.` });
  }
  if (minute >= 55 && minute <= 82) {
    score += 6;
    factors.push({ label: 'Janela operacional', impact: 6, detail: `Minuto ${minute}, dentro da janela de maior leitura.` });
  }
  if (minute >= 88) {
    score -= 10;
    factors.push({ label: 'Tempo restante', impact: -10, detail: 'Pouco tempo regulamentar restante.' });
  }
  if (movement?.direction === 'QUEDA') {
    const impact = Math.min(8, movement.severityScore / 15);
    score += impact;
    factors.push({ label: 'Movimento de mercado', impact, detail: `Queda de ${Math.abs(movement.relativeChangePct).toFixed(1)}%.` });
  }
  if (movement?.direction === 'ALTA') {
    const impact = -Math.min(6, movement.severityScore / 18);
    score += impact;
    factors.push({ label: 'Movimento de mercado', impact, detail: `Alta de ${Math.abs(movement.relativeChangePct).toFixed(1)}%.` });
  }

  score = Math.round(clamp(score));
  const dataPoints = [corners !== null, shotsTotal !== null, dangerousTotal !== null, Boolean(movement)].filter(Boolean).length;
  const dataReliability: Assessment['dataReliability'] = dataPoints >= 3 ? 'Alta' : dataPoints >= 2 ? 'Média' : 'Baixa';
  const enoughData = corners !== null || shotsTotal !== null || dangerousTotal !== null;
  let decision: Decision = 'DADOS INSUFICIENTES';
  if (enoughData && score >= 78 && minute < 86) decision = 'ANALISAR AGORA';
  else if (enoughData && score >= 58) decision = 'AGUARDAR';
  else if (enoughData) decision = 'NÃO ENTRAR';

  const confidencePenalty = dataReliability === 'Baixa' ? 18 : dataReliability === 'Média' ? 8 : 0;
  const marketPenalty = movement ? 0 : 8;
  const confidence = Math.round(clamp(score - confidencePenalty - marketPenalty, 15, 95));
  const suggestedMarket = corners === null ? null : `Mais de ${(corners + (minute >= 72 ? 1.5 : 2.5)).toFixed(1)} escanteios`;
  const triggerText = decision === 'ANALISAR AGORA'
    ? 'Confirmar linha e odd atuais. A IA só libera entrada após validar preço e EV.'
    : decision === 'AGUARDAR'
      ? `Aguardar confirmação de pressão ofensiva ou queda de odd. Reavaliar após novo escanteio${dangerousTotal === null ? ' ou quando a fonte publicar ataques perigosos' : ''}.`
      : decision === 'NÃO ENTRAR'
        ? 'Não entrar no cenário atual. Reavaliar apenas se o ritmo e o preço de mercado mudarem de forma relevante.'
        : 'Aguardar dados adicionais antes de qualquer decisão.';

  const reasons = [`Partida localizada ao vivo aos ${minute}', placar ${match.homeTeam.score}–${match.awayTeam.score}.`];
  const risks: string[] = [];
  if (corners !== null) reasons.push(`${corners} escanteio${corners === 1 ? '' : 's'} registrados até o momento.`);
  if (shotsTotal !== null) reasons.push(`${shotsTotal} chutes somados na partida.`);
  if (dangerousTotal !== null) reasons.push(`${dangerousTotal} ataques perigosos somados pela fonte.`);
  if (movement) reasons.push(`${movement.bookmaker}: ${movement.direction.toLowerCase()} de ${Math.abs(movement.relativeChangePct).toFixed(1)}% na odd monitorada.`);
  else risks.push('Nenhuma movimentação de odd correspondente foi localizada.');
  if (!enoughData) risks.push('A fonte não forneceu estatísticas suficientes para uma leitura operacional segura.');
  risks.push('A linha sugerida é apenas referência de monitoramento. Aprovação definitiva exige linha e odd atuais do mercado.');

  return { match, score, grade: grade(score), decision, confidence, dataReliability, corners, shots, dangerousAttacks, movement, suggestedMarket, triggerText, factors, reasons, risks };
}

export default function AiAssistantPage() {
  const [question, setQuestion] = useState('Quais jogos ao vivo merecem análise agora?');
  const [submitted, setSubmitted] = useState('Quais jogos ao vivo merecem análise agora?');
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastAnalysis, setLastAnalysis] = useState('');
  const [unitValue, setUnitValue] = useState(100);
  const [maxEntryUnits, setMaxEntryUnits] = useState(1);
  const [maxDailyUnits, setMaxDailyUnits] = useState(Number.POSITIVE_INFINITY);
  const [maxMonthlyUnits, setMaxMonthlyUnits] = useState(Number.POSITIVE_INFINITY);
  const [usedTodayUnits, setUsedTodayUnits] = useState(0);
  const [usedMonthUnits, setUsedMonthUnits] = useState(0);

  function loadRiskSettings() {
    const nextUnitValue = readBettingUnitValue();
    setUnitValue(nextUnitValue); setMaxEntryUnits(readMaxEntryUnits()); setMaxDailyUnits(readMaxDailyUnits()); setMaxMonthlyUnits(readMaxMonthlyUnits());
    try {
      const parsed = JSON.parse(window.localStorage.getItem(PERFORMANCE_OPERATIONS_KEY) || '[]');
      const operations: PerformanceOperation[] = Array.isArray(parsed) ? parsed : [];
      const today = new Date().toISOString().slice(0, 10); const month = today.slice(0, 7);
      const todayStake = operations.filter((item) => String(item.date).slice(0, 10) === today).reduce((sum, item) => sum + Number(item.stake || 0), 0);
      const monthStake = operations.filter((item) => String(item.date).slice(0, 7) === month).reduce((sum, item) => sum + Number(item.stake || 0), 0);
      setUsedTodayUnits(stakeToUnits(todayStake, nextUnitValue)); setUsedMonthUnits(stakeToUnits(monthStake, nextUnitValue));
    } catch { setUsedTodayUnits(0); setUsedMonthUnits(0); }
  }

  async function refreshSources() {
    setLoading(true);
    try {
      const [liveResponse, movementResponse] = await Promise.all([fetch('/api/live', { cache: 'no-store' }), fetch('/api/odds/movements?minutes=30&limit=150', { cache: 'no-store' })]);
      const livePayload = await liveResponse.json() as LiveResponse;
      const movementPayload = await movementResponse.json() as MovementResponse;
      setLiveMatches(Array.isArray(livePayload.matches) ? livePayload.matches : []);
      setMovements(Array.isArray(movementPayload.movements) ? movementPayload.movements : []);
    } catch { setLiveMatches([]); setMovements([]); }
    finally { setLastAnalysis(new Date().toISOString()); setLoading(false); }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const home = params.get('home'); const away = params.get('away'); const id = Number(params.get('liveMatchId'));
    if (Number.isFinite(id) && id > 0) setSelectedMatchId(id);
    if (home || away) { const selected = `Vale entrar agora em ${home || away}?`; setQuestion(selected); setSubmitted(selected); }
    loadRiskSettings(); void refreshSources();
  }, []);

  const remainingDailyUnits = safeRemaining(maxDailyUnits, usedTodayUnits);
  const remainingMonthlyUnits = safeRemaining(maxMonthlyUnits, usedMonthUnits);
  const assessments = useMemo(() => liveMatches.map((match) => buildAssessment(match, movements)).sort((a, b) => b.score - a.score), [liveMatches, movements]);

  const answer = useMemo(() => {
    if (selectedMatchId) { const selected = assessments.find((item) => item.match.id === selectedMatchId); if (selected) return [selected]; }
    const q = normalize(submitted);
    const named = assessments.find((item) => { const home = normalize(item.match.homeTeam.name); const away = normalize(item.match.awayTeam.name); return (home.length >= 3 && q.includes(home)) || (away.length >= 3 && q.includes(away)); });
    if (named) return [named];
    const topMatch = q.match(/(?:top|melhores|primeiros|primeiras)\s*(\d+)/);
    const limit = topMatch ? Math.max(1, Math.min(10, Number(topMatch[1]))) : 5;
    if (q.includes('analisar agora') || q.includes('merecem analise')) return assessments.filter((item) => item.decision === 'ANALISAR AGORA').slice(0, limit);
    return assessments.slice(0, limit);
  }, [assessments, selectedMatchId, submitted]);

  const requestedTeamNotFound = useMemo(() => {
    if (selectedMatchId) return !answer.length;
    const q = normalize(submitted); const asksEvaluation = /(?:vale|devo|posso|compensa|recomenda|entraria)/.test(q);
    if (!asksEvaluation) return false;
    return !answer.some((item) => q.includes(normalize(item.match.homeTeam.name)) || q.includes(normalize(item.match.awayTeam.name)));
  }, [answer, selectedMatchId, submitted]);

  const summary = useMemo(() => {
    if (requestedTeamNotFound) return 'A equipe informada não foi localizada entre os jogos ao vivo. Não vou substituir por outra partida nem usar exemplos antigos.';
    if (!answer.length) return 'Nenhum jogo ao vivo atende à consulta neste momento.';
    const best = answer[0]; const label = matchLabel(best.match);
    if (best.decision === 'ANALISAR AGORA') return `${label} merece análise imediata, mas ainda não é uma entrada liberada. O Score é ${best.score}, a confiança é ${best.confidence}% e falta validar a linha e a odd atuais.`;
    if (best.decision === 'DADOS INSUFICIENTES') return `${label} foi localizado ao vivo, porém a fonte não entregou dados suficientes para uma recomendação responsável.`;
    if (best.decision === 'AGUARDAR') return `Eu aguardaria em ${label}. O Score atual é ${best.score}, com confiança de ${best.confidence}%. ${best.triggerText}`;
    return `Eu não entraria agora em ${label}. O Score atual é ${best.score}, com confiança de ${best.confidence}%. ${best.triggerText}`;
  }, [answer, requestedTeamNotFound]);

  async function submit(event: FormEvent) { event.preventDefault(); const nextQuestion = question.trim(); if (!nextQuestion) return; setSelectedMatchId(null); loadRiskSettings(); await refreshSources(); setSubmitted(nextQuestion); }

  return <main className="mx-auto min-h-screen w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <header className="space-y-2"><div className="flex items-center gap-2 text-sm font-bold text-primary"><BrainCircuit className="h-4 w-4" /> IA Conversacional Integrada 2.5</div><h1 className="text-3xl font-black tracking-tight sm:text-4xl">Pergunte à IA Cantos</h1><p className="max-w-3xl text-muted-foreground">Análise ao vivo explicável, com fatores do Score, confiança, linha de referência e gatilhos para reavaliação.</p></header>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Metric label="Valor de 1 U" value={money.format(unitValue)} /><Metric label="Limite por entrada" value={formatUnits(maxEntryUnits)} /><Metric label="Uso diário" value={displayUsage(usedTodayUnits, maxDailyUnits)} /><Metric label="Saldo diário" value={formatUnits(remainingDailyUnits)} /><Metric label="Uso mensal" value={displayUsage(usedMonthUnits, maxMonthlyUnits)} /><Metric label="Jogos ao vivo" value={String(liveMatches.length)} detail={lastAnalysis ? `Atualizado ${new Date(lastAnalysis).toLocaleTimeString('pt-BR')}` : undefined} /></section>
    <form onSubmit={submit} className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-3 sm:flex-row"><div className="flex min-h-12 flex-1 items-center gap-3 rounded-2xl border bg-background px-4"><MessageSquareText className="h-5 w-5 text-primary" /><input value={question} onChange={(event) => setQuestion(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Ex.: Vale entrar agora no Calcutta Police?" /></div><button disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-black text-primary-foreground disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{loading ? 'Analisando…' : 'Consultar'}</button><button type="button" onClick={() => { loadRiskSettings(); void refreshSources(); }} disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 font-bold disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button></div></form>
    <section className="rounded-3xl border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><div><h2 className="text-xl font-black">Resposta consultiva</h2><p className="text-sm text-muted-foreground">Consulta: “{submitted}”</p></div></div><div className="mb-4 rounded-2xl border bg-primary/5 p-4 font-semibold leading-6">{summary}</div>{answer.length === 0 || requestedTeamNotFound ? <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">Nenhuma partida correspondente foi encontrada nos jogos ao vivo.</div> : <div className="space-y-3">{answer.map((item, index) => <article key={item.match.id} className="rounded-2xl border p-4"><div className="text-xs font-black uppercase text-primary">#{index + 1} · {item.decision}</div><h3 className="mt-1 text-lg font-black">{matchLabel(item.match)}</h3><p className="text-sm text-muted-foreground">{item.match.competition || 'Competição não informada'} · {item.match.statusText || 'Ao vivo'} · {item.match.minute}' · {item.match.homeTeam.score}–{item.match.awayTeam.score}</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-6"><Mini label="Score ao vivo" value={String(item.score)} /><Mini label="Nota" value={item.grade} /><Mini label="Confiança" value={`${item.confidence}%`} /><Mini label="Confiabilidade" value={item.dataReliability} /><Mini label="Escanteios" value={item.corners === null ? 'Indisponível' : String(item.corners)} /><Mini label="Mercado" value={item.movement ? `${item.movement.direction} ${item.movement.relativeChangePct.toFixed(1)}%` : 'Sem movimento'} /></div><ConfidenceBar value={item.confidence} /><div className="mt-3 grid gap-3 lg:grid-cols-3"><Panel title="Leitura da IA"><p className="text-sm leading-6">{item.triggerText}</p></Panel><Panel title="Linha de referência"><p className="text-lg font-black">{item.suggestedMarket ?? 'Indisponível'}</p><p className="mt-1 text-xs text-muted-foreground">Referência para monitoramento; não representa cotação disponível.</p></Panel><Panel title="Stake"><p className="text-lg font-black">Aguardando odd</p><p className="mt-1 text-xs text-muted-foreground">Kelly, EV e unidades só serão liberados após validar preço real.</p></Panel></div><div className="mt-3 grid gap-3 lg:grid-cols-3"><ScoreBreakdown factors={item.factors} /><Explanation title="Dados usados" items={item.reasons} /><Explanation title="Limitações e cautela" items={item.risks} /></div></article>)}</div>}</section>
  </main>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="rounded-2xl border bg-card p-4"><div className="text-xs font-bold uppercase text-muted-foreground">{label}</div><div className="mt-1 text-xl font-black">{value}</div>{detail && <div className="text-xs text-muted-foreground">{detail}</div>}</div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted px-3 py-2"><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div><div className="text-sm font-black">{value}</div></div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-xl bg-muted/40 p-3"><div className="text-xs font-black uppercase text-muted-foreground">{title}</div><div className="mt-2">{children}</div></div>; }
function ConfidenceBar({ value }: { value: number }) { return <div className="mt-3 rounded-xl border p-3"><div className="flex items-center justify-between text-xs font-bold"><span>Força da leitura</span><span>{value}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${clamp(value)}%` }} /></div></div>; }
function ScoreBreakdown({ factors }: { factors: ScoreFactor[] }) { return <div className="rounded-xl bg-muted/40 p-3"><div className="text-xs font-black uppercase text-muted-foreground">Composição do Score</div>{factors.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Sem fatores suficientes.</p> : <div className="mt-2 space-y-2">{factors.map((factor) => <div key={`${factor.label}-${factor.detail}`} className="flex items-start justify-between gap-3 text-sm"><div><div className="font-semibold">{factor.label}</div><div className="text-xs text-muted-foreground">{factor.detail}</div></div><span className={`shrink-0 font-black ${factor.impact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{signed(factor.impact)}</span></div>)}</div>}</div>; }
function Explanation({ title, items }: { title: string; items: string[] }) { return <div className="rounded-xl bg-muted/40 p-3"><div className="text-xs font-black uppercase text-muted-foreground">{title}</div><ul className="mt-2 space-y-1 text-sm">{items.map((item) => <li key={item}>• {item}</li>)}</ul></div>; }
