import { NextRequest, NextResponse } from 'next/server';
import { apiFootballGet, isApiFootballConfigured } from '../../utils/apiFootball';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LeagueConfig = {
  id: number;
  season: number;
  name: string;
  country: string;
};

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
  };
  league?: {
    id?: number;
    name?: string;
    country?: string;
    round?: string;
  };
  teams: {
    home: { name: string };
    away: { name: string };
  };
};

type ApiFootballOddValue = {
  value: string;
  odd: string;
};

type ApiFootballBet = {
  name: string;
  values?: ApiFootballOddValue[];
};

type ApiFootballBookmaker = {
  name: string;
  bets?: ApiFootballBet[];
};

type ApiFootballOddsItem = {
  fixture: {
    id: number;
    date?: string;
  };
  league?: {
    id?: number;
    name?: string;
    country?: string;
    season?: number;
    round?: string;
  };
  bookmakers?: ApiFootballBookmaker[];
  bookmaker?: ApiFootballBookmaker;
};

type MatchOddsOffer = {
  bookmaker: string;
  odd: number;
};

type MatchOddsMarket = {
  id: string;
  category: 'corners' | 'cards';
  marketName: string;
  selectionLabel: string;
  lineValue: number | null;
  offers: MatchOddsOffer[];
};

type MatchOddsResponse = {
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
  markets: MatchOddsMarket[];
  lastUpdated: string;
};

const LEAGUES: LeagueConfig[] = [
  { id: 1, season: 2026, name: 'Copa do Mundo 2026', country: 'FIFA' },
  { id: 71, season: 2026, name: 'Brasileirao Serie A', country: 'Brasil' },
  { id: 72, season: 2026, name: 'Brasileirao Serie B', country: 'Brasil' },
  { id: 73, season: 2026, name: 'Copa do Brasil', country: 'Brasil' },
  { id: 13, season: 2026, name: 'Copa Libertadores', country: 'CONMEBOL' },
  { id: 11, season: 2026, name: 'Copa Sul-Americana', country: 'CONMEBOL' },
  { id: 9, season: 2026, name: 'Copa America', country: 'CONMEBOL' },
  { id: 2, season: 2025, name: 'Champions League', country: 'UEFA' },
  { id: 3, season: 2025, name: 'Europa League', country: 'UEFA' },
  { id: 848, season: 2025, name: 'Conference League', country: 'UEFA' },
  { id: 39, season: 2025, name: 'Premier League', country: 'Inglaterra' },
  { id: 40, season: 2025, name: 'Championship', country: 'Inglaterra' },
  { id: 140, season: 2025, name: 'La Liga', country: 'Espanha' },
  { id: 141, season: 2025, name: 'La Liga 2', country: 'Espanha' },
  { id: 135, season: 2025, name: 'Serie A', country: 'Italia' },
  { id: 136, season: 2025, name: 'Serie B', country: 'Italia' },
  { id: 78, season: 2025, name: 'Bundesliga', country: 'Alemanha' },
  { id: 79, season: 2025, name: '2. Bundesliga', country: 'Alemanha' },
  { id: 61, season: 2025, name: 'Ligue 1', country: 'Franca' },
  { id: 62, season: 2025, name: 'Ligue 2', country: 'Franca' },
  { id: 88, season: 2025, name: 'Eredivisie', country: 'Holanda' },
  { id: 94, season: 2025, name: 'Primeira Liga', country: 'Portugal' },
  { id: 144, season: 2025, name: 'Jupiler Pro League', country: 'Belgica' },
  { id: 203, season: 2025, name: 'Super Lig', country: 'Turquia' },
  { id: 128, season: 2026, name: 'Liga Profesional', country: 'Argentina' },
  { id: 253, season: 2026, name: 'MLS', country: 'EUA' },
  { id: 262, season: 2025, name: 'Liga MX', country: 'Mexico' },
  { id: 10, season: 2026, name: 'Amistosos Internacionais', country: 'FIFA' },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s.+/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(value: string): string {
  return normalize(value).replace(/[^a-z0-9]/g, '');
}

function parseOdd(value: string | number | null | undefined): number | null {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 1 ? Math.round(parsed * 100) / 100 : null;
}

function isCornerMarket(name: string): boolean {
  const normalized = normalize(name);
  return normalized.includes('corner') || normalized.includes('corners') || normalized.includes('escanteio');
}

function isCardMarket(name: string): boolean {
  const normalized = normalize(name);
  return (
    normalized.includes('card') ||
    normalized.includes('cards') ||
    normalized.includes('cartao') ||
    normalized.includes('cartoes') ||
    normalized.includes('booking') ||
    normalized.includes('yellow') ||
    normalized.includes('red')
  );
}

function marketCategory(name: string): MatchOddsMarket['category'] | null {
  if (isCornerMarket(name)) return 'corners';
  if (isCardMarket(name)) return 'cards';
  return null;
}

function isSameTeam(source: string, candidate: string): boolean {
  const a = compact(source);
  const b = compact(candidate);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function fixtureMatches(fixture: ApiFootballFixture, home: string, away: string): boolean {
  const direct = isSameTeam(fixture.teams.home.name, home) && isSameTeam(fixture.teams.away.name, away);
  const inverted = isSameTeam(fixture.teams.home.name, away) && isSameTeam(fixture.teams.away.name, home);
  return direct || inverted;
}

function dateOnly(value: string | null): string | null {
  if (!value) return null;
  const direct = value.match(/\d{4}-\d{2}-\d{2}/);
  if (direct) return direct[0];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function apiFootballBookmakers(item: ApiFootballOddsItem) {
  if (Array.isArray(item.bookmakers)) return item.bookmakers;
  return item.bookmaker ? [item.bookmaker] : [];
}

function lineNumber(value: string): number | null {
  const match = value.replace(',', '.').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function lineMatches(market: MatchOddsMarket, preferredLine: number | null): boolean {
  if (preferredLine === null || market.lineValue === null) return false;
  return Math.abs(market.lineValue - preferredLine) < 0.01;
}

function candidateLeagues(competition: string | null): LeagueConfig[] {
  if (!competition) return LEAGUES;

  const normalized = normalize(competition);
  const matches = LEAGUES.filter((league) => {
    const leagueName = normalize(league.name);
    return leagueName.includes(normalized) || normalized.includes(leagueName);
  });

  if (matches.length > 0) return matches;
  if (normalized.includes('libertadores')) return LEAGUES.filter((league) => league.id === 13);
  if (normalized.includes('sul americana') || normalized.includes('sudamericana')) return LEAGUES.filter((league) => league.id === 11);
  if (normalized.includes('brasileirao') && normalized.includes('serie b')) return LEAGUES.filter((league) => league.id === 72);
  if (normalized.includes('brasileirao')) return LEAGUES.filter((league) => league.id === 71);
  if (normalized.includes('copa do mundo')) return LEAGUES.filter((league) => league.id === 1);

  return LEAGUES;
}

async function findFixture(home: string, away: string, date: string | null, competition: string | null) {
  const leagues = candidateLeagues(competition);

  for (const league of leagues) {
    const data = await apiFootballGet<ApiFootballFixture[]>('/fixtures', {
      params: {
        league: league.id,
        season: league.season,
        date: date ?? undefined,
        timezone: 'America/Sao_Paulo',
      },
      revalidate: 300,
      timeoutMs: 10_000,
    });

    const fixture = (data?.response ?? []).find((candidate) => fixtureMatches(candidate, home, away));
    if (fixture) return { fixture, league };
  }

  return null;
}

async function oddsForFixture(fixtureId: number): Promise<ApiFootballOddsItem[]> {
  const data = await apiFootballGet<ApiFootballOddsItem[]>('/odds', {
    params: { fixture: fixtureId },
    revalidate: 300,
    timeoutMs: 10_000,
  });
  return data?.response ?? [];
}

async function oddsForLeagueDate(league: LeagueConfig, date: string | null): Promise<ApiFootballOddsItem[]> {
  if (!date) return [];

  const data = await apiFootballGet<ApiFootballOddsItem[]>('/odds', {
    params: {
      league: league.id,
      season: league.season,
      date,
    },
    revalidate: 300,
    timeoutMs: 10_000,
  });

  return data?.response ?? [];
}

function marketsFromOdds(items: ApiFootballOddsItem[], preferredLine: string | null): MatchOddsMarket[] {
  const markets = new Map<string, MatchOddsMarket>();
  const preferredLineNumber = preferredLine ? lineNumber(preferredLine) : null;

  for (const item of items) {
    for (const bookmaker of apiFootballBookmakers(item)) {
      for (const bet of bookmaker.bets ?? []) {
        const category = marketCategory(bet.name);
        if (!category) continue;

        for (const value of bet.values ?? []) {
          const odd = parseOdd(value.odd);
          if (!odd) continue;
          const parsedLine = lineNumber(`${bet.name} ${value.value}`);

          const key = `${normalize(bet.name)}|${normalize(value.value)}`;
          const market =
            markets.get(key) ??
            {
              id: key,
              category,
              marketName: bet.name,
              selectionLabel: value.value,
              lineValue: parsedLine,
              offers: [],
            };

          const existing = market.offers.find((offer) => normalize(offer.bookmaker) === normalize(bookmaker.name));
          if (!existing) market.offers.push({ bookmaker: bookmaker.name, odd });
          else if (odd > existing.odd) existing.odd = odd;
          markets.set(key, market);
        }
      }
    }
  }

  return [...markets.values()]
    .map((market) => ({
      ...market,
      offers: market.offers.sort((a, b) => b.odd - a.odd || a.bookmaker.localeCompare(b.bookmaker)),
    }))
    .filter((market) => market.offers.length > 0)
    .sort((a, b) => {
      const aLineMatch = lineMatches(a, preferredLineNumber) ? 0 : 1;
      const bLineMatch = lineMatches(b, preferredLineNumber) ? 0 : 1;
      if (aLineMatch !== bLineMatch) return aLineMatch - bLineMatch;
      if (a.category !== b.category) return a.category === 'corners' ? -1 : 1;
      return b.offers[0].odd - a.offers[0].odd;
    })
    .slice(0, 16);
}

export async function GET(request: NextRequest) {
  const home = request.nextUrl.searchParams.get('home') ?? '';
  const away = request.nextUrl.searchParams.get('away') ?? '';
  const date = dateOnly(request.nextUrl.searchParams.get('date'));
  const competition = request.nextUrl.searchParams.get('competition');
  const line = request.nextUrl.searchParams.get('line');

  if (!isApiFootballConfigured()) {
    return NextResponse.json({
      configured: false,
      found: false,
      markets: [],
      lastUpdated: new Date().toISOString(),
    } satisfies MatchOddsResponse);
  }

  if (!home || !away) {
    return NextResponse.json(
      {
        configured: true,
        found: false,
        markets: [],
        lastUpdated: new Date().toISOString(),
      } satisfies MatchOddsResponse,
      { status: 400 }
    );
  }

  try {
    const match = await findFixture(home, away, date, competition);
    if (!match) {
      return NextResponse.json({
        configured: true,
        found: false,
        markets: [],
        lastUpdated: new Date().toISOString(),
      } satisfies MatchOddsResponse);
    }

    let odds = await oddsForFixture(match.fixture.fixture.id);
    if (odds.length === 0) {
      const leagueDateOdds = await oddsForLeagueDate(match.league, date);
      odds = leagueDateOdds.filter((item) => item.fixture.id === match.fixture.fixture.id);
    }

    const markets = marketsFromOdds(odds, line);

    return NextResponse.json({
      configured: true,
      found: true,
      fixture: {
        id: match.fixture.fixture.id,
        startTime: match.fixture.fixture.date,
        leagueName: match.fixture.league?.name ?? match.league.name,
        country: match.fixture.league?.country ?? match.league.country,
        homeTeam: match.fixture.teams.home.name,
        awayTeam: match.fixture.teams.away.name,
      },
      markets,
      lastUpdated: new Date().toISOString(),
    } satisfies MatchOddsResponse);
  } catch (error) {
    console.error('[odds/match] Failed to load match odds', error);
    return NextResponse.json(
      {
        configured: true,
        found: false,
        markets: [],
        lastUpdated: new Date().toISOString(),
      } satisfies MatchOddsResponse,
      { status: 502 }
    );
  }
}
