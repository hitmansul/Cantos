import { NextResponse } from 'next/server';
import { apiFootballGet, isApiFootballConfigured } from '../../utils/apiFootball';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ApiFootballFixture = {
  fixture: { id: number; date: string };
  league?: { round?: string };
  teams: { home: { name: string }; away: { name: string } };
};

type ApiFootballOddValue = { value: string; odd: string };
type ApiFootballBet = { id?: number; name: string; values?: ApiFootballOddValue[] };
type ApiFootballBookmaker = { id?: number; name: string; bets?: ApiFootballBet[] };
type ApiFootballOddsItem = {
  fixture: { id: number; date?: string };
  league?: { round?: string };
  bookmakers?: ApiFootballBookmaker[];
  bookmaker?: ApiFootballBookmaker;
};

type CornerSide = 'over' | 'under' | 'home' | 'away' | 'exact' | 'other';

type CornerLineOdd = {
  bookmaker: string;
  market: string;
  line: string;
  side: CornerSide;
  label: string;
  odd: number;
};

type CornerAlert = {
  market: string;
  line: string;
  side: CornerSide;
  label: string;
  bookmaker: string;
  odd: number;
  nextBestOdd: number;
  averageOdd: number;
  edgePct: number;
  comparedBookmakers: number;
};

type CornerEvent = {
  id: string;
  startTime: string;
  roundName?: string;
  homeTeam: string;
  awayTeam: string;
  bookmakersCount: number;
  cornerLines: CornerLineOdd[];
  alerts: CornerAlert[];
  source: 'real';
};

const WORLD_CUP_LEAGUE_ID = 1;
const WORLD_CUP_SEASON = 2026;
const MAX_ODDS_PAGES = 10;
const MAX_FIXTURE_LOOKUPS = 80;
const MIN_ALERT_EDGE_PCT = 25;
const MIN_BOOKMAKERS_FOR_ALERT = 2;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.,+\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDecimalOdd(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 1 ? Math.round(parsed * 100) / 100 : null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function apiFootballBookmakers(item: ApiFootballOddsItem): ApiFootballBookmaker[] {
  if (Array.isArray(item.bookmakers)) return item.bookmakers;
  return item.bookmaker ? [item.bookmaker] : [];
}

function isCornerBet(bet: ApiFootballBet): boolean {
  const name = normalize(bet.name);
  return (
    name.includes('corner') ||
    name.includes('corners') ||
    name.includes('escanteio') ||
    name.includes('escanteios') ||
    name.includes('canto') ||
    name.includes('cantos')
  );
}

function detectSide(value: string): CornerSide {
  const normalized = normalize(value);
  if (normalized.includes('over') || normalized.includes('mais') || normalized.includes('acima')) return 'over';
  if (normalized.includes('under') || normalized.includes('menos') || normalized.includes('abaixo')) return 'under';
  if (normalized.includes('home') || normalized.includes('mandante') || normalized.includes('casa')) return 'home';
  if (normalized.includes('away') || normalized.includes('visitante') || normalized.includes('fora')) return 'away';
  if (normalized.includes('exact') || normalized.includes('exato')) return 'exact';
  return 'other';
}

function detectLine(value: string): string {
  const normalized = normalize(value);
  const decimalMatch = normalized.match(/(\d+(?:[.,]\d+)?)/);
  if (decimalMatch?.[1]) return decimalMatch[1].replace(',', '.');
  return 'sem linha';
}

function cleanLabel(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractCornerLines(bookmaker: ApiFootballBookmaker): CornerLineOdd[] {
  const lines: CornerLineOdd[] = [];

  for (const bet of bookmaker.bets ?? []) {
    if (!isCornerBet(bet)) continue;

    for (const value of bet.values ?? []) {
      const odd = parseDecimalOdd(value.odd);
      if (!odd) continue;

      lines.push({
        bookmaker: bookmaker.name,
        market: bet.name,
        line: detectLine(value.value),
        side: detectSide(value.value),
        label: cleanLabel(value.value),
        odd,
      });
    }
  }

  return lines;
}

function groupKey(line: CornerLineOdd): string {
  return [
    normalize(line.market),
    line.line,
    line.side,
    normalize(line.label).replace(/\d+(?:[.,]\d+)?/g, '').replace(/\s+/g, ' ').trim(),
  ].join('|');
}

function buildAlerts(lines: CornerLineOdd[]): CornerAlert[] {
  const groups = new Map<string, CornerLineOdd[]>();

  for (const line of lines) {
    const key = groupKey(line);
    const current = groups.get(key) ?? [];
    current.push(line);
    groups.set(key, current);
  }

  const alerts: CornerAlert[] = [];

  for (const group of groups.values()) {
    const uniqueBookmakers = new Map<string, CornerLineOdd>();

    for (const line of group) {
      const previous = uniqueBookmakers.get(normalize(line.bookmaker));
      if (!previous || line.odd > previous.odd) uniqueBookmakers.set(normalize(line.bookmaker), line);
    }

    const values = [...uniqueBookmakers.values()].sort((a, b) => b.odd - a.odd);
    if (values.length < MIN_BOOKMAKERS_FOR_ALERT) continue;

    const best = values[0];
    const secondBest = values[1];
    const average = values.reduce((sum, item) => sum + item.odd, 0) / values.length;
    const edgePct = Math.round(((best.odd / secondBest.odd) - 1) * 100);

    if (edgePct < MIN_ALERT_EDGE_PCT) continue;

    alerts.push({
      market: best.market,
      line: best.line,
      side: best.side,
      label: best.label,
      bookmaker: best.bookmaker,
      odd: best.odd,
      nextBestOdd: secondBest.odd,
      averageOdd: Math.round(average * 100) / 100,
      edgePct,
      comparedBookmakers: values.length,
    });
  }

  return alerts.sort((a, b) => b.edgePct - a.edgePct);
}

async function apiFootballFixtures() {
  const today = new Date();
  const from = toIsoDate(addDays(today, -10));
  const to = toIsoDate(addDays(today, 120));

  const data = await apiFootballGet<ApiFootballFixture[]>('/fixtures', {
    params: { league: WORLD_CUP_LEAGUE_ID, season: WORLD_CUP_SEASON, from, to, timezone: 'America/Sao_Paulo' },
    revalidate: 600,
    timeoutMs: 12_000,
  });

  const map = new Map<number, ApiFootballFixture>();
  for (const fixture of data?.response ?? []) map.set(fixture.fixture.id, fixture);
  return map;
}

async function apiFootballFixtureById(id: number) {
  const data = await apiFootballGet<ApiFootballFixture[]>('/fixtures', {
    params: { id, timezone: 'America/Sao_Paulo' },
    revalidate: 600,
    timeoutMs: 12_000,
  });
  return data?.response?.[0] ?? null;
}

async function apiFootballOdds() {
  const firstPage = await apiFootballGet<ApiFootballOddsItem[]>('/odds', {
    params: { league: WORLD_CUP_LEAGUE_ID, season: WORLD_CUP_SEASON, page: 1 },
    revalidate: 600,
    timeoutMs: 12_000,
  });

  if (!firstPage) return [];

  const items = [...(firstPage.response ?? [])];
  const totalPages = Math.min(firstPage.paging?.total ?? 1, MAX_ODDS_PAGES);

  for (let page = 2; page <= totalPages; page += 1) {
    const pageData = await apiFootballGet<ApiFootballOddsItem[]>('/odds', {
      params: { league: WORLD_CUP_LEAGUE_ID, season: WORLD_CUP_SEASON, page },
      revalidate: 600,
      timeoutMs: 12_000,
    });
    items.push(...(pageData?.response ?? []));
  }

  return items;
}

async function apiFootballCornerEvents(): Promise<CornerEvent[] | null> {
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

  const byFixture = new Map<string, CornerEvent>();

  for (const item of oddsItems) {
    const fixture = fixtures.get(item.fixture.id);
    if (!fixture) continue;

    const bookmakers = apiFootballBookmakers(item);
    const cornerLines = bookmakers.flatMap(extractCornerLines);
    if (cornerLines.length === 0) continue;

    const fixtureId = String(item.fixture.id);
    const existing = byFixture.get(fixtureId);

    if (existing) {
      existing.cornerLines.push(...cornerLines);
      existing.bookmakersCount = new Set(existing.cornerLines.map((line) => normalize(line.bookmaker))).size;
      existing.alerts = buildAlerts(existing.cornerLines);
      continue;
    }

    byFixture.set(fixtureId, {
      id: fixtureId,
      startTime: fixture.fixture.date,
      roundName: item.league?.round ?? fixture.league?.round,
      homeTeam: fixture.teams.home.name,
      awayTeam: fixture.teams.away.name,
      bookmakersCount: new Set(cornerLines.map((line) => normalize(line.bookmaker))).size,
      cornerLines,
      alerts: buildAlerts(cornerLines),
      source: 'real',
    });
  }

  return [...byFixture.values()].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
}

export async function GET() {
  const events = await apiFootballCornerEvents();

  if (events !== null) {
    const linesCount = events.reduce((sum, event) => sum + event.cornerLines.length, 0);
    const alertsCount = events.reduce((sum, event) => sum + event.alerts.length, 0);
    const bookmakers = [...new Set(events.flatMap((event) => event.cornerLines.map((line) => line.bookmaker)))].sort();

    return NextResponse.json({
      configured: true,
      source: 'api-football',
      focus: 'corner-lines',
      note:
        events.length > 0
          ? 'Linhas reais de escanteios encontradas na API-Football. Alertas aparecem quando uma casa paga muito acima da segunda melhor odd para a mesma linha.'
          : 'API-Football esta configurada, mas nao retornou mercados de escanteios para a Copa do Mundo agora.',
      summary: { eventsChecked: events.length, cornerLines: linesCount, alerts: alertsCount, bookmakersCompared: bookmakers.length },
      bookmakers,
      events,
      lastUpdated: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    configured: false,
    source: 'not-configured',
    focus: 'corner-lines',
    note: 'API-Football nao esta configurada. Configure API_FOOTBALL_KEY para buscar odds reais de escanteios.',
    summary: { eventsChecked: 0, cornerLines: 0, alerts: 0, bookmakersCompared: 0 },
    bookmakers: [],
    events: [],
    lastUpdated: new Date().toISOString(),
  });
}
