import { NextRequest, NextResponse } from 'next/server';

type LiveStatRow = {
  key: string;
  label: string;
  home: string;
  away: string;
  order: number;
  categoryOrder: number;
  category?: string;
  isMajor?: boolean;
};

type LiveMatch = {
  id: number;
  minute: number | string;
  statusText?: string;
  competition?: string;
  homeTeam: { id: number; name: string; score: number };
  awayTeam: { id: number; name: string; score: number };
  corners?: { home: number; away: number; total: number };
  liveStats?: LiveStatRow[];
  statsSource?: string;
  sourceIds?: { sofascore?: number; scores365?: number; apiFootball?: number };
  [key: string]: unknown;
};

type SofaStatisticItem = {
  name?: string;
  home?: string | number | null;
  away?: string | number | null;
  statisticsType?: string;
  valueType?: string;
  compareCode?: number;
};

type SofaStatisticsResponse = {
  statistics?: Array<{
    period?: string;
    groups?: Array<{
      groupName?: string;
      statisticsItems?: SofaStatisticItem[];
    }>;
  }>;
};

const MAX_ENRICHMENT = 16;
const SOFA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.sofascore.com/',
  Origin: 'https://www.sofascore.com',
};

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function display(value: unknown) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function numeric(value: unknown) {
  const parsed = Number(String(value ?? '').replace('%', '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function isMajorStat(name: string) {
  const key = normalize(name);
  return [
    'corner kicks',
    'corners',
    'escanteios',
    'total shots',
    'shots on target',
    'shots off target',
    'ball possession',
    'dangerous attacks',
    'attacks',
  ].some((term) => key.includes(term));
}

function toRows(payload: SofaStatisticsResponse): LiveStatRow[] {
  const all = payload.statistics?.find((entry) => normalize(entry.period) === 'all') ?? payload.statistics?.[0];
  if (!all?.groups) return [];

  const rows: LiveStatRow[] = [];
  all.groups.forEach((group, groupIndex) => {
    group.statisticsItems?.forEach((item, itemIndex) => {
      const label = item.name?.trim();
      if (!label) return;
      const home = display(item.home);
      const away = display(item.away);
      if (home === '-' && away === '-') return;
      rows.push({
        key: `sofa:${normalize(label)}`,
        label,
        home,
        away,
        order: itemIndex,
        categoryOrder: groupIndex,
        category: group.groupName,
        isMajor: isMajorStat(label),
      });
    });
  });
  return rows;
}

function cornersFromRows(rows: LiveStatRow[]) {
  const row = rows.find((item) => {
    const key = normalize(item.label);
    return key.includes('corner kick') || key.includes('corner') || key.includes('escanteio');
  });
  if (!row) return undefined;
  const home = numeric(row.home);
  const away = numeric(row.away);
  if (home === null || away === null) return undefined;
  return { home, away, total: home + away };
}

async function fetchSofaStats(eventId: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`https://www.sofascore.com/api/v1/event/${eventId}/statistics`, {
      headers: SOFA_HEADERS,
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as SofaStatisticsResponse;
    const liveStats = toRows(payload);
    if (!liveStats.length) return null;
    return { liveStats, corners: cornersFromRows(liveStats) };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function existingDataScore(match: LiveMatch) {
  let score = match.liveStats?.length ?? 0;
  if (match.corners) score += 20;
  return score;
}

export async function GET(request: NextRequest) {
  const upstream = new URL('/api/365scores/live', request.nextUrl.origin);
  const response = await fetch(upstream, { cache: 'no-store' });
  const payload = await response.json().catch(() => ({ matches: [] }));
  if (!response.ok) return NextResponse.json(payload, { status: response.status });

  const matches: LiveMatch[] = Array.isArray(payload.matches) ? payload.matches : [];
  const enriched = [...matches];
  const candidates = enriched
    .map((match, index) => ({ match, index }))
    .filter(({ match }) => Boolean(match.sourceIds?.sofascore))
    .sort((a, b) => existingDataScore(a.match) - existingDataScore(b.match))
    .slice(0, MAX_ENRICHMENT);

  await Promise.all(
    candidates.map(async ({ match, index }) => {
      const sofaId = match.sourceIds?.sofascore;
      if (!sofaId) return;
      const stats = await fetchSofaStats(sofaId);
      if (!stats) return;
      const useSofaRows = stats.liveStats.length >= (match.liveStats?.length ?? 0);
      enriched[index] = {
        ...match,
        liveStats: useSofaRows ? stats.liveStats : match.liveStats,
        corners: stats.corners ?? match.corners,
        statsSource: useSofaRows ? 'sofascore' : match.statsSource,
      };
    })
  );

  const coverage = {
    withCorners: enriched.filter((match) => Boolean(match.corners)).length,
    withStatistics: enriched.filter((match) => (match.liveStats?.length ?? 0) > 0).length,
    total: enriched.length,
  };

  return NextResponse.json({
    ...payload,
    matches: enriched,
    count: enriched.length,
    lastUpdated: new Date().toISOString(),
    statisticsCoverage: coverage,
    enrichmentPolicy: 'sofascore-event-statistics-v1',
  });
}
