import { NextRequest, NextResponse } from 'next/server';
import { apiFootballGet } from '@/app/api/utils/apiFootball';

type LiveMatch = {
  id: number;
  minute: number | string;
  competition?: string;
  homeTeam: { name: string; score: number };
  awayTeam: { name: string; score: number };
  corners?: { home: number; away: number; total: number };
  liveStats?: Array<{ key?: string; label?: string; home?: string; away?: string }>;
  statsSource?: string;
  sourceIds?: { scores365?: number; sofascore?: number; apiFootball?: number };
};

type SofaEvent = {
  id: number;
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
};

type SofaStats = {
  statistics?: Array<{
    period?: string;
    groups?: Array<{
      statisticsItems?: Array<{ name?: string; home?: number | string | null; away?: number | string | null }>;
    }>;
  }>;
};

type ApiFootballStats = {
  statistics?: Array<{ type?: string; value?: number | string | null }>;
};

const SOFA_BASE = 'https://api.sofascore.com/api/v1';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.sofascore.com/',
};

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalTeam(value: string) {
  return normalize(value)
    .replace(/\b(football|futebol|club|clube|fc|cf|sc|ac|ec|afc|fk)\b/g, ' ')
    .replace(/\bunder\s*(\d{2})\b/g, 'u$1')
    .replace(/\bu\s+(\d{2})\b/g, 'u$1')
    .replace(/\b(women|woman|feminino|feminina|fem)\b/g, 'women')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(left: string, right: string) {
  const a = canonicalTeam(left);
  const b = canonicalTeam(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;
  const aa = new Set(a.split(' ').filter((token) => token.length > 1));
  const bb = new Set(b.split(' ').filter((token) => token.length > 1));
  const union = new Set([...aa, ...bb]);
  if (!union.size) return 0;
  let common = 0;
  for (const token of aa) if (bb.has(token)) common += 1;
  return common / union.size;
}

function resolveSofa(match: LiveMatch, events: SofaEvent[]) {
  let best: SofaEvent | undefined;
  let bestScore = 0;
  for (const event of events) {
    const score = similarity(match.homeTeam.name, event.homeTeam?.name ?? '') + similarity(match.awayTeam.name, event.awayTeam?.name ?? '');
    if (score > bestScore) {
      bestScore = score;
      best = event;
    }
  }
  return bestScore >= 1.2 ? { id: best?.id, score: Number(bestScore.toFixed(2)) } : { id: undefined, score: Number(bestScore.toFixed(2)) };
}

async function fetchJson<T>(url: string, timeoutMs = 4500): Promise<{ ok: boolean; status: number; data: T | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: HEADERS, cache: 'no-store', signal: controller.signal });
    const data = response.ok ? (await response.json()) as T : null;
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  } finally {
    clearTimeout(timer);
  }
}

function sofaRows(payload: SofaStats | null) {
  const periods = payload?.statistics ?? [];
  const selected = periods.find((item) => normalize(item.period) === 'all') ?? periods[0];
  return selected?.groups?.flatMap((group) => group.statisticsItems ?? []) ?? [];
}

function hasCorner(rows: Array<{ name?: string }>) {
  return rows.some((row) => normalize(row.name).includes('corner') || normalize(row.name).includes('escanteio'));
}

export async function GET(request: NextRequest) {
  const rawUrl = new URL('/api/365scores/live', request.nextUrl.origin);
  const rawResponse = await fetch(rawUrl, { cache: 'no-store' });
  const payload = await rawResponse.json() as { matches?: LiveMatch[] };
  const matches = Array.isArray(payload.matches) ? payload.matches : [];

  const sofaLive = await fetchJson<{ events?: SofaEvent[] }>(`${SOFA_BASE}/sport/football/events/live`, 5000);
  const sofaEvents = sofaLive.data?.events ?? [];
  const sample = matches.slice(0, 12);

  const diagnostics = await Promise.all(sample.map(async (match) => {
    const resolved = match.sourceIds?.sofascore
      ? { id: match.sourceIds.sofascore, score: 2 }
      : resolveSofa(match, sofaEvents);

    const sofa = resolved.id
      ? await fetchJson<SofaStats>(`${SOFA_BASE}/event/${resolved.id}/statistics`, 4500)
      : { ok: false, status: 0, data: null as SofaStats | null };
    const sofaStatRows = sofaRows(sofa.data);

    let apiFootball: { attempted: boolean; responseCount: number; statsCount: number; hasCorners: boolean } = {
      attempted: false,
      responseCount: 0,
      statsCount: 0,
      hasCorners: false,
    };
    if (match.sourceIds?.apiFootball) {
      const response = await apiFootballGet<ApiFootballStats[]>('/fixtures/statistics', {
        params: { fixture: match.sourceIds.apiFootball },
        cache: 'no-store',
        timeoutMs: 6000,
      });
      const teams = response?.response ?? [];
      const allStats = teams.flatMap((team) => team.statistics ?? []);
      apiFootball = {
        attempted: true,
        responseCount: teams.length,
        statsCount: allStats.length,
        hasCorners: allStats.some((stat) => normalize(stat.type).includes('corner')),
      };
    }

    return {
      id: match.id,
      fixture: `${match.homeTeam.name} x ${match.awayTeam.name}`,
      competition: match.competition,
      minute: match.minute,
      sourceIds: match.sourceIds ?? {},
      existing: {
        statsSource: match.statsSource ?? null,
        corners: match.corners ?? null,
        liveStatsCount: match.liveStats?.length ?? 0,
      },
      sofa: {
        liveFeedOk: sofaLive.ok,
        resolvedId: resolved.id ?? null,
        similarity: resolved.score,
        statsHttpStatus: sofa.status,
        statsRows: sofaStatRows.length,
        hasCorners: hasCorner(sofaStatRows),
      },
      apiFootball,
    };
  }));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    baseStatus: rawResponse.status,
    totalLiveMatches: matches.length,
    sofaLiveStatus: sofaLive.status,
    sofaLiveEvents: sofaEvents.length,
    diagnostics,
  });
}
