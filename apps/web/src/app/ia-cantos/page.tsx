'use client';

import { FormEvent, useState } from 'react';
import { AlertTriangle, BrainCircuit, Calculator, CheckCircle2, Database, Search, Sparkles, TrendingUp } from 'lucide-react';

type Sample = { cornersFor: number; cornersAgainst: number; venue: 'home' | 'away'; weight?: number };
type HistoryResponse = { ok: boolean; error?: string; homeSamples?: Sample[]; awaySamples?: Sample[]; sampleCount?: number };
type OddsMarket = { category: 'corners' | 'cards'; marketName: string; selectionLabel: string; lineValue: number | null; offers: Array<{ bookmaker: string; odd: number }> };
type OddsResponse = { configured: boolean; found: boolean; fixture?: { homeTeam: string; awayTeam: string; leagueName: string }; markets: OddsMarket[] };
type Factor = { type: 'positive' | 'neutral' | 'risk'; title: string; description: string; impact: number };
type Offer = { bookmaker: string; line: number; side: 'over' | 'under'; odd: number; probability: number; fairOdd: number | null; expectedValue: number; edge: number; isValueBet: boolean; rating: 'avoid' | 'watch' | 'value' | 'strong-value'; explanation: string };
type Projection = { expectedHomeCorners: number; expectedAwayCorners: number; expectedTotalCorners: number; confidence: 'low' | 'medium' | 'high'; confidenceScore: number; sampleSize: number; summary: string; factors: Factor[]; offers: Offer[] };
type ApiResponse = { ok: boolean; projection?: Projection; error?: string; disclaimer?: string };

const decimal = (value: number | null, digits = 2) => value === null || !Number.isFinite(value) ? '—' : value.toFixed(digits).replace('.', ',');
const parseSeries = (value: string) => value.split(',').map((item) => Number(item.trim().replace(',', '.'))).filter((item) => Number.isFinite(item) && item >= 0 && item <= 30);
const makeSamples = (forValues: number[], againstValues: number[], venue: 'home' | 'away') => Array.from({ length: Math.min(forValues.length, againstValues.length) }, (_, index) => ({ cornersFor: forValues[index], cornersAgainst: againstValues[index], venue, weight: index === 0 ? 1.35 : Math.max(0.75, 1.2 - index * 0.08) }));
const inferSide = (value: string): 'over' | 'under' | null => { const normalized = value.toLowerCase(); if (normalized.includes('over') || normalized.includes('mais de')) return 'over'; if (normalized.includes('under') || normalized.includes('menos de')) return 'under'; return null; };

export default function IACantosPage() {
  const [homeTeam, setHomeTeam] = useState(''); const [awayTeam, setAwayTeam] = useState(''); const [date, setDate] = useState(''); const [competition, setCompetition] = useState('');
  const [historySource, setHistorySource] = useState<'automatic' | 'manual'>('automatic'); const [marketSource, setMarketSource] = useState<'automatic' | 'manual'>('automatic');
  const [homeFor, setHomeFor] = useState(''); const [homeAgainst, setHomeAgainst] = useState(''); const [awayFor, setAwayFor] = useState(''); const [awayAgainst, setAwayAgainst] = useState('');
  const [bookmaker, setBookmaker] = useState('Bet365'); const [side, setSide] = useState<'over' | 'under'>('over'); const [line, setLine] = useState('9.5'); const [odd, setOdd] = useState('1.90');
  const [projection, setProjection] = useState<Projection | null>(null); const [fixtureLabel, setFixtureLabel] = useState(''); const [historyLabel, setHistoryLabel] = useState('');
  const [error, setError] = useState(''); const [disclaimer, setDisclaimer] = useState(''); const [loading, setLoading] = useState(false);

  async function loadHistory() {
    if (historySource === 'manual') {
      const homeSamples = makeSamples(parseSeries(homeFor), parseSeries(homeAgainst), 'home');
      const awaySamples = makeSamples(parseSeries(awayFor), parseSeries(awayAgainst), 'away');
      if (homeSamples.length < 3 || awaySamples.length < 3) throw new Error('Informe pelo menos três jogos de cada equipe.');
      setHistoryLabel(`Histórico manual: ${Math.min(homeSamples.length, awaySamples.length)} jogos por equipe`);
      return { homeSamples, awaySamples };
    }
    const response = await fetch(`/api/ai-corners/history?${new URLSearchParams({ home: homeTeam.trim(), away: awayTeam.trim(), limit: '5' })}`, { cache: 'no-store' });
    const payload = await response.json() as HistoryResponse;
    if (!response.ok || !payload.ok || !payload.homeSamples || !payload.awaySamples) throw new Error(payload.error || 'Não foi possível buscar o histórico.');
    setHistoryLabel(`Histórico automático: ${payload.sampleCount ?? 0} jogos por equipe`);
    return { homeSamples: payload.homeSamples, awaySamples: payload.awaySamples };
  }

  async function loadOffers() {
    if (marketSource === 'manual') return [{ bookmaker: bookmaker.trim() || 'Casa informada', line: Number(line.replace(',', '.')), side, odd: Number(odd.replace(',', '.')) }];
    const query = new URLSearchParams({ home: homeTeam.trim(), away: awayTeam.trim() }); if (date) query.set('date', date); if (competition.trim()) query.set('competition', competition.trim());
    const response = await fetch(`/api/odds/match?${query}`, { cache: 'no-store' }); const payload = await response.json() as OddsResponse;
    if (!response.ok || !payload.configured) throw new Error('A API de odds não está disponível.'); if (!payload.found || !payload.fixture) throw new Error('Partida não localizada.');
    setFixtureLabel(`${payload.fixture.homeTeam} x ${payload.fixture.awayTeam} — ${payload.fixture.leagueName}`);
    const offers = payload.markets.filter((market) => market.category === 'corners' && market.lineValue !== null).flatMap((market) => { const selectedSide = inferSide(`${market.marketName} ${market.selectionLabel}`); return selectedSide && market.lineValue !== null ? market.offers.map((offer) => ({ bookmaker: offer.bookmaker, line: market.lineValue as number, side: selectedSide, odd: offer.odd })) : []; });
    if (!offers.length) throw new Error('Nenhuma linha de escanteios válida foi encontrada.'); return offers;
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setProjection(null); setFixtureLabel(''); setHistoryLabel('');
    if (!homeTeam.trim() || !awayTeam.trim()) return setError('Informe os dois times.');
    setLoading(true);
    try {
      const { homeSamples, awaySamples } = await loadHistory(); const marketOffers = await loadOffers();
      const response = await fetch('/api/ai-corners/projection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ homeTeam: homeTeam.trim(), awayTeam: awayTeam.trim(), homeSamples, awaySamples, recentFormWeight: 0.65, marketOffers }) });
      const payload = await response.json() as ApiResponse; if (!response.ok || !payload.ok || !payload.projection) throw new Error(payload.error || 'Não foi possível calcular a projeção.');
      payload.projection.offers.sort((a, b) => b.expectedValue - a.expectedValue || b.edge - a.edge); setProjection(payload.projection); setDisclaimer(payload.disclaimer || '');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha inesperada.'); } finally { setLoading(false); }
  }

  return <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <header className="mb-7"><div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-bold text-primary"><BrainCircuit className="h-4 w-4" /> IA Cantos 2.0</div><h1 className="mt-3 text-3xl font-black sm:text-5xl">Análise explicável de escanteios</h1><p className="mt-3 max-w-3xl text-muted-foreground">Além da projeção, a IA mostra confiança, fatores favoráveis, riscos e o motivo de cada recomendação.</p></header>
    <form onSubmit={submit} className="space-y-5 rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} placeholder="Time mandante" className="min-h-11 rounded-xl border bg-background px-4" /><input value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} placeholder="Time visitante" className="min-h-11 rounded-xl border bg-background px-4" /><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="min-h-11 rounded-xl border bg-background px-4" /><input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="Competição (opcional)" className="min-h-11 rounded-xl border bg-background px-4" /></section>
      <section className="border-t pt-5"><div className="mb-4 flex gap-2"><button type="button" onClick={() => setHistorySource('automatic')} className={`rounded-xl border px-4 py-2 text-sm font-bold ${historySource === 'automatic' ? 'bg-primary text-primary-foreground' : ''}`}><Database className="mr-2 inline h-4 w-4" />Buscar histórico</button><button type="button" onClick={() => setHistorySource('manual')} className={`rounded-xl border px-4 py-2 text-sm font-bold ${historySource === 'manual' ? 'bg-primary text-primary-foreground' : ''}`}>Informar histórico</button></div>{historySource === 'manual' && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input value={homeFor} onChange={(e) => setHomeFor(e.target.value)} placeholder="Mandante a favor" className="min-h-11 rounded-xl border px-4" /><input value={homeAgainst} onChange={(e) => setHomeAgainst(e.target.value)} placeholder="Mandante contra" className="min-h-11 rounded-xl border px-4" /><input value={awayFor} onChange={(e) => setAwayFor(e.target.value)} placeholder="Visitante a favor" className="min-h-11 rounded-xl border px-4" /><input value={awayAgainst} onChange={(e) => setAwayAgainst(e.target.value)} placeholder="Visitante contra" className="min-h-11 rounded-xl border px-4" /></div>}</section>
      <section className="border-t pt-5"><div className="mb-4 flex gap-2"><button type="button" onClick={() => setMarketSource('automatic')} className={`rounded-xl border px-4 py-2 text-sm font-bold ${marketSource === 'automatic' ? 'bg-primary text-primary-foreground' : ''}`}>Buscar odds reais</button><button type="button" onClick={() => setMarketSource('manual')} className={`rounded-xl border px-4 py-2 text-sm font-bold ${marketSource === 'manual' ? 'bg-primary text-primary-foreground' : ''}`}>Informar odd</button></div>{marketSource === 'manual' && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input value={bookmaker} onChange={(e) => setBookmaker(e.target.value)} placeholder="Casa" className="min-h-11 rounded-xl border px-4" /><select value={side} onChange={(e) => setSide(e.target.value as 'over' | 'under')} className="min-h-11 rounded-xl border px-4"><option value="over">Over</option><option value="under">Under</option></select><input value={line} onChange={(e) => setLine(e.target.value)} className="min-h-11 rounded-xl border px-4" /><input value={odd} onChange={(e) => setOdd(e.target.value)} className="min-h-11 rounded-xl border px-4" /></div>}</section>
      <div className="flex justify-end border-t pt-5"><button disabled={loading} className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-6 font-bold text-primary-foreground disabled:opacity-50">{marketSource === 'automatic' ? <Search className="h-4 w-4" /> : <Calculator className="h-4 w-4" />}{loading ? 'Analisando…' : 'Analisar partida'}</button></div>
    </form>
    {error && <div className="mt-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">{error}</div>}
    {projection && <section className="mt-6 space-y-5">
      {(fixtureLabel || historyLabel) && <div className="rounded-2xl border bg-card p-4 text-center"><p className="font-bold">{fixtureLabel}</p><p className="text-sm text-muted-foreground">{historyLabel}</p></div>}
      <div className="grid gap-4 sm:grid-cols-4"><article className="rounded-2xl border bg-card p-5"><p className="text-xs font-bold uppercase text-muted-foreground">Mandante</p><p className="mt-2 text-3xl font-black">{decimal(projection.expectedHomeCorners)}</p></article><article className="rounded-2xl border bg-card p-5"><p className="text-xs font-bold uppercase text-muted-foreground">Visitante</p><p className="mt-2 text-3xl font-black">{decimal(projection.expectedAwayCorners)}</p></article><article className="rounded-2xl border bg-card p-5"><p className="text-xs font-bold uppercase text-muted-foreground">Total esperado</p><p className="mt-2 text-3xl font-black">{decimal(projection.expectedTotalCorners)}</p></article><article className="rounded-2xl border bg-card p-5"><p className="text-xs font-bold uppercase text-muted-foreground">Confiança</p><p className="mt-2 text-3xl font-black">{decimal(projection.confidenceScore * 100, 0)}%</p><p className="text-xs text-muted-foreground">{projection.sampleSize} registros analisados</p></article></div>
      <article className="rounded-3xl border bg-card p-5"><p className="text-xs font-bold uppercase text-primary">Leitura da IA</p><p className="mt-2 text-lg font-bold">{projection.summary}</p><div className="mt-4 grid gap-3 md:grid-cols-2">{projection.factors.map((factor) => <div key={factor.title} className="flex gap-3 rounded-2xl border p-4">{factor.type === 'positive' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> : factor.type === 'risk' ? <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" /> : <Sparkles className="h-5 w-5 shrink-0 text-muted-foreground" />}<div><p className="font-black">{factor.title}</p><p className="mt-1 text-sm text-muted-foreground">{factor.description}</p></div></div>)}</div></article>
      <div className="overflow-hidden rounded-3xl border bg-card"><div className="border-b p-5"><p className="text-xs font-bold uppercase text-primary">Ranking explicado</p><h2 className="text-2xl font-black">Melhores oportunidades</h2></div><div className="divide-y">{projection.offers.map((offer, index) => <article key={`${offer.bookmaker}-${offer.line}-${offer.side}-${index}`} className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-black">#{index + 1} {offer.side === 'over' ? 'Over' : 'Under'} {offer.line} — {offer.bookmaker}</p><p className={`text-xs font-bold ${offer.isValueBet ? 'text-primary' : 'text-muted-foreground'}`}>{offer.rating === 'strong-value' ? 'Valor forte' : offer.rating === 'value' ? 'Value Bet' : offer.rating === 'watch' ? 'Monitorar' : 'Evitar'}</p></div><div className="grid grid-cols-4 gap-4 text-sm"><span>Odd <b>{decimal(offer.odd)}</b></span><span>Prob. <b>{decimal(offer.probability * 100, 1)}%</b></span><span>Justa <b>{decimal(offer.fairOdd)}</b></span><span>EV <b>{decimal(offer.expectedValue * 100, 1)}%</b></span></div></div><p className="mt-3 rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">{offer.explanation}</p></article>)}</div></div>
      {projection.offers[0] && <div className="flex gap-2 rounded-2xl border bg-muted/20 p-4 text-sm"><TrendingUp className="h-4 w-4 shrink-0 text-primary" />O ranking prioriza valor esperado e vantagem sobre a probabilidade implícita da casa.</div>}
      {disclaimer && <p className="text-xs text-muted-foreground">{disclaimer}</p>}
    </section>}
  </main>;
}
