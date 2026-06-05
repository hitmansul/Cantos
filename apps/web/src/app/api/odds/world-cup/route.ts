import { NextResponse } from 'next/server';
import { apiFootballGet, isApiFootballConfigured } from '../../utils/apiFootball';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type OddsSide = 'home' | 'draw' | 'away';

type OddsApiOutcome = {
  name: string;
  price: number;
};

type OddsApiBookmaker = {
  key: string;
  title: string;
  markets?: Array<{
    key: string;
    outcomes?: OddsApiOutcome[];
  }>;
};

type OddsApiEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: OddsApiBookmaker[];
};

type NormalizedBookmaker = {
  name: string;
  source: 'real';
  home: number | null;
  draw: number | null;
  away: number | null;
};

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
  };
  league?: {
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
  id?: number;
  name: string;
  values?: ApiFootballOddValue[];
};

type ApiFootballBookmaker = {
  id?: number;
  name: string;
  bets?: ApiFootballBet[];
};

type ApiFootballOddsItem = {
  fixture: {
    id: number;
    date?: string;
    timestamp?: number;
  };
  league?: {
    round?: string;
  };
  bookmakers?: ApiFootballBookmaker[];
  bookmaker?: ApiFootballBookmaker;
};

type NormalizedOddsEvent = {
  id: string;
  startTime: string;
  roundName?: string;
  homeTeam: string;
  awayTeam: string;
  fairOdds: ReturnType<typeof fairOdds>;
  bookmakers: NormalizedBookmaker[];
  bestPick: ReturnType<typeof bestPick>;
  source: 'real';
};

const WORLD_CUP_LEAGUE_ID = 1;
const WORLD_CUP_SEASON = 2026;
const MAX_API_FOOTBALL_ODDS_PAGES = 6;

const STRENGTH: Record<string, number> = {
  argentina: 86,
  brasil: 84,
  brazil: 84,
  france: 84,
  franca: 84,
  espanha: 83,
  spain: 83,
  germany: 82,
  alemanha: 82,
  england: 82,
  inglaterra: 82,
  portugal: 81,
  holanda: 80,
  netherlands: 80,
  uruguai: 78,
  croacia: 77,
  colombia: 76,
  marrocos: 74,
  morocco: 74,
  suica: 74,
  switzerland: 74,
  eua: 72,
  usa: 72,
  mexico: 72,
  canada: 70,
  japao: 70,
  japan: 70,
  escocia: 69,
  scotland: 69,
  coreia: 68,
  paraguai: 67,
  haiti: 55,
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function roundOdd(value: number): number {
  return Math.round(value * 100) / 100;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function oddsFromProbability(probability: number, margin = 1.06): number {
  return roundOdd(1 / Math.max(0.01, probability * margin));
}

function teamStrength(team: string): number {
  const normalized = normalize(team);
  const direct = STRENGTH[normalized];
  if (direct !== undefined) return direct;
  const partial = Object.entries(STRENGTH).find(([name]) => normalized.includes(name) || name.includes(normalized));
  return partial?.[1] ?? 64;
}

function fairOdds(homeTeam: string, awayTeam: string) {
  const homeStrength = teamStrength(homeTeam);
  const awayStrength = teamStrength(awayTeam);
  const diff = homeStrength - awayStrength;
  const drawProb = Math.min(0.31, Math.max(0.18, 0.25 - Math.abs(diff) * 0.0018));
  const homeProb = Math.min(0.82, Math.max(0.08, 0.375 + diff * 0.006));
  const awayProb = Math.max(0.06, 1 - drawProb - homeProb);
  const total = homeProb + drawProb + awayProb;

  return {
    home: oddsFromProbability(homeProb / total, 1),
    draw: oddsFromProbability(drawProb / total, 1),
    away: oddsFromProbability(awayProb / total, 1),
  };
}

function realBookmakers(event: OddsApiEvent): NormalizedBookmaker[] {
  return (event.bookmakers ?? [])
    .map((bookmaker) => {
      const h2h = bookmaker.markets?.find((market) => market.key === 'h2h');
      const outcomes = h2h?.outcomes ?? [];
      const findPrice = (name: string) =>
        outcomes.find((outcome) => normalize(outcome.name) === normalize(name))?.price ?? null;

      return {
        name: bookmaker.title,
        source: 'real' as const,
        home: findPrice(event.home_team),
        draw: outcomes.find((outcome) => normalize(outcome.name) === 'draw')?.price ?? null,
        away: findPrice(event.away_team),
      };
    })
    .filter((bookmaker) => bookmaker.home || bookmaker.draw || bookmaker.away);
}

function parseDecimalOdd(value: string | number | null | undefined) {
  if (value === undefined || value === null) return null;
  const numberValue = Number(String(value).replace(',', '.'));
  return Number.isFinite(numberValue) && numberValue > 1 ? roundOdd(numberValue) : null;
}

function fixtureDateRange() {
  const today = new Date();
  return {
    from: toIsoDate(today),
    to: toIsoDate(addDays(today, 45)),
  };
}

async function apiFootballWorldCupFixtures() {
  const { from, to } = fixtureDateRange();
  const data = await apiFootballGet<ApiFootballFixture[]>('/fixtures', {
    params: {
      league: WORLD_CUP_LEAGUE_ID,
      season: WORLD_CUP_SEASON,
      from,
      to,
      timezone: 'America/Sao_Paulo',
    },
    revalidate: 600,
    timeoutMs: 12_000,
  });

  const fixtureMap = new Map<number, ApiFootballFixture>();
  for (const fixture of data?.response ?? []) {
    fixtureMap.set(fixture.fixture.id, fixture);
  }
  return fixtureMap;
}

async function apiFootballWorldCupOdds() {
  const firstPage = await apiFootballGet<ApiFootballOddsItem[]>('/odds', {
    params: {
      league: WORLD_CUP_LEAGUE_ID,
      season: WORLD_CUP_SEASON,
      page: 1,
    },
    revalidate: 600,
    timeoutMs: 12_000,
  });

  if (!firstPage) return [];

  const items = [...(firstPage.response ?? [])];
  const totalPages = Math.min(firstPage.paging?.total ?? 1, MAX_API_FOOTBALL_ODDS_PAGES);

  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await apiFootballGet<ApiFootballOddsItem[]>('/odds', {
      params: {
        league: WORLD_CUP_LEAGUE_ID,
        season: WORLD_CUP_SEASON,
        page,
      },
      revalidate: 600,
      timeoutMs: 12_000,
    });
    items.push(...(nextPage?.response ?? []));
  }

  return items;
}

function apiFootballBookmakers(item: ApiFootballOddsItem) {
  if (Array.isArray(item.bookmakers)) return item.bookmakers;
  return item.bookmaker ? [item.bookmaker] : [];
}

function isMatchWinnerBet(bet: ApiFootballBet) {
  const name = normalize(bet.name);
  return bet.id === 1 || name.includes('match winner') || name.includes('winner') || name.includes('1x2');
}

function apiFootballBookmakerOdds(
  bookmaker: ApiFootballBookmaker,
  fixture: ApiFootballFixture
): NormalizedBookmaker | null {
  const bet = bookmaker.bets?.find(isMatchWinnerBet);
  if (!bet?.values?.length) return null;

  const homeTeam = normalize(fixture.teams.home.name);
  const awayTeam = normalize(fixture.teams.away.name);

  const findOdd = (side: OddsSide) => {
    for (const value of bet.values ?? []) {
      const normalizedValue = normalize(value.value);
      const isHome =
        side === 'home' &&
        (normalizedValue === 'home' ||
          normalizedValue === '1' ||
          normalizedValue === homeTeam ||
          normalizedValue.includes(homeTeam) ||
          homeTeam.includes(normalizedValue));
      const isDraw = side === 'draw' && (normalizedValue === 'draw' || normalizedValue === 'x');
      const isAway =
        side === 'away' &&
        (normalizedValue === 'away' ||
          normalizedValue === '2' ||
          normalizedValue === awayTeam ||
          normalizedValue.includes(awayTeam) ||
          awayTeam.includes(normalizedValue));

      if (isHome || isDraw || isAway) return parseDecimalOdd(value.odd);
    }
    return null;
  };

  const odds = {
    name: bookmaker.name,
    source: 'real' as const,
    home: findOdd('home'),
    draw: findOdd('draw'),
    away: findOdd('away'),
  };

  return odds.home || odds.draw || odds.away ? odds : null;
}

async function apiFootballEvents(): Promise<NormalizedOddsEvent[] | null> {
  if (!isApiFootballConfigured()) return null;

  const [fixtures, oddsItems] = await Promise.all([apiFootballWorldCupFixtures(), apiFootballWorldCupOdds()]);

  return oddsItems
    .map((item) => {
      const fixture = fixtures.get(item.fixture.id);
      if (!fixture) return null;

      const bookmakers = apiFootballBookmakers(item)
        .map((bookmaker) => apiFootballBookmakerOdds(bookmaker, fixture))
        .filter((bookmaker): bookmaker is NormalizedBookmaker => Boolean(bookmaker));

      if (bookmakers.length === 0) return null;

      const fair = fairOdds(fixture.teams.home.name, fixture.teams.away.name);
      const event: NormalizedOddsEvent = {
        id: String(fixture.fixture.id),
        startTime: fixture.fixture.date,
        homeTeam: fixture.teams.home.name,
        awayTeam: fixture.teams.away.name,
        fairOdds: fair,
        bookmakers,
        bestPick: bestPick(fair, bookmakers),
        source: 'real' as const,
      };

      const roundName = item.league?.round ?? fixture.league?.round;
      if (roundName) event.roundName = roundName;
      return event;
    })
    .filter((event): event is NormalizedOddsEvent => event !== null)
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
}

async function oddsApiEvents(): Promise<OddsApiEvent[] | null> {
  const apiKey = process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY;
  if (!apiKey) return null;

  const url = new URL('https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds');
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('regions', 'eu,uk,us');
  url.searchParams.set('markets', 'h2h');
  url.searchParams.set('oddsFormat', 'decimal');
  url.searchParams.set('dateFormat', 'iso');
  url.searchParams.set('bookmakers', 'bet365,pinnacle,williamhill,betfair_ex_uk,onexbet');

  const response = await fetch(url, { next: { revalidate: 300 } });
  if (!response.ok) return [];
  return (await response.json()) as OddsApiEvent[];
}

function bestPick(
  fair: { home: number; draw: number; away: number },
  bookmakers: NormalizedBookmaker[]
): { side: OddsSide; label: string; bookmaker: string; odd: number; fairOdd: number; edgePct: number } | null {
  const labels: Record<OddsSide, string> = { home: 'Mandante', draw: 'Empate', away: 'Visitante' };
  const candidates = bookmakers.flatMap((bookmaker) =>
    (['home', 'draw', 'away'] as OddsSide[])
      .map((side) => {
        const odd = bookmaker[side];
        if (!odd) return null;
        const edgePct = Math.round(((odd / fair[side]) - 1) * 100);
        return { side, label: labels[side], bookmaker: bookmaker.name, odd, fairOdd: fair[side], edgePct };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  );

  return candidates.sort((a, b) => b.edgePct - a.edgePct)[0] ?? null;
}

export async function GET() {
  const apiFootballRealEvents = await apiFootballEvents();

  if (apiFootballRealEvents !== null) {
    const hasRealBet365 = apiFootballRealEvents.some((event) =>
      event.bookmakers.some((bookmaker) => normalize(bookmaker.name).includes('bet365'))
    );

    return NextResponse.json({
      configured: true,
      source: 'api-football',
      hasRealBet365,
      note:
        apiFootballRealEvents.length === 0
          ? 'Nenhuma odd da Copa do Mundo foi retornada agora.'
          : hasRealBet365
            ? 'Odds da Copa encontradas, incluindo Bet365 quando disponivel.'
            : 'Odds da Copa encontradas, mas a Bet365 nao foi retornada agora.',
      events: apiFootballRealEvents,
      lastUpdated: new Date().toISOString(),
    });
  }

  const realEvents = await oddsApiEvents();

  if (realEvents === null) {
    return NextResponse.json({
      configured: false,
      source: 'not-configured',
      hasRealBet365: false,
      note: 'Nenhum provedor de odds reais esta configurado. A aplicacao nao mostra odds estimadas.',
      events: [],
      lastUpdated: new Date().toISOString(),
    });
  }

  const events = realEvents
    .map((event) => {
      const bookmakers = realBookmakers(event);
      const fair = fairOdds(event.home_team, event.away_team);
      return {
        id: event.id,
        startTime: event.commence_time,
        homeTeam: event.home_team,
        awayTeam: event.away_team,
        fairOdds: fair,
        bookmakers,
        bestPick: bestPick(fair, bookmakers),
        source: 'real' as const,
      };
    })
    .filter((event) => event.bookmakers.length > 0)
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));

  const hasRealBet365 = events.some((event) =>
    event.bookmakers.some((bookmaker) => normalize(bookmaker.name).includes('bet365'))
  );

  return NextResponse.json({
    configured: true,
    source: 'the-odds-api',
    hasRealBet365,
    note: hasRealBet365
      ? 'Odds reais da Bet365 encontradas na fonte configurada.'
      : 'Fonte real configurada, mas nenhuma odd real da Bet365 foi retornada agora.',
    events,
    lastUpdated: new Date().toISOString(),
  });
}
