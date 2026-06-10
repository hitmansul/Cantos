import { NextResponse } from 'next/server';
import { apiFootballGet, isApiFootballConfigured } from '../../utils/apiFootball';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type OddsSide = 'home' | 'draw' | 'away';

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
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
  };
  league?: {
    round?: string;
  };
  bookmakers?: ApiFootballBookmaker[];
  bookmaker?: ApiFootballBookmaker;
};

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

type NormalizedOddsEvent = {
  id: string;
  startTime: string;
  roundName?: string;
  homeTeam: string;
  awayTeam: string;
  fairOdds: Record<OddsSide, number>;
  bookmakers: NormalizedBookmaker[];
  bestPick: {
    side: OddsSide;
    label: string;
    bookmaker: string;
    odd: number;
    fairOdd: number;
    edgePct: number;
  } | null;
  source: 'real';
};

const WORLD_CUP_LEAGUE_ID = 1;
const WORLD_CUP_SEASON = 2026;
const MAX_ODDS_PAGES = 10;
const MAX_FIXTURE_LOOKUPS = 80;

const TEAM_STRENGTH: Record<string, number> = {
  argentina: 86,
  brasil: 84,
  brazil: 84,
  franca: 84,
  france: 84,
  espanha: 83,
  spain: 83,
  alemanha: 82,
  germany: 82,
  inglaterra: 82,
  england: 82,
  portugal: 81,
  holanda: 80,
  netherlands: 80,
  uruguai: 78,
  uruguay: 78,
  croacia: 77,
  croatia: 77,
  colombia: 76,
  marrocos: 74,
  morocco: 74,
  suica: 74,
  switzerland: 74,
  eua: 72,
  usa: 72,
  'estados unidos': 72,
  mexico: 72,
  canada: 70,
  japao: 70,
  japan: 70,
  escocia: 69,
  scotland: 69,
  'coreia do sul': 68,
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

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseDecimalOdd(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 1 ? roundTwo(parsed) : null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function teamStrength(team: string): number {
  const normalized = normalize(team);
  if (TEAM_STRENGTH[normalized] !== undefined) return TEAM_STRENGTH[normalized];

  const found = Object.entries(TEAM_STRENGTH).find(([key]) => normalized.includes(key) || key.includes(normalized));
  return found?.[1] ?? 64;
}

function fairOdds(homeTeam: string, awayTeam: string): Record<OddsSide, number> {
  const homeStrength = teamStrength(homeTeam);
  const awayStrength = teamStrength(awayTeam);
  const diff = homeStrength - awayStrength;

  const drawProbability = Math.min(0.31, Math.max(0.18, 0.25 - Math.abs(diff) * 0.0018));
  const homeProbability = Math.min(0.82, Math.max(0.08, 0.375 + diff * 0.006));
  const awayProbability = Math.max(0.06, 1 - drawProbability - homeProbability);
  const total = homeProbability + drawProbability + awayProbability;

  return {
    home: roundTwo(1 / Math.max(0.01, homeProbability / total)),
    draw: roundTwo(1 / Math.max(0.01, drawProbability / total)),
    away: roundTwo(1 / Math.max(0.01, awayProbability / total)),
  };
}

function bestPick(
  fair: Record<OddsSide, number>,
  bookmakers: NormalizedBookmaker[]
): NormalizedOddsEvent['bestPick'] {
  const labels: Record<OddsSide, string> = {
    home: 'Casa',
    draw: 'Empate',
    away: 'Fora',
  };

  const candidates = bookmakers.flatMap((bookmaker) =>
    (['home', 'draw', 'away'] as OddsSide[])
      .map((side) => {
        const odd = bookmaker[side];
        if (!odd) return null;
        const edgePct = Math.round(((odd / fair[side]) - 1) * 100);
        return {
          side,
          label: labels[side],
          bookmaker: bookmaker.name,
          odd,
          fairOdd: fair[side],
          edgePct,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  );

  return candidates.sort((a, b) => b.edgePct - a.edgePct)[0] ?? null;
}

function apiFootballBookmakers(item: ApiFootballOddsItem): ApiFootballBookmaker[] {
  if (Array.isArray(item.bookmakers)) return item.bookmakers;
  return item.bookmaker ? [item.bookmaker] : [];
}

function isMatchWinnerBet(bet: ApiFootballBet) {
  const name = normalize(bet.name);
  return (
    bet.id === 1 ||
    name.includes('match winner') ||
    name.includes('winner') ||
    name.includes('1x2') ||
    name.includes('fulltime result') ||
    name.includes('resultado final')
  );
}

function sideFromValue(value: string, fixture: ApiFootballFixture): OddsSide | null {
  const normalizedValue = normalize(value);
  const home = normalize(fixture.teams.home.name);
  const away = normalize(fixture.teams.away.name);

  if (normalizedValue === 'home' || normalizedValue === '1') return 'home';
  if (normalizedValue === 'draw' || normalizedValue === 'x' || normalizedValue === 'empate') return 'draw';
  if (normalizedValue === 'away' || normalizedValue === '2') return 'away';

  if (normalizedValue === home || normalizedValue.includes(home) || home.includes(normalizedValue)) return 'home';
  if (normalizedValue === away || normalizedValue.includes(away) || away.includes(normalizedValue)) return 'away';

  return null;
}

function normalizeApiFootballBookmaker(
  bookmaker: ApiFootballBookmaker,
  fixture: ApiFootballFixture
): NormalizedBookmaker | null {
  const bet = bookmaker.bets?.find(isMatchWinnerBet);
  if (!bet?.values?.length) return null;

  const normalized: NormalizedBookmaker = {
    name: bookmaker.name,
    source: 'real',
    home: null,
    draw: null,
    away: null,
  };

  for (const value of bet.values) {
    const side = sideFromValue(value.value, fixture);
    const odd = parseDecimalOdd(value.odd);
    if (side && odd) normalized[side] = odd;
  }

  return normalized.home || normalized.draw || normalized.away ? normalized : null;
}

async function apiFootballFixtures() {
  const today = new Date();
  const from = toIsoDate(addDays(today, -10));
  const to = toIsoDate(addDays(today, 120));

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

  const map = new Map<number, ApiFootballFixture>();
  for (const fixture of data?.response ?? []) {
    map.set(fixture.fixture.id, fixture);
  }
  return map;
}

async function apiFootballFixtureById(id: number) {
  const data = await apiFootballGet<ApiFootballFixture[]>('/fixtures', {
    params: {
      id,
      timezone: 'America/Sao_Paulo',
    },
    revalidate: 600,
    timeoutMs: 12_000,
  });

  return data?.response?.[0] ?? null;
}

async function apiFootballOdds() {
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
  const totalPages = Math.min(firstPage.paging?.total ?? 1, MAX_ODDS_PAGES);

  for (let page = 2; page <= totalPages; page += 1) {
    const pageData = await apiFootballGet<ApiFootballOddsItem[]>('/odds', {
      params: {
        league: WORLD_CUP_LEAGUE_ID,
        season: WORLD_CUP_SEASON,
        page,
      },
      revalidate: 600,
      timeoutMs: 12_000,
    });

    items.push(...(pageData?.response ?? []));
  }

  return items;
}

async function apiFootballEvents(): Promise<NormalizedOddsEvent[] | null> {
  if (!isApiFootballConfigured()) return null;

  const [fixtures, oddsItems] = await Promise.all([apiFootballFixtures(), apiFootballOdds()]);
  const missingFixtureIds = [...new Set(oddsItems.map((item) => item.fixture.id).filter((id) => !fixtures.has(id)))].slice(
    0,
    MAX_FIXTURE_LOOKUPS
  );

  for (const fixtureId of missingFixtureIds) {
    const fixture = await apiFootballFixtureById(fixtureId);
    if (fixture) fixtures.set(fixtureId, fixture);
  }

  const byFixture = new Map<string, NormalizedOddsEvent>();

  for (const item of oddsItems) {
    const fixture = fixtures.get(item.fixture.id);
    if (!fixture) continue;

    const existing = byFixture.get(String(item.fixture.id));
    const bookmakers = apiFootballBookmakers(item)
      .map((bookmaker) => normalizeApiFootballBookmaker(bookmaker, fixture))
      .filter((bookmaker): bookmaker is NormalizedBookmaker => Boolean(bookmaker));

    if (bookmakers.length === 0) continue;

    const fair = fairOdds(fixture.teams.home.name, fixture.teams.away.name);
    const current: NormalizedOddsEvent =
      existing ??
      {
        id: String(fixture.fixture.id),
        startTime: fixture.fixture.date,
        roundName: item.league?.round ?? fixture.league?.round,
        homeTeam: fixture.teams.home.name,
        awayTeam: fixture.teams.away.name,
        fairOdds: fair,
        bookmakers: [],
        bestPick: null,
        source: 'real',
      };

    for (const bookmaker of bookmakers) {
      const index = current.bookmakers.findIndex((item) => normalize(item.name) === normalize(bookmaker.name));
      if (index >= 0) {
        current.bookmakers[index] = bookmaker;
      } else {
        current.bookmakers.push(bookmaker);
      }
    }

    current.bestPick = bestPick(current.fairOdds, current.bookmakers);
    byFixture.set(String(item.fixture.id), current);
  }

  return [...byFixture.values()]
    .filter((event) => event.bookmakers.length > 0)
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
}

async function oddsApiEvents(): Promise<NormalizedOddsEvent[] | null> {
  const apiKey = process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY;
  if (!apiKey) return null;

  const url = new URL('https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds');
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('regions', 'eu,uk,us');
  url.searchParams.set('markets', 'h2h');
  url.searchParams.set('oddsFormat', 'decimal');
  url.searchParams.set('dateFormat', 'iso');

  const response = await fetch(url, { next: { revalidate: 300 } });
  if (!response.ok) return [];

  const events = (await response.json()) as OddsApiEvent[];

  return events
    .map((event) => {
      const fair = fairOdds(event.home_team, event.away_team);
      const bookmakers = (event.bookmakers ?? [])
        .map((bookmaker) => {
          const h2h = bookmaker.markets?.find((market) => market.key === 'h2h');
          const outcomes = h2h?.outcomes ?? [];

          const findPrice = (name: string) =>
            outcomes.find((outcome) => normalize(outcome.name) === normalize(name))?.price ?? null;

          const normalized: NormalizedBookmaker = {
            name: bookmaker.title,
            source: 'real',
            home: findPrice(event.home_team),
            draw: outcomes.find((outcome) => normalize(outcome.name) === 'draw')?.price ?? null,
            away: findPrice(event.away_team),
          };

          return normalized.home || normalized.draw || normalized.away ? normalized : null;
        })
        .filter((bookmaker): bookmaker is NormalizedBookmaker => Boolean(bookmaker));

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
}

export async function GET() {
  const apiFootball = await apiFootballEvents();

  if (apiFootball && apiFootball.length > 0) {
    const hasRealBet365 = apiFootball.some((event) =>
      event.bookmakers.some((bookmaker) => normalize(bookmaker.name).includes('bet365'))
    );

    return NextResponse.json({
      configured: true,
      source: 'api-football',
      hasRealBet365,
      note: hasRealBet365
        ? 'Odds reais da Copa encontradas na API-Football, incluindo Bet365 quando disponivel.'
        : 'Odds reais da Copa encontradas na API-Football. A Bet365 nao foi retornada agora.',
      events: apiFootball,
      lastUpdated: new Date().toISOString(),
    });
  }

  const oddsApi = await oddsApiEvents();

  if (oddsApi !== null) {
    const hasRealBet365 = oddsApi.some((event) =>
      event.bookmakers.some((bookmaker) => normalize(bookmaker.name).includes('bet365'))
    );

    return NextResponse.json({
      configured: true,
      source: 'the-odds-api',
      hasRealBet365,
      note:
        oddsApi.length > 0
          ? hasRealBet365
            ? 'Odds reais da Copa encontradas na fonte alternativa, incluindo Bet365 quando disponivel.'
            : 'Odds reais da Copa encontradas na fonte alternativa. Bet365 nao retornou neste momento.'
          : 'A fonte alternativa esta configurada, mas nao retornou jogos da Copa com odds agora.',
      events: oddsApi,
      lastUpdated: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    configured: apiFootball !== null,
    source: apiFootball !== null ? 'api-football' : 'not-configured',
    hasRealBet365: false,
    note:
      apiFootball !== null
        ? 'API-Football esta configurada, mas nao retornou odds reais da Copa do Mundo agora. Configure THE_ODDS_API_KEY para tentar a fonte alternativa.'
        : 'Nenhum provedor de odds reais esta configurado. Configure API_FOOTBALL_KEY ou THE_ODDS_API_KEY.',
    events: [],
    lastUpdated: new Date().toISOString(),
  });
}
