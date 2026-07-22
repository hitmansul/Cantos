'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BrainCircuit, CheckCircle2, Gauge, Loader2, Search, ShieldAlert, Sparkles, Target, TrendingUp, Wallet } from 'lucide-react';

type Sample = { cornersFor: number; cornersAgainst: number; venue?: 'home' | 'away' | 'neutral'; weight?: number };
type HistoryResponse = { ok: boolean; error?: string; homeSamples?: Sample[]; awaySamples?: Sample[]; sampleCount?: number };
type OddsMarket = { category: string; marketName: string; selectionLabel: string; lineValue: number | null; offers: Array<{ bookmaker: string; odd: number }> };
type OddsResponse = { configured: boolean; found: boolean; fixture?: { homeTeam: string; awayTeam: string; leagueName: string }; markets: OddsMarket[] };
type Factor = { type: 'positive' | 'neutral' | 'risk'; title: string; description: string; impact: number };
type Offer = { bookmaker: string; line: number; side: 'over' | 'under'; odd: number; probability: number; fairOdd: number | null; expectedValue: number; edge: number; isValueBet: boolean; rating: 'avoid' | 'watch' | 'value' | 'strong-value'; explanation: string; kellyFraction: number; recommendedStakePercent: number; recommendedStake: number | null; riskLevel: 'low' | 'medium' | 'high' };
type OpportunityScore = { total: number; label: string; recommendation: string };
type Projection = { expectedHomeCorners: number; expectedAwayCorners: number; expectedTotalCorners: number; confidence: 'low' | 'medium' | 'high'; confidenceScore: number; sampleSize: number; volatility: number; projectedRange: { min: number; max: number }; summary: string; decision: 'bet' | 'monitor' | 'no-bet'; decisionReason: string; factors: Factor[]; offers: Offer[]; opportunityScore?: OpportunityScore };
type ApiResponse = { ok: boolean; projection?: Projection; error?: string; disclaimer?: string };

const fmt = (value: number | null | undefined, digits = 1) => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const inferSide = (text: string): 'over' | 'under' | null => { const value = text.toLowerCase(); if (value.includes('over') || value.includes('mais de')) return 'over'; if (value.includes('under') || value.includes('menos de')) return 'under'; return null; };

function grade(score: number) {
  if (score >= 90) return 'S+';
  if (score >= 82) return 'S';
  if (score >= 72) return 'A';
  if (score >= 62) return 'B';
  if (score >= 52) return 'C';
  return 'D';
}

function signal(score: number, decision: Projection['decision']) {
  if (decision === 'no-bet' || score < 52) return { label: 'Não apostar', tone: 'border-red-500/40 bg-red-500/10 text-red-500' };
  if (score >= 90) return { label: 'Excelente', tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500' };
  if (score >= 78) return { label: 'Muito boa', tone: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500' };
  if (score >= 65) return { label: 'Boa', tone: 'border-amber-500/40 bg-amber-500/10 text-amber-500' };
  return { label: 'Arriscada', tone: 'border-orange-500/40 bg-orange-500/10 text-orange-500' };
}

export default function CornerGPTPage() {
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [date, setDate] = useState('');
  const [competition, setCompetition] = useState('');
  const [bankroll, setBankroll] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projection, setProjection] = useState<Projection | null>(null);
  const [fixture, setFixture] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setHome(params.get('home') ?? '');
    setAway(params.get('away') ?? '');
    setDate(params.get('date') ?? '');
    setCompetition(params.get('competition') ?? '');
  }, []);

  async function analyze(event: FormEvent) {
    event.preventDefault();
    setError(''); setProjection(null);
    if (!home.trim() || !away.trim()) return setError('Informe as duas equipes.');
    setLoading(true);
    try {
      const historyResponse = await fetch(`/api/ai-corners/history?${new URLSearchParams({ home: home.trim(), away: away.trim(), limit: '8' })}`, { cache: 'no-store' });
      const history = await historyResponse.json() as HistoryResponse;
      if (!historyResponse.ok || !history.ok || !history.homeSamples || !history.awaySamples) throw new Error(history.error || 'Histórico insuficiente para analisar a partida.');

      const oddsQuery = new URLSearchParams({ home: home.trim(), away: away.trim() });
      if (date) oddsQuery.set('date', date);
      if (competition.trim()) oddsQuery.set('competition', competition.trim());
      const oddsResponse = await fetch(`/api/odds/match?${oddsQuery}`, { cache: 'no-store' });
      const odds = await oddsResponse.json() as OddsResponse;
      if (!oddsResponse.ok || !odds.configured || !odds.found || !odds.fixture) throw new Error('A partida ou as odds reais não foram localizadas.');

      const marketOffers = odds.markets
        .filter((market) => market.category === 'corners' && market.lineValue !== null)
        .flatMap((market) => {
          const side = inferSide(`${market.marketName} ${market.selectionLabel}`);
          return side && market.lineValue !== null ? market.offers.map((offer) => ({ bookmaker: offer.bookmaker, line: market.lineValue as number, side, odd: offer.odd })) : [];
        });
      if (!marketOffers.length) throw new Error('Nenhuma linha real de escanteios foi encontrada para esta partida.');

      const response = await fetch('/api/ai-corners/projection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeTeam: home.trim(), awayTeam: away.trim(), homeSamples: history.homeSamples, awaySamples: history.awaySamples, recentFormWeight: 0.65, marketOffers, bankroll: Number(bankroll) || 1000, riskProfile: 'conservative' }),
      });
      const payload = await response.json() as ApiResponse;
      if (!response.ok || !payload.ok || !payload.projection) throw new Error(payload.error || 'Não foi possível concluir a análise.');
      payload.projection.offers.sort((a, b) => b.expectedValue - a.expectedValue || b.edge - a.edge);
      setFixture(`${odds.fixture.homeTeam} x ${odds.fixture.awayTeam} — ${odds.fixture.leagueName}`);
      setProjection(payload.projection);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha inesperada na análise.');
    } finally { setLoading(false); }
  }

  const best = projection?.offers[0];
  const score = projection?.opportunityScore?.total ?? Math.round(((projection?.confidenceScore ?? 0) * 55) + Math.max(0, Math.min(45, (best?.expectedValue ?? 0) * 250)));
  const semaphore = projection ? signal(score, projection.decision) : null;
  const positive = useMemo(() => projection?.factors.filter((factor) => factor.type === 'positive') ?? [], [projection]);
  const risks = useMemo(() => projection?.factors.filter((factor) => factor.type === 'risk') ?? [], [projection]);
  const implied = best ? 1 / best.odd : null;

  return <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
    <header className="mb-6">
      <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-black text-primary"><BrainCircuit className="h-4 w-4" /> CornerGPT · escanteios em primeiro lugar</div>
      <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">O analista inteligente de escanteios</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">Transforma histórico, projeção, odds, EV e Kelly em uma recomendação clara. A arquitetura já nasce preparada para futebol em geral, mas escanteios permanecem como o produto principal.</p>
    </header>

    <form onSubmit={analyze} className="grid gap-3 rounded-3xl border bg-card p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
      <input value={home} onChange={(event) => setHome(event.target.value)} placeholder="Mandante" className="min-h-11 rounded-xl border bg-background px-4 lg:col-span-2" />
      <input value={away} onChange={(event) => setAway(event.target.value)} placeholder="Visitante" className="min-h-11 rounded-xl border bg-background px-4 lg:col-span-2" />
      <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-11 rounded-xl border bg-background px-4" />
      <input value={competition} onChange={(event) => setCompetition(event.target.value)} placeholder="Competição" className="min-h-11 rounded-xl border bg-background px-4" />
      <label className="flex items-center gap-3 rounded-xl border bg-background px-4 lg:col-span-2"><Wallet className="h-4 w-4 text-primary" /><span className="text-sm font-bold">Banca</span><input type="number" min="1" value={bankroll} onChange={(event) => setBankroll(event.target.value)} className="min-h-11 min-w-0 flex-1 bg-transparent outline-none" /></label>
      <button disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-black text-primary-foreground disabled:opacity-50 lg:col-span-2 lg:col-start-5">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{loading ? 'Analisando…' : 'Consultar CornerGPT'}</button>
    </form>

    {error && <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-500">{error}</div>}

    {projection && best && semaphore && <section className="mt-6 space-y-5">
      <article className="rounded-3xl border bg-card p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-sm font-bold text-muted-foreground">{fixture}</p><h2 className="mt-1 text-3xl font-black">Relatório executivo</h2><p className="mt-2 max-w-3xl text-muted-foreground">{projection.summary}</p></div>
          <div className={`rounded-2xl border px-6 py-4 text-center ${semaphore.tone}`}><p className="text-xs font-black uppercase">Semáforo</p><p className="mt-1 text-2xl font-black">{semaphore.label}</p></div>
        </div>
      </article>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric icon={Gauge} label="Score IA" value={`${score}/100`} detail={`Classe ${grade(score)}`} />
        <Metric icon={ShieldAlert} label="Confiança" value={`${fmt(projection.confidenceScore * 100, 0)}%`} detail={`${projection.sampleSize} registros`} />
        <Metric icon={Target} label="Projeção total" value={fmt(projection.expectedTotalCorners)} detail={`${fmt(projection.projectedRange.min)}–${fmt(projection.projectedRange.max)}`} />
        <Metric icon={TrendingUp} label="EV da melhor linha" value={`${best.expectedValue > 0 ? '+' : ''}${fmt(best.expectedValue * 100)}%`} detail={`${best.bookmaker} · ${fmt(best.odd, 2)}`} />
        <Metric icon={Wallet} label="Entrada sugerida" value={best.recommendedStakePercent > 0 ? `${fmt(best.recommendedStakePercent, 2)}%` : 'Sem entrada'} detail={best.recommendedStake ? `R$ ${fmt(best.recommendedStake, 2)}` : 'Kelly controlado'} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <article className="rounded-3xl border bg-card p-5">
          <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><h3 className="text-xl font-black">Melhor mercado encontrado</h3></div>
          <div className="mt-4 rounded-2xl border bg-primary/5 p-5"><p className="text-sm font-bold text-muted-foreground">Recomendação</p><p className="mt-1 text-3xl font-black">{best.side === 'over' ? 'Over' : 'Under'} {best.line}</p><p className="mt-1 font-bold text-primary">{best.bookmaker} · odd {fmt(best.odd, 2)}</p></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><Mini label="Probabilidade IA" value={`${fmt(best.probability * 100)}%`} /><Mini label="Probabilidade implícita" value={`${fmt((implied ?? 0) * 100)}%`} /><Mini label="Odd justa" value={fmt(best.fairOdd, 2)} /></div>
          <p className="mt-4 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">{best.explanation}</p>
        </article>

        <article className="rounded-3xl border bg-card p-5">
          <h3 className="text-xl font-black">Decisão objetiva</h3>
          <p className="mt-3 text-lg font-bold">{projection.decision === 'bet' ? 'Entrada recomendada' : projection.decision === 'monitor' ? 'Monitorar antes de entrar' : 'Não entrar neste momento'}</p>
          <p className="mt-2 text-sm text-muted-foreground">{projection.decisionReason}</p>
          <div className="mt-4 rounded-2xl border p-4"><p className="text-xs font-black uppercase text-muted-foreground">Resposta do CornerGPT</p><p className="mt-2 font-bold">{projection.decision === 'bet' ? `A linha ${best.side === 'over' ? 'Over' : 'Under'} ${best.line} apresenta valor estatístico, desde que a odd permaneça próxima de ${fmt(best.odd, 2)}.` : projection.decision === 'monitor' ? 'Há sinais favoráveis, mas o preço ou a confiança ainda não justificam uma entrada imediata.' : 'Os dados atuais não entregam vantagem suficiente para uma aposta responsável.'}</p></div>
        </article>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-3xl border bg-card p-5"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" /><h3 className="text-xl font-black">Por que pode valer a entrada</h3></div><div className="mt-4 space-y-3">{positive.length ? positive.map((factor) => <Reason key={factor.title} title={factor.title} text={factor.description} positive />) : <p className="text-sm text-muted-foreground">Nenhum fator positivo forte foi identificado.</p>}</div></article>
        <article className="rounded-3xl border bg-card p-5"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /><h3 className="text-xl font-black">Riscos e cautelas</h3></div><div className="mt-4 space-y-3">{risks.length ? risks.map((factor) => <Reason key={factor.title} title={factor.title} text={factor.description} />) : <p className="text-sm text-muted-foreground">O motor não encontrou risco estatístico dominante, mas escalações e mudanças de odd ainda devem ser conferidas.</p>}</div></article>
      </section>

      <p className="text-xs text-muted-foreground">A análise é estatística e não garante resultado. Escanteios permanecem como o núcleo prioritário da plataforma; os futuros módulos de futebol utilizarão a mesma infraestrutura sem substituir este foco.</p>
    </section>}
  </main>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Gauge; label: string; value: string; detail: string }) { return <article className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><p className="mt-2 text-2xl font-black">{value}</p><p className="text-xs text-muted-foreground">{detail}</p></article>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-black">{value}</p></div>; }
function Reason({ title, text, positive = false }: { title: string; text: string; positive?: boolean }) { return <div className="flex gap-3 rounded-2xl border p-4">{positive ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />}<div><p className="font-black">{title}</p><p className="mt-1 text-sm text-muted-foreground">{text}</p></div></div>; }
