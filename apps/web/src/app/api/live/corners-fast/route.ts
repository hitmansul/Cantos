import { NextRequest, NextResponse } from 'next/server';

type LiveStatRow = {
  key: string;
  label: string;
  home: string;
  away: string;
  order?: number;
  categoryOrder?: number;
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
  sourceIds?: { scores365?: number; sofascore?: number; apiFootball?: number };
  [key: string]: unknown;
};

type SofaStatsResponse = {
  statistics?: Array<{
    period?: string;
    groups?: Array<{
      groupName?: string;
      statisticsItems?: Array<{
        name?: string;
        home?: number | string | null;
        away?: number | string | null;
      }>;
    }>;
  }>;
};

type SofaIncident = {
  incidentType?: string;
  incidentClass?: string;
  isHome?: boolean;
};

type CacheEntry = {
  expiresAt: number;
  corners?: { home: number; away: number; total: number };
  liveStats?: LiveStatRow[];
  source?: string;
};

const SOFA_BASE = 'https://api.sofascore.com/api/v1';
const CACHE_TTL_MS = 25_000;
const NEGATIVE_CACHE_TTL_MS = 10_000;
const REQUEST_TIMEOUT_MS = 2_800;
const MAX_ENRICHMENT = 12;
const CONCURRENCY = 4;

const statsCache = new Map<number, CacheEntry>();

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.sofascore.com/',
};

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function numeric(value: unknown) {
  const parsed = Number(String(value ?? '').replace('%', '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toRows(payload: SofaStatsResponse): LiveStatRow[] {
  const periods = payload.statistics ?? [];
  const period = periods.find((item) => normalize(item.period) === 'all') ?? periods[0];
  if (!period?.groups) return [];

  const rows: LiveStatRow[] = [];
  period.groups.forEach((group, groupIndex) => {
    group.statisticsItems?.forEach((item, itemIndex) => {
      if (!item.name) return;
      if (item.home === null || item.home === undefined || item.away === null || item.away === undefined) return;
      const key = normalize(item.name);
      rows.push({
        key: `sofa:${key}`,
        label: item.name,
        home: String(item.home),
        away: String(item.away),
        order: itemIndex,
        categoryOrder: groupIndex,
        category: group.groupName,
        isMajor: ['corner', 'shot', 'possession', 'attack'].some((term) => key.includes(term)),
      });
    });
  });
  return rows;
}

function cornersFromRows(rows: LiveStatRow[]) {
  const row = rows.find((item) => {
    const key = normalize(item.label);
    return key.includes('corner') || key.includes('escanteio');
  });
  if (!row) return undefined;
  const home = numeric(row.home);
  const away = numeric(row.away);
  if (home === null || away === null) return undefined;
  return { home, away, total: home + away };
}

function cornersFromIncidents(incidents: SofaIncident[]) {
  let home = 0;
  let away = 0;
  let found = false;
  for (const incident of incidents) {
    const kind = normalize(`${incident.incidentType ?? ''} ${incident.incidentClass ?? ''}`);
    if (!kind.includes('corner')) continue;
    found = true;
    if (incident.isHome === true) home += 1;
    if (incident.isHome === false) away += 1;
  }
  return found ? { home, away, total: home + away } : undefined;
}

function ensureCornerRow(rows: LiveStatRow[] | undefined, corners: { home: number; away: number; total: number }) {
  const next = [...(rows ?? [])];
  const index = next.findIndex((row) => {
    const key = normalize(row.label);
    return key.includes('corner') || key.includes('escanteio');
  });
  const row: LiveStatRow = {
    key: 'derived:corner-kicks',
    label: 'Escanteios',
    home: String(corners.home),
    away: String(corners.away),
    order: 0,
    categoryOrder: 0,
    category: 'Ao vivo',
    isMajor: true,
  };
  if (index >= 0) next[index] = row;
  else next.unshift(row);
  return next;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: HEADERS, cache: 'no-store', signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function enrichEvent(eventId: number): Promise<CacheEntry> {
  const cached = statsCache.get(eventId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const [statistics, incidentsPayload] = await Promise.all([
    fetchJson<SofaStatsResponse>(`${SOFA_BASE}/event/${eventId}/statistics`),
    fetchJson<{ incidents?: SofaIncident[] }>(`${SOFA_BASE}/event/${eventId}/incidents`),
  ]);

  const rows = statistics ? toRows(statistics) : [];
  const statisticsCorners = cornersFromRows(rows);
  const incidentCorners = cornersFromIncidents(incidentsPayload?.incidents ?? []);
  const corners = statisticsCorners ?? incidentCorners;
  const entry: CacheEntry = {
    expiresAt: Date.now() + (corners || rows.length ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
    corners,
    liveStats: rows.length ? (corners ? ensureCornerRow(rows, corners) : rows) : corners ? ensureCornerRow(undefined, corners) : undefined,
    source: statisticsCorners ? 'sofascore' : incidentCorners ? 'sofascore-incidents' : undefined,
  };
  statsCache.set(eventId, entry);
  return entry;
}

async function mapWithConcurrency<T, R>(items: T[], worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => run()));
  return results;
}

export async function GET(request: NextRequest) {
  const requestedEventId = Number(request.nextUrl.searchParams.get('eventId') ?? '0');
  const requestedHome = request.nextUrl.searchParams.get('home') ?? '';
  const requestedAway = request.nextUrl.searchParams.get('away') ?? '';
  const rawUrl = new URL('/api/365scores/live', request.nextUrl.origin);
  rawUrl.searchParams.set('raw', '1');

  let payload: Record<string, unknown> & { matches?: LiveMatch[] };
  try {
    const rawResponse = await fetch(rawUrl, { cache: 'no-store' });
    payload = (await rawResponse.json()) as Record<string, unknown> & { matches?: LiveMatch[] };
    if (!rawResponse.ok) return NextResponse.json(payload, { status: rawResponse.status });
  } catch {
    return NextResponse.json({ matches: [], error: 'Erro ao carregar jogos ao vivo' }, { status: 502 });
  }

  const matches = Array.isArray(payload.matches) ? payload.matches : [];
  const candidates = matches
    .map((match, index) => ({ match, index, eventId: match.sourceIds?.sofascore }))
    .filter((item): item is { match: LiveMatch; index: number; eventId: number } => Boolean(item.eventId))
    .sort((a, b) => {
      if (requestedEventId > 0) {
        if (a.eventId === requestedEventId) return -1;
        if (b.eventId === requestedEventId) return 1;
      }
      const aHas = a.match.corners ? 1 : 0;
      const bHas = b.match.corners ? 1 : 0;
      return aHas - bHas;
    })
    .slice(0, requestedEventId > 0 ? 1 : MAX_ENRICHMENT);

  const enriched = [...matches];
  const results = await mapWithConcurrency(candidates, async (candidate) => ({
    candidate,
    stats: await enrichEvent(candidate.eventId),
  }));

  for (const { candidate, stats } of results) {
    if (!stats.corners && !stats.liveStats?.length) continue;
    const current = enriched[candidate.index];
    enriched[candidate.index] = {
      ...current,
      corners: stats.corners ?? current.corners,
      liveStats: stats.liveStats?.length ? stats.liveStats : current.liveStats,
      statsSource: stats.source ?? current.statsSource,
    };
  }

  return NextResponse.json({
    ...payload,
    matches: enriched,
    count: enriched.length,
    lastUpdated: new Date().toISOString(),
    cornerCoverage: {
      total: enriched.length,
      withCorners: enriched.filter((match) => Boolean(match.corners)).length,
      attempted: candidates.length,
    },
    enrichmentPolicy: 'fast-cached-sofascore-v1',
  });
}
