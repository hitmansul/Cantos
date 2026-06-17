import { NextRequest, NextResponse } from 'next/server';
import { apiFootballGet, isApiFootballConfigured } from '../../utils/apiFootball';
import {
  brazilianTeamStats,
  championsLeagueTeamStats,
  conferenceLeagueTeamStats,
  copaDoBrasilTeamStats,
  europaLeagueTeamStats,
  libertadoresTeamStats,
  serieBTeamStats,
  sulAmericanaTeamStats,
  type TeamCornerStats,
} from '@/data/cornerStats';
import { currentUpcomingMatches } from '@/data/currentFixtures';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LeagueScope = 'all' | 'world_cup';
type MarketType = 'corners' | 'other';
type AlertConfidence = 'alta' | 'moderada' | 'fraca';

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    timestamp?: number;
  };
  league?: {
    id?: number;
    name?: string;
    country?: string;
    round?: string;
    season?: number;
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
    id?: number;
    name?: string;
    country?: string;
    season?: number;
    round?: string;
  };
  bookmakers?: ApiFootballBookmaker[];
  bookmaker?: ApiFootballBookmaker;
};

type OddsOffer = {
  bookmaker: string;
  odd: number;
};

type OddsMarketGroup = {
  id: string;
  fixtureId: number;
  startTime: string;
  leagueName: string;
  country: string;
  homeTeam: string;
  awayTeam: string;
  marketType: MarketType;
  marketName: string;
  selectionLabel: string;
  offers: OddsOffer[];
};

type OddsAlert = {
  id: string;
  eventId: number;
  startTime: string;
  leagueName: string;
  country: string;
  homeTeam: string;
  awayTeam: string;
  marketType: MarketType;
  marketName: string;
  selectionLabel: string;
  lineLabel: string;
  bestBookmaker: string;
  bestOdd: number;
  medianOdd: number;
  secondBestOdd: number | null;
  edgePct: number;
  confidence: AlertConfidence;
  bookmakersCompared: number;
  bookmakers: OddsOffer[];
};

type OddsFilterOptions = {
  leagues: Array<{
    key: string;
    leagueName: string;
    country: string;
  }>;
  teams: Array<{
    leagueKey: string;
    team: string;
  }>;
  bookmakers: string[];
};

type OddsAlertsResponse = {
  configured: boolean;
  source: 'api-football' | 'not-configured';
  focus: 'corner-lines';
  note: string;
  summary: {
    leaguesChecked: number;
    eventsChecked: number;
    cornerAlerts: number;
    otherValueAlerts: number;
    bookmakersCompared: number;
  };
  alerts: OddsAlert[];
  options: OddsFilterOptions;
  lastUpdated: string;
};

type ApiFootballLeagueConfig = {
  key: string;
  apiFootballLeagueId: number;
  season: number;
  name: string;
  country: string;
  scope?: LeagueScope;
};

const MAX_ODDS_PAGES_PER_LEAGUE = 2;
const MAX_ALERTS = 90;
const CACHE_TTL_MS = 15 * 60 * 1000;
const DATE_FOCUSED_ODDS_DAYS = 5;
const CORNER_MEDIAN_EDGE_THRESHOLD = 12;
const CORNER_MIN_ABSOLUTE_GAP = 0.25;
const NON_CORNER_MEDIAN_EDGE_THRESHOLD = 35;
const NON_CORNER_SECOND_BEST_EDGE_THRESHOLD = 35;
const NON_CORNER_MIN_ABSOLUTE_GAP = 1;
const NON_CORNER_MIN_BOOKMAKERS = 3;
const DEFAULT_DAYS_AHEAD = 60;

const LEAGUES: ApiFootballLeagueConfig[] = [
  { key: 'world_cup', apiFootballLeagueId: 1, season: 2026, name: 'Copa do Mundo 2026', country: 'FIFA', scope: 'world_cup' },
  { key: 'brasileirao_a', apiFootballLeagueId: 71, season: 2026, name: 'Brasileirao Serie A', country: 'Brasil' },
  { key: 'brasileirao_b', apiFootballLeagueId: 72, season: 2026, name: 'Brasileirao Serie B', country: 'Brasil' },
  { key: 'copa_do_brasil', apiFootballLeagueId: 73, season: 2026, name: 'Copa do Brasil', country: 'Brasil' },
  { key: 'libertadores', apiFootballLeagueId: 13, season: 2026, name: 'Copa Libertadores', country: 'CONMEBOL' },
  { key: 'sudamericana', apiFootballLeagueId: 11, season: 2026, name: 'Copa Sul-Americana', country: 'CONMEBOL' },
  { key: 'copa_america', apiFootballLeagueId: 9, season: 2026, name: 'Copa America', country: 'CONMEBOL' },
  { key: 'champions_league', apiFootballLeagueId: 2, season: 2025, name: 'Champions League', country: 'UEFA' },
  { key: 'europa_league', apiFootballLeagueId: 3, season: 2025, name: 'Europa League', country: 'UEFA' },
  { key: 'conference_league', apiFootballLeagueId: 848, season: 2025, name: 'Conference League', country: 'UEFA' },
  { key: 'premier_league', apiFootballLeagueId: 39, season: 2025, name: 'Premier League', country: 'Inglaterra' },
  { key: 'championship', apiFootballLeagueId: 40, season: 2025, name: 'Championship', country: 'Inglaterra' },
  { key: 'la_liga', apiFootballLeagueId: 140, season: 2025, name: 'La Liga', country: 'Espanha' },
  { key: 'la_liga_2', apiFootballLeagueId: 141, season: 2025, name: 'La Liga 2', country: 'Espanha' },
  { key: 'serie_a_italy', apiFootballLeagueId: 135, season: 2025, name: 'Serie A', country: 'Italia' },
  { key: 'serie_b_italy', apiFootballLeagueId: 136, season: 2025, name: 'Serie B', country: 'Italia' },
  { key: 'bundesliga', apiFootballLeagueId: 78, season: 2025, name: 'Bundesliga', country: 'Alemanha' },
  { key: 'bundesliga_2', apiFootballLeagueId: 79, season: 2025, name: '2. Bundesliga', country: 'Alemanha' },
  { key: 'ligue_1', apiFootballLeagueId: 61, season: 2025, name: 'Ligue 1', country: 'Franca' },
  { key: 'ligue_2', apiFootballLeagueId: 62, season: 2025, name: 'Ligue 2', country: 'Franca' },
  { key: 'eredivisie', apiFootballLeagueId: 88, season: 2025, name: 'Eredivisie', country: 'Holanda' },
  { key: 'primeira_liga', apiFootballLeagueId: 94, season: 2025, name: 'Primeira Liga', country: 'Portugal' },
  { key: 'belgian_pro', apiFootballLeagueId: 144, season: 2025, name: 'Jupiler Pro League', country: 'Belgica' },
  { key: 'turkish_super', apiFootballLeagueId: 203, season: 2025, name: 'Super Lig', country: 'Turquia' },
  { key: 'argentina', apiFootballLeagueId: 128, season: 2026, name: 'Liga Profesional', country: 'Argentina' },
  { key: 'mls', apiFootballLeagueId: 253, season: 2026, name: 'MLS', country: 'EUA' },
  { key: 'liga_mx', apiFootballLeagueId: 262, season: 2025, name: 'Liga MX', country: 'Mexico' },
  { key: 'amistoso_internacional', apiFootballLeagueId: 10, season: 2026, name: 'Amistosos Internacionais', country: 'FIFA' },
];

const LOCAL_TEAM_STATS_BY_LEAGUE: Record<string, TeamCornerStats[]> = {
  brasileirao_a: brazilianTeamStats,
  brasileirao_b: serieBTeamStats,
  copa_do_brasil: copaDoBrasilTeamStats,
  libertadores: libertadoresTeamStats,
  sudamericana: sulAmericanaTeamStats,
  champions_league: championsLeagueTeamStats,
  europa_league: europaLeagueTeamStats,
  conference_league: conferenceLeagueTeamStats,
};

let responseCache: { expiresAt: number; scope: LeagueScope; body: OddsAlertsResponse } | null = null;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s.+/-]/g, ' ')
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

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateRange(daysAhead = DEFAULT_DAYS_AHEAD) {
  const now = new Date();
  return {
    from: toIsoDate(now),
    to: toIsoDate(addDays(now, daysAhead)),
  };
}

function apiFootballBookmakers(item: ApiFootballOddsItem) {
  if (Array.isArray(item.bookmakers)) return item.bookmakers;
  return item.bookmaker ? [item.bookmaker] : [];
}

function isCornerMarket(name: string): boolean {
  const normalized = normalize(name);
  return normalized.includes('corner') || normalized.includes('corners') || normalized.includes('escanteio');
}

function isLowSignalMarket(name: string): boolean {
  const normalized = normalize(name);
  return (
    normalized.includes('clean sheet') ||
    normalized.includes('correct score') ||
    normalized.includes('first team to score')
  );
}

function marketType(name: string): MarketType {
  return isCornerMarket(name) ? 'corners' : 'other';
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function confidence(edgePct: number, bookmakersCompared: number, type: MarketType): AlertConfidence {
  if (edgePct >= 18 && bookmakersCompared >= 4) return 'alta';
  if (edgePct >= 10 && bookmakersCompared >= 3) return 'moderada';
  return type === 'corners' ? 'fraca' : 'moderada';
}

function hasStrongNonCornerDistortion(offers: OddsOffer[], medianOdd: number): boolean {
  if (offers.length < NON_CORNER_MIN_BOOKMAKERS) return false;

  const best = offers[0];
  const secondBest = offers[1];
  if (!best || !secondBest) return false;

  const medianEdgePct = medianOdd > 0 ? ((best.odd / medianOdd) - 1) * 100 : 0;
  const secondBestEdgePct = ((best.odd / secondBest.odd) - 1) * 100;
  const absoluteGap = best.odd - secondBest.odd;

  return (
    medianEdgePct >= NON_CORNER_MEDIAN_EDGE_THRESHOLD &&
    secondBestEdgePct >= NON_CORNER_SECOND_BEST_EDGE_THRESHOLD &&
    absoluteGap >= NON_CORNER_MIN_ABSOLUTE_GAP
  );
}

function hasMeaningfulCornerDifference(offers: OddsOffer[], medianOdd: number): boolean {
  const best = offers[0];
  const secondBest = offers[1];
  if (!best || !secondBest) return false;

  const medianEdgePct = medianOdd > 0 ? ((best.odd / medianOdd) - 1) * 100 : 0;
  const absoluteGap = best.odd - secondBest.odd;

  return medianEdgePct >= CORNER_MEDIAN_EDGE_THRESHOLD || absoluteGap >= CORNER_MIN_ABSOLUTE_GAP;
}

function lineLabel(marketName: string, selectionLabel: string): string {
  const normalizedMarket = normalize(marketName);
  const normalizedSelection = normalize(selectionLabel);

  if (normalizedSelection.includes('over')) return selectionLabel.replace(/^over/i, 'Over').trim();
  if (normalizedSelection.includes('under')) return selectionLabel.replace(/^under/i, 'Under').trim();
  if (normalizedMarket.includes('over') || normalizedMarket.includes('under')) return selectionLabel;
  return `${marketName} - ${selectionLabel}`;
}

function fixtureLabel(fixture: ApiFootballFixture, league: ApiFootballLeagueConfig) {
  return {
    startTime: fixture.fixture.date,
    leagueName: fixture.league?.name ?? league.name,
    country: fixture.league?.country ?? league.country,
    homeTeam: fixture.teams.home.name,
    awayTeam: fixture.teams.away.name,
  };
}

async function mapLimit<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      results.push(await mapper(current));
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fixturesForLeague(league: ApiFootballLeagueConfig) {
  const { from, to } = dateRange();
  const data = await apiFootballGet<ApiFootballFixture[]>('/fixtures', {
    params: {
      league: league.apiFootballLeagueId,
      season: league.season,
      from,
      to,
      timezone: 'America/Sao_Paulo',
    },
    revalidate: 900,
    timeoutMs: 12_000,
  });

  const fixtures = new Map<number, ApiFootballFixture>();
  for (const fixture of data?.response ?? []) {
    fixtures.set(fixture.fixture.id, fixture);
  }
  return fixtures;
}

async function oddsForLeague(league: ApiFootballLeagueConfig) {
  const firstPage = await apiFootballGet<ApiFootballOddsItem[]>('/odds', {
    params: {
      league: league.apiFootballLeagueId,
      season: league.season,
      page: 1,
    },
    revalidate: 900,
    timeoutMs: 12_000,
  });

  if (!firstPage) return [];

  const items = [...(firstPage.response ?? [])];
  const totalPages = Math.min(firstPage.paging?.total ?? 1, MAX_ODDS_PAGES_PER_LEAGUE);

  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await apiFootballGet<ApiFootballOddsItem[]>('/odds', {
      params: {
        league: league.apiFootballLeagueId,
        season: league.season,
        page,
      },
      revalidate: 900,
      timeoutMs: 12_000,
    });
    items.push(...(nextPage?.response ?? []));
  }

  const { from } = dateRange();
  for (let day = 0; day < DATE_FOCUSED_ODDS_DAYS; day += 1) {
    const date = toIsoDate(addDays(new Date(`${from}T12:00:00.000Z`), day));
    const datePage = await apiFootballGet<ApiFootballOddsItem[]>('/odds', {
      params: {
        league: league.apiFootballLeagueId,
        season: league.season,
        date,
      },
      revalidate: 900,
      timeoutMs: 12_000,
    });
    items.push(...(datePage?.response ?? []));
  }

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.fixture.id}|${item.bookmakers?.length ?? 0}|${item.bookmaker?.name ?? ''}|${item.league?.id ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function groupsForLeague(league: ApiFootballLeagueConfig): Promise<OddsMarketGroup[]> {
  const [fixtures, oddsItems] = await Promise.all([fixturesForLeague(league), oddsForLeague(league)]);
  const groups = new Map<string, OddsMarketGroup>();

  for (const item of oddsItems) {
    const fixture = fixtures.get(item.fixture.id);
    if (!fixture) continue;

    const labels = fixtureLabel(fixture, league);
    for (const bookmaker of apiFootballBookmakers(item)) {
      for (const bet of bookmaker.bets ?? []) {
        const type = marketType(bet.name);
        if (type === 'other' && isLowSignalMarket(bet.name)) continue;

        for (const value of bet.values ?? []) {
          const odd = parseDecimalOdd(value.odd);
          if (!odd) continue;

          const key = [
            item.fixture.id,
            normalize(bet.name),
            normalize(value.value),
          ].join('|');

          const existing =
            groups.get(key) ??
            {
              id: key,
              fixtureId: item.fixture.id,
              ...labels,
              marketType: type,
              marketName: bet.name,
              selectionLabel: value.value,
              offers: [],
            };

          const existingOffer = existing.offers.find(
            (offer) => normalize(offer.bookmaker) === normalize(bookmaker.name)
          );
          if (!existingOffer) {
            existing.offers.push({ bookmaker: bookmaker.name, odd });
          } else if (odd > existingOffer.odd) {
            existingOffer.odd = odd;
          }

          groups.set(key, existing);
        }
      }
    }
  }

  return [...groups.values()];
}

async function safeGroupsForLeague(league: ApiFootballLeagueConfig): Promise<OddsMarketGroup[]> {
  try {
    return await groupsForLeague(league);
  } catch (error) {
    console.warn('[odds-alerts] league failed:', league.key, error);
    return [];
  }
}

function alertFromGroup(group: OddsMarketGroup): OddsAlert | null {
  const offers = group.offers
    .filter((offer) => Number.isFinite(offer.odd) && offer.odd > 1)
    .sort((a, b) => b.odd - a.odd || a.bookmaker.localeCompare(b.bookmaker));

  if (offers.length < 2) return null;

  const best = offers[0];
  const med = median(offers.map((offer) => offer.odd));
  const edgePct = med > 0 ? Math.max(0, Math.round(((best.odd / med) - 1) * 100)) : 0;

  if (group.marketType === 'corners' && !hasMeaningfulCornerDifference(offers, med)) return null;
  if (group.marketType === 'other' && !hasStrongNonCornerDistortion(offers, med)) return null;

  const compared = offers.length;
  return {
    id: group.id,
    eventId: group.fixtureId,
    startTime: group.startTime,
    leagueName: group.leagueName,
    country: group.country,
    homeTeam: group.homeTeam,
    awayTeam: group.awayTeam,
    marketType: group.marketType,
    marketName: group.marketName,
    selectionLabel: group.selectionLabel,
    lineLabel: lineLabel(group.marketName, group.selectionLabel),
    bestBookmaker: best.bookmaker,
    bestOdd: best.odd,
    medianOdd: roundTwo(med),
    secondBestOdd: offers[1]?.odd ?? null,
    edgePct,
    confidence: confidence(edgePct, compared, group.marketType),
    bookmakersCompared: compared,
    bookmakers: offers,
  };
}

function sortAlerts(a: OddsAlert, b: OddsAlert): number {
  if (a.marketType !== b.marketType) return a.marketType === 'corners' ? -1 : 1;
  if (a.edgePct !== b.edgePct) return b.edgePct - a.edgePct;
  return Date.parse(a.startTime) - Date.parse(b.startTime);
}

function scopedLeagues(scope: LeagueScope) {
  if (scope === 'world_cup') return LEAGUES.filter((league) => league.scope === 'world_cup');
  return LEAGUES;
}

function leagueOptionKey(league: Pick<ApiFootballLeagueConfig, 'country' | 'name'>): string {
  return `${league.country}|${league.name}`;
}

function addTeamOption(
  teamMap: Map<string, { leagueKey: string; team: string }>,
  leagueKey: string,
  team: string | null | undefined
) {
  const cleanTeam = team?.trim();
  if (!cleanTeam) return;
  teamMap.set(`${leagueKey}|${cleanTeam}`, { leagueKey, team: cleanTeam });
}

function addLocalTeamOptions(
  leagues: ApiFootballLeagueConfig[],
  teamMap: Map<string, { leagueKey: string; team: string }>
) {
  const leagueByInternalKey = new Map(leagues.map((league) => [league.key, league]));

  for (const [internalKey, stats] of Object.entries(LOCAL_TEAM_STATS_BY_LEAGUE)) {
    const league = leagueByInternalKey.get(internalKey);
    if (!league) continue;

    const optionKey = leagueOptionKey(league);
    for (const teamStats of stats) {
      addTeamOption(teamMap, optionKey, teamStats.team);
    }
  }

  for (const match of currentUpcomingMatches) {
    const league = leagueByInternalKey.get(match.leagueKey);
    if (!league) continue;

    const optionKey = leagueOptionKey(league);
    addTeamOption(teamMap, optionKey, match.homeTeam);
    addTeamOption(teamMap, optionKey, match.awayTeam);
  }
}

function buildFilterOptions(
  leagues: ApiFootballLeagueConfig[],
  groups: OddsMarketGroup[]
): OddsFilterOptions {
  const leagueOptions = leagues
    .map((league) => ({
      key: leagueOptionKey(league),
      leagueName: league.name,
      country: league.country,
    }))
    .sort((a, b) => `${a.country} ${a.leagueName}`.localeCompare(`${b.country} ${b.leagueName}`));

  const teamMap = new Map<string, { leagueKey: string; team: string }>();
  const bookmakerSet = new Set<string>();

  for (const group of groups) {
    const leagueKey = `${group.country}|${group.leagueName}`;
    addTeamOption(teamMap, leagueKey, group.homeTeam);
    addTeamOption(teamMap, leagueKey, group.awayTeam);
    for (const offer of group.offers) {
      if (offer.bookmaker.trim()) bookmakerSet.add(offer.bookmaker.trim());
    }
  }

  addLocalTeamOptions(leagues, teamMap);

  return {
    leagues: leagueOptions,
    teams: Array.from(teamMap.values()).sort((a, b) =>
      `${a.leagueKey} ${a.team}`.localeCompare(`${b.leagueKey} ${b.team}`)
    ),
    bookmakers: Array.from(bookmakerSet).sort((a, b) => a.localeCompare(b)),
  };
}

async function buildResponse(scope: LeagueScope): Promise<OddsAlertsResponse> {
  const leagues = scopedLeagues(scope);

  if (!isApiFootballConfigured()) {
    return {
      configured: false,
      source: 'not-configured',
      focus: 'corner-lines',
      note: 'Fonte de odds nao configurada. A tela nao mostra cotacoes estimadas.',
      summary: {
        leaguesChecked: 0,
        eventsChecked: 0,
        cornerAlerts: 0,
        otherValueAlerts: 0,
        bookmakersCompared: 0,
      },
      alerts: [],
      options: buildFilterOptions(leagues, []),
      lastUpdated: new Date().toISOString(),
    };
  }

  const groupSets = await mapLimit(leagues, 4, safeGroupsForLeague);
  const groups = groupSets.flat();
  const options = buildFilterOptions(leagues, groups);
  const alerts = groups
    .map(alertFromGroup)
    .filter((alert): alert is OddsAlert => alert !== null)
    .sort(sortAlerts)
    .slice(0, MAX_ALERTS);

  const cornerAlerts = alerts.filter((alert) => alert.marketType === 'corners').length;
  const otherValueAlerts = alerts.length - cornerAlerts;
  const eventsChecked = new Set(groups.map((group) => group.fixtureId)).size;
  const bookmakersCompared = new Set(alerts.flatMap((alert) => alert.bookmakers.map((bookmaker) => bookmaker.bookmaker))).size;

  return {
    configured: true,
    source: 'api-football',
    focus: 'corner-lines',
    note:
      cornerAlerts > 0
        ? 'Odds reais encontradas. Escanteios aparecem primeiro; outros mercados so entram quando uma casa paga muito acima das demais.'
        : 'Nenhum mercado real de escanteios foi retornado agora nas ligas consultadas. Outros mercados so aparecem quando uma casa paga muito acima das demais.',
    summary: {
      leaguesChecked: leagues.length,
      eventsChecked,
      cornerAlerts,
      otherValueAlerts,
      bookmakersCompared,
    },
    alerts,
    options,
    lastUpdated: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const scopeParam = request.nextUrl.searchParams.get('scope');
  const scope: LeagueScope = scopeParam === 'world_cup' ? 'world_cup' : 'all';

  if (responseCache && responseCache.scope === scope && responseCache.expiresAt > Date.now()) {
    return NextResponse.json(responseCache.body);
  }

  const body = await buildResponse(scope);
  responseCache = {
    scope,
    body,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return NextResponse.json(body);
}
