import { NextRequest, NextResponse } from 'next/server';
import { apiFootballGet, isApiFootballConfigured } from '../../utils/apiFootball';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type OddValue = { value?: string; odd?: string };
type Bet = { name?: string; values?: OddValue[] };
type Bookmaker = { name?: string; bets?: Bet[] };
type OddsItem = {
  fixture?: { id?: number; date?: string };
  league?: { name?: string; country?: string };
  teams?: { home?: { name?: string }; away?: { name?: string } };
  bookmakers?: Bookmaker[];
  bookmaker?: Bookmaker;
};

type DiscoveryAlert = {
  id: string;
  eventId: number;
  startTime: string;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  marketName: string;
  selectionLabel: string;
  bestBookmaker: string;
  bestOdd: number;
  medianOdd: number;
  edgePct: number;
  confidence: 'fraca';
  bookmakersCompared: number;
  discovery: true;
};

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const isCorner = (value: string) => {
  const normalized = normalize(value);
  return normalized.includes('corner') || normalized.includes('escanteio');
};
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function bookmakers(item: OddsItem) {
  if (Array.isArray(item.bookmakers)) return item.bookmakers;
  return item.bookmaker ? [item.bookmaker] : [];
}

export async function GET(request: NextRequest) {
  if (!isApiFootballConfigured()) {
    return NextResponse.json({ configured: false, alerts: [], note: 'API de odds não configurada.' });
  }

  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get('days') ?? 7), 1), 14);
  const collected: OddsItem[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offset);
    const payload = await apiFootballGet<OddsItem[]>('/odds', {
      params: { date: isoDate(date) },
      revalidate: 600,
      timeoutMs: 15_000,
    });
    collected.push(...(payload?.response ?? []));
  }

  const grouped = new Map<string, DiscoveryAlert & { offers: Array<{ bookmaker: string; odd: number }> }>();

  for (const item of collected) {
    const eventId = item.fixture?.id;
    if (!eventId) continue;
    const homeTeam = item.teams?.home?.name ?? 'Mandante';
    const awayTeam = item.teams?.away?.name ?? 'Visitante';

    for (const bookmaker of bookmakers(item)) {
      for (const bet of bookmaker.bets ?? []) {
        if (!isCorner(bet.name ?? '')) continue;
        for (const value of bet.values ?? []) {
          const odd = Number(String(value.odd ?? '').replace(',', '.'));
          if (!Number.isFinite(odd) || odd <= 1) continue;
          const key = `${eventId}|${normalize(bet.name ?? '')}|${normalize(value.value ?? '')}`;
          const current = grouped.get(key) ?? {
            id: key,
            eventId,
            startTime: item.fixture?.date ?? '',
            leagueName: item.league?.name ?? 'Competição não informada',
            homeTeam,
            awayTeam,
            marketName: bet.name ?? 'Escanteios',
            selectionLabel: value.value ?? 'Linha disponível',
            bestBookmaker: bookmaker.name ?? 'Casa disponível',
            bestOdd: odd,
            medianOdd: odd,
            edgePct: 0,
            confidence: 'fraca' as const,
            bookmakersCompared: 1,
            discovery: true as const,
            offers: [],
          };
          const existing = current.offers.find((offer) => normalize(offer.bookmaker) === normalize(bookmaker.name ?? ''));
          if (!existing) current.offers.push({ bookmaker: bookmaker.name ?? 'Casa disponível', odd });
          else existing.odd = Math.max(existing.odd, odd);
          grouped.set(key, current);
        }
      }
    }
  }

  const alerts = Array.from(grouped.values()).map((item) => {
    const ordered = item.offers.sort((a, b) => b.odd - a.odd);
    const odds = ordered.map((offer) => offer.odd).sort((a, b) => a - b);
    const middle = Math.floor(odds.length / 2);
    const median = odds.length % 2 ? odds[middle] : (odds[middle - 1] + odds[middle]) / 2;
    const best = ordered[0];
    return {
      ...item,
      bestBookmaker: best?.bookmaker ?? item.bestBookmaker,
      bestOdd: best?.odd ?? item.bestOdd,
      medianOdd: Number(median.toFixed(2)),
      edgePct: median > 0 ? Number((((best?.odd ?? median) / median - 1) * 100).toFixed(1)) : 0,
      bookmakersCompared: ordered.length,
      offers: undefined,
    };
  }).sort((a, b) => b.bookmakersCompared - a.bookmakersCompared || b.edgePct - a.edgePct).slice(0, 120);

  return NextResponse.json({
    configured: true,
    alerts,
    lastUpdated: new Date().toISOString(),
    note: alerts.length
      ? 'Mercados reais de escanteios encontrados. Itens com pouca comparação aparecem como mercados para análise, não como apostas confirmadas.'
      : 'Nenhum mercado de escanteios foi disponibilizado pela fonte nos próximos dias.',
  }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
