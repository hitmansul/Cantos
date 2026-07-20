'use client';

import { FormEvent, useMemo, useState } from 'react';
import { BrainCircuit, Calculator, Search, Sparkles, TrendingUp } from 'lucide-react';

type MarketOffer = { bookmaker: string; odd: number };
type OddsMarket = {
  id: string;
  category: 'corners' | 'cards';
  marketName: string;
  selectionLabel: string;
  lineValue: number | null;
  offers: MarketOffer[];
};
type OddsResponse = {
  configured: boolean;
  found: boolean;
  fixture?: { homeTeam: string; awayTeam: string; leagueName: string; startTime: string };
  markets: OddsMarket[];
};
type ProjectionOffer = {
  bookmaker: string;
  line: number;
  side: 'over' | 'under';
  odd: number;
  probability: number;
  fairOdd: number | null;
  expectedValue: number;
  edge: number;
  isValueBet: boolean;
};
type Projection = {
  expectedHomeCorners: number;
  expectedAwayCorners: number;
  expectedTotalCorners: number;
  confidence: 'low' | 'medium' | 'high';
  offers: ProjectionOffer[];
};
type ApiResponse = { ok: boolean; projection?: Projection; error?: string; disclaimer?: string };

function parseSeries(value: string) {
  return value.split(',').map((item) => Number(item.trim().replace(',', '.'))).filter((item) => Number.isFinite(item) && item >= 0 && item <= 30);
}
function makeSamples(forValues: number[], againstValues: number[], venue: 'home' | 'away') {
  const size = Math.min(forValues.length, againstValues.length);
  return Array.from({ length: size }, (_, index) => ({
    cornersFor: forValues[index],
    cornersAgainst: againstValues[index],
    venue,
    weight: index === 0 ? 1.35 : Math.max(0.75, 1.2 - index * 0.08),
  }));
}
function decimal(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toFixed(digits).replace('.', ',');
}
function inferSide(value: string): 'over' | 'under' | null {
  const normalized = value.toLowerCase();
  if (normalized.includes('over') || normalized.includes('mais de')) return 'over';
  if (normalized.includes('under') || normalized.includes('menos de')) return 'under';
  return null;
}

export default function IACantosPage() {
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [date, setDate] = useState('');
  const [competition, setCompetition] = useState('');
  const [homeFor, setHomeFor] = useState('');
  const [homeAgainst, setHomeAgainst] = useState('');
  const [awayFor, setAwayFor] = useState('');
  const [awayAgainst, setAwayAgainst] = useState('');
  const [line, setLine] = useState('9.5');
  const [odd, setOdd] = useState('1.90');
  const [bookmaker, setBookmaker] = useState('Bet365');
  const [side, setSide] = useState<'over' | 'under'>('over');
  const [projection, setProjection] = useState<Projection | null>(null);
  const [fixtureLabel, setFixtureLabel] = useState('');
  const [marketSource, setMarketSource] = useState<'automatic' | 'manual'>('automatic');
  const [disclaimer, setDisclaimer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const samplesCount = useMemo(() => Math.min(parseSeries(homeFor).length, parseSeries(homeAgainst).length, parseSeries(awayFor).length, parseSeries(awayAgainst).length), [homeFor, homeAgainst, awayFor, awayAgainst]);

  async function loadAutomaticOffers() {
    const query = new URLSearchParams({ home: homeTeam.trim(), away: awayTeam.trim() });
    if (date) query.set('date', date);
    if (competition.trim()) query.set('competition', competition.trim());
    const response = await fetch(`/api/odds/match?${query.toString()}`, { cache: 'no-store' });
    const payload = (await response.json()) as OddsResponse;
    if (!response.ok) throw new Error('Não foi possível consultar as odds da partida.');
    if (!payload.configured) throw new Error('A API de odds ainda não está configurada no ambiente.');
    if (!payload.found || !payload.fixture) throw new Error('Partida não localizada nas competições consultadas.');
    setFixtureLabel(`${payload.fixture.homeTeam} x ${payload.fixture.awayTeam} — ${payload.fixture.leagueName}`);

    const offers = payload.markets
      .filter((market) => market.category === 'corners' && market.lineValue !== null)
      .flatMap((market) => {
        const selectedSide = inferSide(`${market.marketName} ${market.selectionLabel}`);
        if (!selectedSide || market.lineValue === null) return [];
        return market.offers.map((offer) => ({ bookmaker: offer.bookmaker, line: market.lineValue as number, side: selectedSide, odd: offer.odd }));
      })
      .filter((offer, index, items) => index === items.findIndex((item) => item.bookmaker === offer.bookmaker && item.line === offer.line && item.side === offer.side && item.odd === offer.odd));

    if (offers.length === 0) throw new Error('A partida foi localizada, mas nenhuma linha de escanteios com odds válidas foi encontrada.');
    return offers;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setProjection(null);
    setFixtureLabel('');
    const homeSamples = makeSamples(parseSeries(homeFor), parseSeries(homeAgainst), 'home');
    const awaySamples = makeSamples(parseSeries(awayFor), parseSeries(awayAgainst), 'away');
    if (!homeTeam.trim() || !awayTeam.trim()) return setError('Informe os dois times.');
    if (homeSamples.length < 3 || awaySamples.length < 3) return setError('Informe pelo menos três jogos de cada equipe, usando valores separados por vírgula.');

    setLoading(true);
    try {
      const marketOffers = marketSource === 'automatic'
        ? await loadAutomaticOffers()
        : [{ bookmaker: bookmaker.trim() || 'Casa informada', line: Number(line.replace(',', '.')), side, odd: Number(odd.replace(',', '.')) }];

      const response = await fetch('/api/ai-corners/projection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeTeam: homeTeam.trim(), awayTeam: awayTeam.trim(), homeSamples, awaySamples, recentFormWeight: 0.65, marketOffers }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.ok || !payload.projection) throw new Error(payload.error || 'Não foi possível calcular a projeção.');
      payload.projection.offers.sort((a, b) => b.expectedValue - a.expectedValue || b.edge - a.edge);
      setProjection(payload.projection);
      setDisclaimer(payload.disclaimer || '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha inesperada ao calcular a projeção.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-7">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-bold text-primary"><BrainCircuit className="h-4 w-4" /> IA Cantos</div>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Análise inteligente de escanteios</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">A IA combina a forma recente informada com as linhas e odds reais encontradas para a partida, calcula a odd justa e ordena as melhores oportunidades.</p>
      </header>

      <form onSubmit={submit} className="space-y-5 rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} placeholder="Time mandante" className="min-h-11 rounded-xl border bg-background px-4" />
          <input value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} placeholder="Time visitante" className="min-h-11 rounded-xl border bg-background px-4" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="min-h-11 rounded-xl border bg-background px-4" />
          <input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="Competição (opcional)" className="min-h-11 rounded-xl border bg-background px-4" />
        </section>

        <section className="grid gap-4 border-t pt-5 lg:grid-cols-2">
          <div className="rounded-2xl border bg-muted/20 p-4"><h2 className="font-black">Últimos jogos do mandante</h2><p className="mt-1 text-xs text-muted-foreground">Do mais recente para o mais antigo.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={homeFor} onChange={(e) => setHomeFor(e.target.value)} placeholder="A favor: 7, 5, 8, 6, 9" className="min-h-11 rounded-xl border bg-background px-4" /><input value={homeAgainst} onChange={(e) => setHomeAgainst(e.target.value)} placeholder="Contra: 3, 4, 2, 5, 4" className="min-h-11 rounded-xl border bg-background px-4" /></div></div>
          <div className="rounded-2xl border bg-muted/20 p-4"><h2 className="font-black">Últimos jogos do visitante</h2><p className="mt-1 text-xs text-muted-foreground">Do mais recente para o mais antigo.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={awayFor} onChange={(e) => setAwayFor(e.target.value)} placeholder="A favor: 5, 6, 4, 7, 5" className="min-h-11 rounded-xl border bg-background px-4" /><input value={awayAgainst} onChange={(e) => setAwayAgainst(e.target.value)} placeholder="Contra: 6, 5, 7, 4, 6" className="min-h-11 rounded-xl border bg-background px-4" /></div></div>
        </section>

        <section className="border-t pt-5">
          <div className="mb-4 flex flex-wrap gap-2"><button type="button" onClick={() => setMarketSource('automatic')} className={`rounded-xl border px-4 py-2 text-sm font-bold ${marketSource === 'automatic' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}>Buscar odds reais</button><button type="button" onClick={() => setMarketSource('manual')} className={`rounded-xl border px-4 py-2 text-sm font-bold ${marketSource === 'manual' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}>Informar odd manualmente</button></div>
          {marketSource === 'manual' && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input value={bookmaker} onChange={(e) => setBookmaker(e.target.value)} placeholder="Casa" className="min-h-11 rounded-xl border bg-background px-4" /><select value={side} onChange={(e) => setSide(e.target.value as 'over' | 'under')} className="min-h-11 rounded-xl border bg-background px-4"><option value="over">Over</option><option value="under">Under</option></select><input type="number" min="0.5" max="30" step="0.5" value={line} onChange={(e) => setLine(e.target.value)} className="min-h-11 rounded-xl border bg-background px-4" /><input type="number" min="1.01" max="100" step="0.01" value={odd} onChange={(e) => setOdd(e.target.value)} className="min-h-11 rounded-xl border bg-background px-4" /></div>}
        </section>

        <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Amostras completas identificadas por equipe: {samplesCount}</p><button disabled={loading} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-bold text-primary-foreground disabled:opacity-50">{marketSource === 'automatic' ? <Search className="h-4 w-4" /> : <Calculator className="h-4 w-4" />}{loading ? 'Analisando…' : 'Analisar partida'}</button></div>
      </form>

      {error && <div className="mt-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
      {projection && <section className="mt-6 space-y-5">
        {fixtureLabel && <div className="rounded-2xl border bg-muted/20 p-4 text-center font-bold">{fixtureLabel}</div>}
        <div className="grid gap-4 sm:grid-cols-3"><article className="rounded-2xl border bg-card p-5"><p className="text-xs font-bold uppercase text-muted-foreground">Mandante esperado</p><p className="mt-2 text-3xl font-black">{decimal(projection.expectedHomeCorners)}</p></article><article className="rounded-2xl border bg-card p-5"><p className="text-xs font-bold uppercase text-muted-foreground">Visitante esperado</p><p className="mt-2 text-3xl font-black">{decimal(projection.expectedAwayCorners)}</p></article><article className="rounded-2xl border bg-card p-5"><p className="text-xs font-bold uppercase text-muted-foreground">Total esperado</p><p className="mt-2 text-3xl font-black">{decimal(projection.expectedTotalCorners)}</p></article></div>
        <div className="overflow-hidden rounded-3xl border bg-card"><div className="border-b p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-wide text-primary">Ranking da IA</p><h2 className="mt-1 text-2xl font-black">Melhores oportunidades encontradas</h2><p className="mt-1 text-sm text-muted-foreground">Confiança do modelo: {projection.confidence === 'high' ? 'alta' : projection.confidence === 'medium' ? 'média' : 'baixa'}</p></div><div className="divide-y">{projection.offers.map((offer, index) => <article key={`${offer.bookmaker}-${offer.line}-${offer.side}-${index}`} className="grid gap-4 p-5 sm:grid-cols-[auto_1fr_repeat(4,minmax(90px,auto))] sm:items-center"><div className="flex h-9 w-9 items-center justify-center rounded-full border font-black">{index + 1}</div><div><p className="font-black">{offer.side === 'over' ? 'Over' : 'Under'} {offer.line} — {offer.bookmaker}</p><p className={`mt-1 text-xs font-bold ${offer.isValueBet ? 'text-primary' : 'text-muted-foreground'}`}>{offer.isValueBet ? 'Value Bet identificada' : 'Sem valor suficiente'}</p></div><div><p className="text-xs text-muted-foreground">Odd</p><p className="font-black">{decimal(offer.odd)}</p></div><div><p className="text-xs text-muted-foreground">Prob.</p><p className="font-black">{decimal(offer.probability * 100, 1)}%</p></div><div><p className="text-xs text-muted-foreground">Odd justa</p><p className="font-black">{decimal(offer.fairOdd)}</p></div><div><p className="text-xs text-muted-foreground">EV</p><p className="font-black">{decimal(offer.expectedValue * 100, 1)}%</p></div></article>)}</div></div>
        {projection.offers[0] && <div className="flex items-start gap-2 rounded-2xl border bg-muted/20 p-4 text-sm"><TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p>A lista foi ordenada pelo maior valor esperado. Compare também liquidez, limites e atualização da odd antes de apostar.</p></div>}
        {disclaimer && <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />{disclaimer}</p>}
      </section>}
    </main>
  );
}
