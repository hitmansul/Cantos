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

type SofaStatisticItem = { name?: string; home?: string | number | null; away?: string | number | null };
type SofaStatisticsResponse = {
  statistics?: Array<{
    period?: string;
    groups?: Array<{ groupName?: string; statisticsItems?: SofaStatisticItem[] }>;
  }>;
};

type SofaLiveEvent = {
  id: number;
  homeTeam?: { id?: number; name?: string };
  awayTeam?: { id?: number; name?: string };
};

type SofaIncident = {
  incidentType?: string;
  incidentClass?: string;
  isHome?: boolean;
  homeScore?: number;
  awayScore?: number;
};

type Diagnostic = {
  match: string;
  sofaEventId?: number;
  matchedBy?: 'id' | 'teams';
  statisticsStatus: 'received' | 'empty' | 'error' | 'not-matched';
  incidentsStatus: 'received' | 'empty' | 'error' | 'not-requested';
  cornersSource?: 'statistics' | 'incidents' | 'existing';
  reason: string;
};

const SOFA_BASE = 'https://api.sofascore.com/api/v1';
const FETCH_TIMEOUT_MS = 8_000;
const MAX_CONCURRENCY = 6;
const SOFA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.sofascore.com/',
};

const TEAM_STOP_WORDS = new Set([
  'fc', 'cf', 'sc', 'ac', 'ec', 'club', 'clube', 'futebol', 'football', 'sport',
  'sporting', 'real', 'atletico', 'athletic', 'de', 'da', 'do', 'the',
]);

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token && !TEAM_STOP_WORDS.has(token))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(left: unknown, right: unknown) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const ta = new Set(a.split(' '));
  const tb = new Set(b.split(' '));
  const intersection = [...ta].filter((token) => tb.has(token)).length;
  const union = new Set([...ta, ...tb]).size;
  return union ? intersection / union : 0;
}

function pairScore(match: LiveMatch, event: SofaLiveEvent) {
  const direct = similarity(match.homeTeam.name, event.homeTeam?.name) + similarity(match.awayTeam.name, event.awayTeam?.name);
  const reversed = similarity(match.homeTeam.name, event.awayTeam?.name) + similarity(match.awayTeam.name, event.homeTeam?.name);
  return Math.max(direct, reversed * 0.72);
}

function display(value: unknown) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function numeric(value: unknown) {
  const parsed = Number(String(value ?? '').replace('%', '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toRows(payload: SofaStatisticsResponse): LiveStatRow[] {
  const periods = payload.statistics ?? [];
  const all = periods.find((entry) => normalize(entry.period) === 'all') ?? periods[0];
  if (!all?.groups) return [];
  const rows: LiveStatRow[] = [];
  all.groups.forEach((group, groupIndex) => {
    group.statisticsItems?.forEach((item, itemIndex) => {
      const label = item.name?.trim();
      if (!label) return;
      const home = display(item.home);
      const away = display(item.away);
      if (home === '-' && away === '-') return;
      const key = normalize(label);
      rows.push({
        key: `sofa:${key}`,
        label,
        home,
        away,
        order: itemIndex,
        categoryOrder: groupIndex,
        category: group.groupName,
        isMajor: ['corner', 'escanteio', 'shot', 'chute', 'possession', 'posse', 'attack', 'ataque'].some((term) => key.includes(term)),
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
    const type = normalize(`${incident.incidentType ?? ''} ${incident.incidentClass ?? ''}`);
    if (!type.includes('corner')) continue;
    found = true;
    if (incident.isHome === true) home += 1;
    else if (incident.isHome === false) away += 1;
  }
  return found ? { home, away, total: home + away } : undefined;
}

function mergeCornerRow(rows: LiveStatRow[] | undefined, corners: { home: number; away: number; total: number }) {
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
    category: 'Incidentes ao vivo',
    isMajor: true,
  };
  if (index >= 0) next[index] = row;
  else next.unshift(row);
  return next;
}

async function fetchJson<T>(url: string): Promise<{ ok: boolean; data?: T; status?: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: SOFA_HEADERS, cache: 'no-store', signal: controller.signal });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, data: (await response.json()) as T, status: response.status };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSofaLiveEvents() {
  const result = await fetchJson<{ events?: SofaLiveEvent[] }>(`${SOFA_BASE}/sport/football/events/live`);
  return result.ok ? result.data?.events ?? [] : [];
}

function findSofaEvent(match: LiveMatch, events: SofaLiveEvent[]) {
  const explicitId = match.sourceIds?.sofascore;
  if (explicitId) {
    const explicit = events.find((event) => event.id === explicitId);
    if (explicit) return { event: explicit, method: 'id' as const };
  }
  let best: SofaLiveEvent | undefined;
  let bestScore = 0;
  for (const event of events) {
    const score = pairScore(match, event);
    if (score > bestScore) { best = event; bestScore = score; }
  }
  return best && bestScore >= 1.25 ? { event: best, method: 'teams' as const } : null;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

export async function GET(request: NextRequest) {
  const upstream = new URL('/api/365scores/live', request.nextUrl.origin);
  const response = await fetch(upstream, { cache: 'no-store' });
  const payload = await response.json().catch(() => ({ matches: [] }));
  if (!response.ok) return NextResponse.json(payload, { status: response.status });

  const matches: LiveMatch[] = Array.isArray(payload.matches) ? payload.matches : [];
  const sofaEvents = await fetchSofaLiveEvents();
  const diagnostics: Diagnostic[] = [];

  const enriched = await mapWithConcurrency(matches, MAX_CONCURRENCY, async (match) => {
    const label = `${match.homeTeam.name} x ${match.awayTeam.name}`;
    const matched = findSofaEvent(match, sofaEvents);
    if (!matched) {
      diagnostics.push({ match: label, statisticsStatus: 'not-matched', incidentsStatus: 'not-requested', cornersSource: match.corners ? 'existing' : undefined, reason: 'Partida não relacionada ao evento do SofaScore.' });
      return match;
    }

    const eventId = matched.event.id;
    const [statsResult, incidentsResult] = await Promise.all([
      fetchJson<SofaStatisticsResponse>(`${SOFA_BASE}/event/${eventId}/statistics`),
      fetchJson<{ incidents?: SofaIncident[] }>(`${SOFA_BASE}/event/${eventId}/incidents`),
    ]);

    const rows = statsResult.ok ? toRows(statsResult.data ?? {}) : [];
    const statisticsCorners = cornersFromRows(rows);
    const incidents = incidentsResult.ok ? incidentsResult.data?.incidents ?? [] : [];
    const incidentCorners = cornersFromIncidents(incidents);
    const corners = statisticsCorners ?? incidentCorners ?? match.corners;
    const liveStats = corners && !statisticsCorners ? mergeCornerRow(rows.length ? rows : match.liveStats, corners) : (rows.length ? rows : match.liveStats);
    const source = statisticsCorners ? 'statistics' : incidentCorners ? 'incidents' : match.corners ? 'existing' : undefined;

    diagnostics.push({
      match: label,
      sofaEventId: eventId,
      matchedBy: matched.method,
      statisticsStatus: statsResult.ok ? (rows.length ? 'received' : 'empty') : 'error',
      incidentsStatus: incidentsResult.ok ? (incidents.length ? 'received' : 'empty') : 'error',
      cornersSource: source,
      reason: source ? `Escanteios obtidos por ${source}.` : 'Nenhuma das fontes retornou escanteios para este evento.',
    });

    return {
      ...match,
      sourceIds: { ...match.sourceIds, sofascore: eventId },
      corners,
      liveStats,
      statsSource: rows.length ? 'sofascore-statistics' : incidentCorners ? 'sofascore-incidents' : match.statsSource,
    };
  });

  const coverage = {
    total: enriched.length,
    withCorners: enriched.filter((match) => Boolean(match.corners)).length,
    withStatistics: enriched.filter((match) => (match.liveStats?.length ?? 0) > 0).length,
    sofaLiveEvents: sofaEvents.length,
    cornersFromStatistics: diagnostics.filter((item) => item.cornersSource === 'statistics').length,
    cornersFromIncidents: diagnostics.filter((item) => item.cornersSource === 'incidents').length,
    unmatched: diagnostics.filter((item) => item.statisticsStatus === 'not-matched').length,
  };

  return NextResponse.json({
    ...payload,
    matches: enriched,
    count: enriched.length,
    lastUpdated: new Date().toISOString(),
    statisticsCoverage: coverage,
    enrichmentDiagnostics: diagnostics,
    enrichmentPolicy: 'sofascore-statistics-plus-incidents-v3',
  });
}
