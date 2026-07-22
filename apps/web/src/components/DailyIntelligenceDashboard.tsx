'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';

type DiscoveryAlert = {
  eventId: number;
  startTime: string;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  marketName: string;
  selectionLabel: string;
  bestBookmaker: string;
  bestOdd: number;
  edgePct: number;
  bookmakersCompared: number;
};

type Sample = {
  cornersFor: number;
  cornersAgainst: number;
  venue?: 'home' | 'away' | 'neutral';
  weight?: number;
};

type OddsMarket = {
  category: 'corners' | 'cards';
  marketName: string;
  selectionLabel: string;
  lineValue: number | null;
  offers: Array<{ bookmaker: string; odd: number }>;
};

type ScoreComponent = {
  key: string;
  label: string;
  points: number;
  maxPoints: number;
  explanation: string;
};

type RankedMatch = {
  eventId: number;
  startTime: string;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  score: number | null;
  classification: string;
  expectedTotal: number | null;
  confidence: number | null;
  volatility: number | null;
  decision: 'bet' | 'monitor' | 'no-bet' | 'unavailable';
  bestOffer: {
    bookmaker: string;
    line: number;
    side: 'over' | 'under';
    odd: number;
    expectedValue: number;
    edge: number;
  } | null;
  scoreComponents: ScoreComponent[];
  reason: string;
};

type DashboardState = {
  matches: RankedMatch[];
  marketsFound: number;
  lastUpdated: string;
};

function inferSide(value: string): 'over' | 'under' | null {
  const normalized = value.toLowerCase();
  if (normalized.includes('over') || normalized.includes('mais de')) return 'over';
  if (normalized.includes('under') || normalized.includes('menos de')) return 'under';
  return null;
}

function scoreClass(score: number | null) {
  if (score === null) return 'border-muted bg-muted/20';
  if (score >= 80) return 'border-primary/50 bg-primary/10';
  if (score >= 65) return 'border-emerald-500/40 bg-emerald-500/10';
  if (score >= 50) return 'border-amber-500/40 bg-amber-500/10';
  return 'border-destructive/30 bg-destructive/5';
}

function decisionLabel(decision: RankedMatch['decision']) {
  if (decision === 'bet') return 'Entrada indicada';
  if (decision === 'monitor') return 'Monitorar';
  if (decision === 'no-bet') return 'Evitar agora';
  return 'Dados insuficientes';
}

function formatPercent(value: number | null) {
  return value === null ? '—' : `${(value * 100).toFixed(1).replace('.', ',')}%`;
}

async function analyseMatch(alert: DiscoveryAlert): Promise<RankedMatch> {
  try {
    const historyQuery = new URLSearchParams({ home: alert.homeTeam, away: alert.awayTeam, limit: '5' });
    const oddsQuery = new URLSearchParams({
      home: alert.homeTeam,
      away: alert.awayTeam,
      date: alert.startTime.slice(0, 10),
      competition: alert.leagueName,
    });

    const [historyResponse, oddsResponse] = await Promise.all([
      fetch(`/api/ai-corners/history?${historyQuery}`, { cache: 'no-store' }),
      fetch(`/api/odds/match?${oddsQuery}`, { cache: 'no-store' }),
    ]);

    const history = await historyResponse.json() as {
      ok?: boolean;
      homeSamples?: Sample[];
      awaySamples?: Sample[];
      error?: string;
    };
    const odds = await oddsResponse.json() as {
      configured?: boolean;
      found?: boolean;
      markets?: OddsMarket[];
    };

    if (!historyResponse.ok || !history.ok || !history.homeSamples || !history.awaySamples) {
      throw new Error(history.error || 'Histórico insuficiente para o cálculo.');
    }

    const marketOffers = (odds.markets ?? [])
      .filter((market) => market.category === 'corners' && market.lineValue !== null)
      .flatMap((market) => {
        const side = inferSide(`${market.marketName} ${market.selectionLabel}`);
        if (!side || market.lineValue === null) return [];
        return market.offers.map((offer) => ({
          bookmaker: offer.bookmaker,
          line: market.lineValue as number,
          side,
          odd: offer.odd,
        }));
      });

    if (!marketOffers.length) {
      const fallbackSide = inferSide(`${alert.marketName} ${alert.selectionLabel}`);
      const lineMatch = `${alert.marketName} ${alert.selectionLabel}`.match(/(\d+(?:[.,]\d+)?)/);
      const line = lineMatch ? Number(lineMatch[1].replace(',', '.')) : null;
      if (fallbackSide && line !== null && Number.isFinite(line)) {
        marketOffers.push({ bookmaker: alert.bestBookmaker, line, side: fallbackSide, odd: alert.bestOdd });
      }
    }

    if (!marketOffers.length) throw new Error('Linha real sem formato compatível com o motor estatístico.');

    const projectionResponse = await fetch('/api/ai-corners/projection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        homeTeam: alert.homeTeam,
        awayTeam: alert.awayTeam,
        homeSamples: history.homeSamples,
        awaySamples: history.awaySamples,
        recentFormWeight: 0.65,
        marketOffers,
        bankroll: 1000,
        riskProfile: 'conservative',
      }),
    });
    const projectionPayload = await projectionResponse.json() as {
      ok?: boolean;
      error?: string;
      projection?: {
        expectedTotalCorners: number;
        confidenceScore: number;
        volatility: number;
        decision: 'bet' | 'monitor' | 'no-bet';
        decisionReason: string;
        opportunityScore: {
          score: number;
          label: string;
          components: ScoreComponent[];
        };
        offers: Array<{
          bookmaker: string;
          line: number;
          side: 'over' | 'under';
          odd: number;
          expectedValue: number;
          edge: number;
        }>;
      };
    };

    if (!projectionResponse.ok || !projectionPayload.ok || !projectionPayload.projection) {
      throw new Error(projectionPayload.error || 'O motor IA não concluiu a análise.');
    }

    const projection = projectionPayload.projection;
    const bestOffer = [...projection.offers].sort((a, b) => b.expectedValue - a.expectedValue || b.edge - a.edge)[0] ?? null;

    return {
      eventId: alert.eventId,
      startTime: alert.startTime,
      leagueName: alert.leagueName,
      homeTeam: alert.homeTeam,
      awayTeam: alert.awayTeam,
      score: projection.opportunityScore.score,
      classification: projection.opportunityScore.label,
      expectedTotal: projection.expectedTotalCorners,
      confidence: projection.confidenceScore,
      volatility: projection.volatility,
      decision: projection.decision,
      bestOffer,
      scoreComponents: projection.opportunityScore.components,
      reason: projection.decisionReason,
    };
  } catch (error) {
    return {
      eventId: alert.eventId,
      startTime: alert.startTime,
      leagueName: alert.leagueName,
      homeTeam: alert.homeTeam,
      awayTeam: alert.awayTeam,
      score: null,
      classification: 'Aguardando dados',
      expectedTotal: null,
      confidence: null,
      volatility: null,
      decision: 'unavailable',
      bestOffer: null,
      scoreComponents: [],
      reason: error instanceof Error ? error.message : 'Não foi possível concluir a análise automática.',
    };
  }
}

export function DailyIntelligenceDashboard() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/odds/discovery?days=3', { cache: 'no-store' });
      const payload = await response.json() as {
        configured?: boolean;
        alerts?: DiscoveryAlert[];
        lastUpdated?: string;
        note?: string;
      };
      if (!response.ok || !payload.configured) throw new Error(payload.note || 'A fonte de odds não está disponível.');

      const uniqueMatches = new Map<number, DiscoveryAlert>();
      for (const alert of payload.alerts ?? []) {
        const current = uniqueMatches.get(alert.eventId);
        if (!current || alert.bookmakersCompared > current.bookmakersCompared || alert.edgePct > current.edgePct) {
          uniqueMatches.set(alert.eventId, alert);
        }
      }

      const selected = [...uniqueMatches.values()]
        .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime) || b.bookmakersCompared - a.bookmakersCompared)
        .slice(0, 8);

      const analysed = await Promise.all(selected.map(analyseMatch));
      analysed.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || Date.parse(a.startTime) - Date.parse(b.startTime));

      setState({
        matches: analysed,
        marketsFound: payload.alerts?.length ?? 0,
        lastUpdated: payload.lastUpdated ?? new Date().toISOString(),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar o painel diário.');
      setState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => {
    const matches = state?.matches ?? [];
    const scored = matches.filter((match) => match.score !== null);
    return {
      analysed: scored.length,
      excellent: scored.filter((match) => (match.score ?? 0) >= 80).length,
      entries: scored.filter((match) => match.decision === 'bet').length,
      average: scored.length ? Math.round(scored.reduce((sum, match) => sum + (match.score ?? 0), 0) / scored.length) : 0,
    };
  }, [state]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
      <header className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-primary/10 px-3 py-1 text-xs font-black text-primary">
              <Sparkles className="h-4 w-4" /> IA Cantos 4.0
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">Os melhores jogos para escanteios, já analisados pela IA</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">O painel encontra mercados reais, cruza o histórico recente, calcula probabilidade, valor esperado, risco e produz um Score IA de 0 a 100.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-background px-4 font-bold disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar painel
            </button>
            <Link href="/ia-cantos" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground">
              <BrainCircuit className="h-4 w-4" /> Analisar uma partida
            </Link>
          </div>
        </div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<BarChart3 className="h-5 w-5" />} label="Jogos analisados" value={String(summary.analysed)} />
        <Metric icon={<Trophy className="h-5 w-5" />} label="Score excelente" value={String(summary.excellent)} />
        <Metric icon={<Target className="h-5 w-5" />} label="Entradas indicadas" value={String(summary.entries)} />
        <Metric icon={<Sparkles className="h-5 w-5" />} label="Score médio" value={summary.analysed ? String(summary.average) : '—'} />
      </section>

      {loading && (
        <div className="mt-6 flex min-h-64 flex-col items-center justify-center rounded-3xl border bg-card text-center">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
          <p className="mt-4 font-black">A IA está analisando os jogos disponíveis</p>
          <p className="mt-1 text-sm text-muted-foreground">Buscando odds, histórico e calculando o ranking diário.</p>
        </div>
      )}

      {error && !loading && (
        <div className="mt-6 rounded-3xl border border-destructive/40 bg-destructive/10 p-6">
          <div className="flex gap-3"><AlertTriangle className="h-5 w-5 shrink-0 text-destructive" /><div><p className="font-black">Não foi possível montar o ranking agora</p><p className="mt-1 text-sm text-muted-foreground">{error}</p></div></div>
        </div>
      )}

      {!loading && !error && state && (
        <>
          <section className="mt-6 flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-primary" /><div><p className="font-black">Ranking dos próximos jogos</p><p className="text-xs text-muted-foreground">{state.marketsFound} mercados localizados · atualização {new Date(state.lastUpdated).toLocaleString('pt-BR')}</p></div></div>
            <Link href="/opportunities" className="inline-flex items-center gap-2 text-sm font-bold text-primary">Ver todos os mercados <ArrowRight className="h-4 w-4" /></Link>
          </section>

          {state.matches.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed p-10 text-center text-muted-foreground">Nenhum mercado de escanteios foi disponibilizado para os próximos dias.</div>
          ) : (
            <section className="mt-5 grid gap-4">
              {state.matches.map((match, index) => {
                const analysisUrl = `/ia-cantos?home=${encodeURIComponent(match.homeTeam)}&away=${encodeURIComponent(match.awayTeam)}&date=${encodeURIComponent(match.startTime.slice(0, 10))}&competition=${encodeURIComponent(match.leagueName)}`;
                return (
                  <article key={match.eventId} className={`rounded-3xl border p-5 shadow-sm ${scoreClass(match.score)}`}>
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
                          <span className="rounded-full bg-background px-2 py-1 text-primary">#{index + 1}</span>
                          <span>{match.leagueName}</span><span>•</span><span>{new Date(match.startTime).toLocaleString('pt-BR')}</span>
                        </div>
                        <h2 className="mt-2 break-words text-xl font-black sm:text-2xl">{match.homeTeam} x {match.awayTeam}</h2>
                        <p className="mt-2 text-sm text-muted-foreground">{match.reason}</p>
                      </div>

                      <div className="grid min-w-full grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
                        <SmallMetric label="Score IA" value={match.score === null ? '—' : String(match.score)} detail={match.classification} />
                        <SmallMetric label="Total projetado" value={match.expectedTotal === null ? '—' : match.expectedTotal.toFixed(1).replace('.', ',')} detail="escanteios" />
                        <SmallMetric label="Confiança" value={formatPercent(match.confidence)} detail={match.volatility === null ? 'sem amostra' : `volatilidade ${match.volatility.toFixed(1).replace('.', ',')}`} />
                        <SmallMetric label="Decisão" value={decisionLabel(match.decision)} detail={match.bestOffer ? `${match.bestOffer.bookmaker} · ${match.bestOffer.odd.toFixed(2)}` : 'sem odd validada'} />
                      </div>
                    </div>

                    {match.bestOffer && (
                      <div className="mt-4 grid gap-3 rounded-2xl border bg-background/70 p-4 sm:grid-cols-4">
                        <SmallMetric label="Melhor mercado" value={`${match.bestOffer.side === 'over' ? 'Over' : 'Under'} ${match.bestOffer.line}`} />
                        <SmallMetric label="Melhor odd" value={match.bestOffer.odd.toFixed(2)} />
                        <SmallMetric label="Valor esperado" value={`${(match.bestOffer.expectedValue * 100).toFixed(1).replace('.', ',')}%`} />
                        <SmallMetric label="Vantagem" value={`${(match.bestOffer.edge * 100).toFixed(1).replace('.', ',')} p.p.`} />
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-3 border-t pt-4">
                      <Link href={analysisUrl} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><BrainCircuit className="h-4 w-4" /> Ver análise completa</Link>
                      <Link href={`/odds-intelligence?home=${encodeURIComponent(match.homeTeam)}&away=${encodeURIComponent(match.awayTeam)}&date=${encodeURIComponent(match.startTime.slice(0, 10))}&competition=${encodeURIComponent(match.leagueName)}`} className="inline-flex items-center gap-2 rounded-xl border bg-background px-4 py-2 text-sm font-bold">Comparar odds</Link>
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          <div className="mt-5 flex gap-3 rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <p>O ranking é uma análise estatística e não garante resultado. Confirme escalações, contexto do jogo e atualização das odds antes de qualquer decisão.</p>
          </div>
        </>
      )}

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <QuickLink href="/statistics" title="Central de estatísticas" description="Acesse o painel completo anterior com ligas, equipes, tabelas e tendências." />
        <QuickLink href="/opportunities" title="Radar de oportunidades" description="Veja todos os mercados encontrados e diferenças de preço entre casas." />
        <QuickLink href="/prediction-lab" title="Prediction Lab" description="Teste cenários, parâmetros e projeções de forma controlada." />
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <article className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-2 text-primary">{icon}<span className="text-xs font-bold uppercase text-muted-foreground">{label}</span></div><p className="mt-3 text-3xl font-black">{value}</p></article>;
}

function SmallMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="min-w-0 rounded-xl bg-background/80 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate font-black" title={value}>{value}</p>{detail && <p className="mt-1 truncate text-xs text-muted-foreground" title={detail}>{detail}</p>}</div>;
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return <Link href={href} className="group rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md"><p className="font-black">{title}</p><p className="mt-2 text-sm text-muted-foreground">{description}</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary">Abrir <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></Link>;
}
