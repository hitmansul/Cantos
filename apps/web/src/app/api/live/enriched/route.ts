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

type SofaLiveEvent = {
  id: number;
  homeTeam?: { id?: number; name?: string };
  awayTeam?: { id?: number; name?: string };
  tournament?: { name?: string; uniqueTournament?: { name?: string } };
};

type EnrichmentStatus =
  | 'enriched'
  | 'kept-existing'
  | 'no-sofa-match'
  | 'no-statistics'
  | 'source-error';

type Diagnostic = {
  match: string;
  sofaEventId?: number;
  status: EnrichmentStatus;
  reason: string;
};

const SOFA_BASE = 'https://api.sofascore.com/api/v1';
const FETCH_TIMEOUT_MS = 7_000;
const MAX_CONCURRENCY = 8;
const SOFA_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.sofascore.com/',
  Origin: 'https://www.sofascore.com',
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
    .replace(/\b(u19|u20|u21|u23|reserves?|reserve|women|feminino|feminina)\b/g, ' $1 ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token && !TEAM_STOP_WORDS.has(token))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: unknown) {
  return new Set(normalize(value).split(' ').filter(Boolean));
}

function similarity(left: unknown, right: unknown) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;

  const ta = tokens(a);
  const tb = tokens(b);
  const intersection = [...ta].filter((token) => tb.has(token)).length;
  const union = new Set([...ta, ...tb]).size;
  return union ? intersection / union : 0;
}

function pairScore(match: LiveMatch, event: SofaLiveEvent) {
  const direct =
    similarity(match.homeTeam.name, event.homeTeam?.name) +
    similarity(match.awayTeam.name, event.awayTeam?.name);
  const reversed =
    similarity(match.homeTeam.name, event.awayTeam?.name) +
    similarity(match.awayTeam.name, event.homeTeam?.name);
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

function isMajorStat(name: string) {
  const key = normalize(name);
  return [
    'corner kicks', 'corners', 'escanteios', 'total shots', 'shots on target',
    'shots off target', 'ball possession', 'dangerous attacks', 'attacks',
  ].some((term) => key.includes(normalize(term)));
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

async function fetchJson<T>(url: string): Promise<{ ok: boolean; data?: T; status?: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: SOFA_HEADERS,
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, data: (await response.json()) as T, status: response.status };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSofaLiveEvents() {
  const result = await fetchJson<{ events?: SofaLiveEvent[] }>(
    `${SOFA_BASE}/sport/football/events/live`
  );
  return result.ok ? result.data?.events ?? [] : [];
}

async function fetchSofaStats(eventId: number) {
  const result = await fetchJson<SofaStatisticsResponse>(
    `${SOFA_BASE}/event/${eventId}/statistics`
  );
  if (!result.ok) return { status: 'source-error' as const, reason: `SofaScore HTTP ${result.status ?? 'timeout'}` };
  const liveStats = toRows(result.data ?? {});
  if (!liveStats.length) return { status: 'no-statistics' as const, reason: 'O evento não possui estatísticas detalhadas disponíveis.' };
  return {
    status: 'enriched' as const,
    reason: 'Estatísticas detalhadas recebidas do SofaScore.',
    liveStats,
    corners: cornersFromRows(liveStats),
  };
}

function existingDataScore(match: LiveMatch) {
  let score = match.liveStats?.length ?? 0;
  if (match.corners) score += 20;
  return score;
}

function findSofaEvent(match: LiveMatch, events: SofaLiveEvent[]) {
  const explicitId = match.sourceIds?.sofascore;
  if (explicitId) {
    const explicit = events.find((event) => event.id === explicitId);
    if (explicit) return { event: explicit, score: 2, method: 'id' };
  }

  let best: SofaLiveEvent | undefined;
  let bestScore = 0;
  for (const event of events) {
    const score = pairScore(match, event);
    if (score > bestScore) {
      best = event;
      bestScore = score;
    }
  }

  return best && bestScore >= 1.35
    ? { event: best, score: bestScore, method: 'teams' }
    : null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
) {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
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
      diagnostics.push({
        match: label,
        status: 'no-sofa-match',
        reason: 'Nenhum evento correspondente foi localizado na lista ao vivo do SofaScore.',
      });
      return match;
    }

    const stats = await fetchSofaStats(matched.event.id);
    if (stats.status !== 'enriched') {
      diagnostics.push({
        match: label,
        sofaEventId: matched.event.id,
        status: stats.status,
        reason: stats.reason,
      });
      return match;
    }

    const useSofaRows = stats.liveStats.length >= (match.liveStats?.length ?? 0);
    const next: LiveMatch = {
      ...match,
      sourceIds: { ...match.sourceIds, sofascore: matched.event.id },
      liveStats: useSofaRows ? stats.liveStats : match.liveStats,
      corners: stats.corners ?? match.corners,
      statsSource: useSofaRows ? 'sofascore' : match.statsSource,
    };

    diagnostics.push({
      match: label,
      sofaEventId: matched.event.id,
      status: existingDataScore(next) > existingDataScore(match) ? 'enriched' : 'kept-existing',
      reason: `${stats.reason} Correspondência por ${matched.method === 'id' ? 'ID' : 'nomes das equipes'}.`,
    });
    return next;
  });

  const coverage = {
    withCorners: enriched.filter((match) => Boolean(match.corners)).length,
    withStatistics: enriched.filter((match) => (match.liveStats?.length ?? 0) > 0).length,
    total: enriched.length,
    sofaLiveEvents: sofaEvents.length,
    enriched: diagnostics.filter((item) => item.status === 'enriched').length,
    noSofaMatch: diagnostics.filter((item) => item.status === 'no-sofa-match').length,
    noStatistics: diagnostics.filter((item) => item.status === 'no-statistics').length,
    sourceErrors: diagnostics.filter((item) => item.status === 'source-error').length,
  };

  return NextResponse.json({
    ...payload,
    matches: enriched,
    count: enriched.length,
    lastUpdated: new Date().toISOString(),
    statisticsCoverage: coverage,
    enrichmentDiagnostics: diagnostics,
    enrichmentPolicy: 'sofascore-live-match-and-event-statistics-v2',
  });
}
