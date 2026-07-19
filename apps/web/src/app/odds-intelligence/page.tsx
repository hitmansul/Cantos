'use client';

import { FormEvent, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  Building2,
  ChevronDown,
  ChevronUp,
  Crown,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
} from 'lucide-react';

type Offer = { bookmaker: string; odd: number };
type Market = {
  id: string;
  category: 'corners' | 'cards';
  marketName: string;
  selectionLabel: string;
  lineValue: number | null;
  offers: Offer[];
};
type OddsResponse = {
  configured: boolean;
  found: boolean;
  fixture?: {
    id: number;
    startTime: string;
    leagueName: string;
    country: string;
    homeTeam: string;
    awayTeam: string;
  };
  markets: Market[];
  lastUpdated: string;
};
type RankedOffer = Offer & {
  rank: number;
  preferenceRank: number | null;
  isBestOdd: boolean;
  isFavorite: boolean;
  absoluteDifferenceFromBest: number;
  relativeDifferenceFromBestPercent: number;
};
type Decision = {
  rankedOffers: RankedOffer[];
  bestOffer: RankedOffer | null;
  preferredOffer: RankedOffer | null;
  recommendedOffer: RankedOffer | null;
  nextBestOffers: RankedOffer[];
  shouldSwitchBookmaker: boolean;
  recommendationCode: string;
  recommendation: string;
};

type RankedMarket = Market & { decision: Decision };

function number(value: number) {
  return Number(value).toFixed(2).replace('.', ',');
}

function MarketCard({ market }: { market: RankedMarket }) {
  const [expanded, setExpanded] = useState(false);
  const decision = market.decision;
  const visible = expanded ? decision.rankedOffers : decision.rankedOffers.slice(0, 3);

  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">
              {market.category === 'corners' ? 'Escanteios' : 'Cartões'}
            </span>
            {market.lineValue !== null && (
              <span className="rounded-full border px-2.5 py-1 text-xs font-semibold">Linha {market.lineValue}</span>
            )}
          </div>
          <h2 className="break-words text-lg font-black sm:text-xl">{market.selectionLabel}</h2>
          <p className="mt-1 break-words text-sm text-muted-foreground">{market.marketName}</p>
        </div>

        {decision.recommendedOffer && (
          <div className="min-w-[190px] rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Recomendação</p>
            <p className="mt-1 truncate text-sm font-bold" title={decision.recommendedOffer.bookmaker}>
              {decision.recommendedOffer.bookmaker}
            </p>
            <p className="mt-1 text-3xl font-black tabular-nums">{number(decision.recommendedOffer.odd)}</p>
          </div>
        )}
      </div>

      <div className="border-y bg-muted/30 px-4 py-3 text-sm leading-relaxed sm:px-5">
        <div className="flex items-start gap-2">
          {decision.shouldSwitchBookmaker ? (
            <ArrowDownRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          ) : (
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          )}
          <p>{decision.recommendation}</p>
        </div>
      </div>

      <div className="divide-y">
        {visible.map((offer) => (
          <div key={offer.bookmaker} className="grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:px-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-xs font-black">
              {offer.rank}
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="truncate font-bold" title={offer.bookmaker}>{offer.bookmaker}</span>
                {offer.isBestOdd && <Crown className="h-4 w-4 text-primary" aria-label="Melhor odd" />}
                {offer.isFavorite && <Star className="h-4 w-4 fill-current text-primary" aria-label="Casa favorita" />}
              </div>
              {!offer.isBestOdd && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {offer.absoluteDifferenceFromBest.toFixed(2).replace('.', ',')} abaixo da melhor
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xl font-black tabular-nums">{number(offer.odd)}</p>
              {offer.preferenceRank && <p className="text-[11px] text-muted-foreground">preferência #{offer.preferenceRank}</p>}
            </div>
          </div>
        ))}
      </div>

      {decision.rankedOffers.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex min-h-11 w-full items-center justify-center gap-2 border-t px-4 text-sm font-bold hover:bg-muted/40"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {expanded ? 'Ocultar outras casas' : `Mostrar próximas ${decision.rankedOffers.length - 3} casas`}
        </button>
      )}
    </article>
  );
}

export default function OddsIntelligencePage() {
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [date, setDate] = useState('');
  const [competition, setCompetition] = useState('');
  const [favorites, setFavorites] = useState('Bet365, Betano, Pinnacle');
  const [mode, setMode] = useState<'balanced' | 'maximum-value' | 'preferred-first'>('balanced');
  const [minimumDifference, setMinimumDifference] = useState('0.03');
  const [data, setData] = useState<OddsResponse | null>(null);
  const [markets, setMarkets] = useState<RankedMarket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const favoriteBookmakers = useMemo(
    () => favorites.split(',').map((item) => item.trim()).filter(Boolean),
    [favorites]
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!home.trim() || !away.trim()) return;
    setLoading(true);
    setError('');
    setMarkets([]);

    try {
      const query = new URLSearchParams({ home: home.trim(), away: away.trim() });
      if (date) query.set('date', date);
      if (competition.trim()) query.set('competition', competition.trim());

      const response = await fetch(`/api/odds/match?${query.toString()}`, { cache: 'no-store' });
      const payload = (await response.json()) as OddsResponse;
      if (!response.ok) throw new Error('Não foi possível consultar as odds da partida.');
      setData(payload);
      if (!payload.configured) throw new Error('A API de odds ainda não está configurada no ambiente.');
      if (!payload.found) throw new Error('Partida não localizada nas competições consultadas.');

      const ranked = await Promise.all(
        payload.markets.map(async (market) => {
          const rankResponse = await fetch('/api/odds/rank', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              offers: market.offers,
              preferences: {
                favoriteBookmakers,
                mode,
                minimumAbsoluteDifference: Number(minimumDifference) || 0.03,
                minimumRelativeDifferencePercent: 2,
              },
            }),
          });
          if (!rankResponse.ok) throw new Error('Falha ao classificar as casas.');
          const decision = (await rankResponse.json()) as Decision;
          return { ...market, decision };
        })
      );

      setMarkets(ranked);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha inesperada ao buscar odds.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-5 sm:px-5 sm:py-8 lg:px-8">
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-bold text-primary">
          <Building2 className="h-3.5 w-3.5" /> Odds Intelligence
        </div>
        <h1 className="mt-3 break-words text-2xl font-black tracking-tight sm:text-4xl">Todas as casas, uma única decisão</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Encontre a melhor odd, compare com suas casas preferidas e abra as próximas opções somente quando a diferença realmente compensar.
        </p>
      </header>

      <form onSubmit={submit} className="mb-6 space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input value={home} onChange={(e) => setHome(e.target.value)} placeholder="Time mandante" className="min-h-11 min-w-0 rounded-xl border bg-background px-4" />
          <input value={away} onChange={(e) => setAway(e.target.value)} placeholder="Time visitante" className="min-h-11 min-w-0 rounded-xl border bg-background px-4" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="min-h-11 min-w-0 rounded-xl border bg-background px-4" />
          <input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="Competição (opcional)" className="min-h-11 min-w-0 rounded-xl border bg-background px-4" />
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 border-t pt-4 lg:grid-cols-[1fr_220px_180px_auto]">
          <label className="min-w-0">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><Star className="h-3.5 w-3.5" /> Casas preferidas em ordem</span>
            <input value={favorites} onChange={(e) => setFavorites(e.target.value)} className="min-h-11 w-full min-w-0 rounded-xl border bg-background px-4" />
          </label>
          <label>
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><SlidersHorizontal className="h-3.5 w-3.5" /> Perfil</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="min-h-11 w-full rounded-xl border bg-background px-3">
              <option value="balanced">Equilibrado</option>
              <option value="maximum-value">Máximo valor</option>
              <option value="preferred-first">Casa preferida</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-muted-foreground">Diferença mínima</span>
            <input type="number" min="0" step="0.01" value={minimumDifference} onChange={(e) => setMinimumDifference(e.target.value)} className="min-h-11 w-full rounded-xl border bg-background px-4" />
          </label>
          <button disabled={loading || !home.trim() || !away.trim()} className="mt-auto flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50">
            <Search className="h-4 w-4" /> {loading ? 'Comparando…' : 'Comparar odds'}
          </button>
        </div>
      </form>

      {error && <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {data?.fixture && (
        <section className="mb-5 rounded-2xl border bg-muted/30 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{data.fixture.leagueName}</p>
          <h2 className="mt-1 break-words text-xl font-black sm:text-2xl">{data.fixture.homeTeam} x {data.fixture.awayTeam}</h2>
          <p className="mt-1 text-xs text-muted-foreground">Atualizado em {new Date(data.lastUpdated).toLocaleString('pt-BR')}</p>
        </section>
      )}

      {!loading && !error && markets.length === 0 && (
        <section className="rounded-2xl border border-dashed bg-card/50 p-8 text-center sm:p-12">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold">Compare sem abrir várias casas</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A plataforma ordenará todas as ofertas e permitirá mostrar as próximas casas sempre que o usuário desejar.
          </p>
        </section>
      )}

      {markets.length > 0 && (
        <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          {markets.map((market) => <MarketCard key={market.id} market={market} />)}
        </section>
      )}
    </main>
  );
}
