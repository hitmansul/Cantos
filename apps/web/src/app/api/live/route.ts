import { NextRequest, NextResponse } from 'next/server';

type PeriodKey = 'firstHalf' | 'secondHalf';

type PeriodSummary = {
  totalStoppedMs?: number | null;
  totalStoppedMinutes?: number | null;
  predictedAddedMs?: number | null;
  predictedAddedMinutes?: number | null;
  actualAddedMinutes?: number | null;
  source?: string;
  kind?: string;
  incidents?: Array<Record<string, unknown>>;
};

type LiveMatch = Record<string, unknown> & {
  id: number;
  minute: number | string;
  statusText?: string;
  competition?: string;
  homeTeam: { id: number; name: string; score: number };
  awayTeam: { id: number; name: string; score: number };
  sourceIds?: { scores365?: number; sofascore?: number; apiFootball?: number };
  periodStoppage?: Partial<Record<PeriodKey, PeriodSummary>>;
  stoppage?: {
    periods?: Partial<Record<PeriodKey, PeriodSummary>>;
    [key: string]: unknown;
  };
};

type CacheEntry = {
  firstHalf?: number;
  secondHalf?: number;
  updatedAt: number;
};

type Scores365Game = {
  id: number;
  sportId?: number;
  statusGroup?: number;
  statusText?: string;
  gameTime?: number;
  preciseGameTime?: string;
  gameTimeDisplay?: string;
  homeCompetitor?: { name?: string; sportId?: number };
  awayCompetitor?: { name?: string; sportId?: number };
};

type Scores365ActualPlayTime = {
  title?: string;
  actualTime?: { name?: string };
  totalTime?: { name?: string };
};

const addedTimeMemory = new Map<string, CacheEntry>();
const MAX_MEMORY_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_365_DETAIL_ENRICHMENT = 16;
const DETAIL_TIMEOUT_MS = 5_000;
const MIN_STOPPAGE_MS = 15_000;

const SCORES365_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  Referer: 'https://www.365scores.com/pt-br',
  Origin: 'https://www.365scores.com',
};

const TEAM_ALIASES: Record<string, string> = {
  'red bull bragantino': 'bragantino',
  'rb bragantino': 'bragantino',
  'bragantino red bull': 'bragantino',
  'athletico paranaense': 'athletico pr',
  'atletico paranaense': 'athletico pr',
  'atletico mineiro': 'atletico mg',
  'america mineiro': 'america mg',
};

function normalize(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|ec|club|clube|futebol|sport|sporting|real)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalTeam(value: unknown) {
  const normalized = normalize(value);
  return TEAM_ALIASES[normalized] ?? normalized;
}

function competitionKey(value: unknown) {
  const key = normalize(value);
  if (key.includes('serie a') && (key.includes('brazil') || key.includes('brasil'))) {
    return 'serie a brazil';
  }
  return key;
}

function matchKey(match: Pick<LiveMatch, 'homeTeam' | 'awayTeam'>) {
  const teams = [canonicalTeam(match.homeTeam?.name), canonicalTeam(match.awayTeam?.name)].sort();
  return teams.join('__vs__');
}

function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isVerifiedSource(source?: string, kind?: string) {
  if (kind !== 'announced-added-time') return false;
  if (!source) return false;
  return !['clock-or-merged-feed', 'persistent-live-cache', 'clock-inference'].includes(source);
}

function mergeSummary(base?: PeriodSummary, incoming?: PeriodSummary): PeriodSummary | undefined {
  if (!base) return incoming;
  if (!incoming) return base;
  return {
    ...base,
    totalStoppedMs: positive(base.totalStoppedMs) ? base.totalStoppedMs : incoming.totalStoppedMs,
    totalStoppedMinutes: positive(base.totalStoppedMinutes)
      ? base.totalStoppedMinutes
      : incoming.totalStoppedMinutes,
    predictedAddedMs: positive(base.predictedAddedMs) ? base.predictedAddedMs : incoming.predictedAddedMs,
    predictedAddedMinutes: positive(base.predictedAddedMinutes)
      ? base.predictedAddedMinutes
      : incoming.predictedAddedMinutes,
    actualAddedMinutes: positive(base.actualAddedMinutes)
      ? base.actualAddedMinutes
      : incoming.actualAddedMinutes,
    source: base.source ?? incoming.source,
    kind: base.kind ?? incoming.kind,
    incidents:
      (incoming.incidents?.length ?? 0) > (base.incidents?.length ?? 0)
        ? incoming.incidents
        : base.incidents,
  };
}

function periodsFrom(match: LiveMatch) {
  return match.periodStoppage ?? match.stoppage?.periods ?? {};
}

function periodFromMatch(match: LiveMatch): PeriodKey {
  const raw = normalize(`${match.minute ?? ''} ${match.statusText ?? ''}`);
  if (/\b(2h|2nd|second|segundo)\b/.test(raw)) return 'secondHalf';
  if (/\b(1h|1st|first|primeiro|ht|intervalo)\b/.test(raw)) return 'firstHalf';
  const numeric = Number(String(match.minute ?? '').match(/\d{1,3}/)?.[0]);
  return Number.isFinite(numeric) && numeric > 45 ? 'secondHalf' : 'firstHalf';
}

function parseClockMs(value?: string) {
  if (!value) return null;
  const match = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = match[3] ? Number(match[3]) : null;
  if (!Number.isFinite(first) || !Number.isFinite(second) || (third !== null && !Number.isFinite(third))) {
    return null;
  }
  const hours = third === null ? 0 : first;
  const minutes = third === null ? first : second;
  const seconds = third === null ? second : third;
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

function roundedMinutes(ms: number) {
  return Math.round((ms / 60_000) * 10) / 10;
}

function calculatedSummary(actualPlayTime?: Scores365ActualPlayTime): PeriodSummary | undefined {
  const played = parseClockMs(actualPlayTime?.actualTime?.name ?? actualPlayTime?.title);
  const elapsed = parseClockMs(actualPlayTime?.totalTime?.name);
  if (played === null || elapsed === null || elapsed <= played) return undefined;
  const stopped = elapsed - played;
  if (stopped < MIN_STOPPAGE_MS) return undefined;
  const predicted = Math.round(stopped * 0.8);
  return {
    totalStoppedMs: stopped,
    totalStoppedMinutes: roundedMinutes(stopped),
    predictedAddedMs: predicted,
    predictedAddedMinutes: roundedMinutes(predicted),
    actualAddedMinutes: null,
    source: '365scores-actual-play-time',
    kind: 'calculated-stoppage',
    incidents: [],
  };
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DETAIL_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: SCORES365_HEADERS,
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchScores365LiveIndex() {
  try {
    const response = await fetchWithTimeout(
      'https://webws.365scores.com/web/games/?appTypeId=5&langId=31&statuses=2'
    );
    if (!response.ok) return new Map<string, Scores365Game>();
    const payload = (await response.json()) as { games?: Scores365Game[] };
    const index = new Map<string, Scores365Game>();
    for (const game of payload.games ?? []) {
      const isFootball = game.sportId === 1 || game.homeCompetitor?.sportId === 1;
      if (!isFootball || !game.homeCompetitor?.name || !game.awayCompetitor?.name) continue;
      const key = [canonicalTeam(game.homeCompetitor.name), canonicalTeam(game.awayCompetitor.name)]
        .sort()
        .join('__vs__');
      index.set(key, game);
    }
    return index;
  } catch (error) {
    console.warn('[api/live] 365Scores live index failed:', error);
    return new Map<string, Scores365Game>();
  }
}

async function enrichCalculatedStoppage(matches: LiveMatch[]) {
  const index = await fetchScores365LiveIndex();
  if (index.size === 0) return matches;

  const enriched = [...matches];
  const candidates = enriched
    .map((match, matchIndex) => ({ match, matchIndex, game: index.get(matchKey(match)) }))
    .filter(({ match, game }) => {
      if (!game) return false;
      const current = periodsFrom(match)[periodFromMatch(match)];
      return !positive(current?.totalStoppedMinutes) && !positive(current?.predictedAddedMinutes);
    })
    .slice(0, MAX_365_DETAIL_ENRICHMENT);

  await Promise.all(
    candidates.map(async ({ match, matchIndex, game }) => {
      if (!game) return;
      try {
        const response = await fetchWithTimeout(
          `https://webws.365scores.com/web/game/?appTypeId=5&langId=31&gameId=${game.id}`
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          game?: { actualPlayTime?: Scores365ActualPlayTime };
        };
        const summary = calculatedSummary(payload.game?.actualPlayTime);
        if (!summary) return;

        const period = periodFromMatch(match);
        const periods = periodsFrom(match);
        const nextPeriods: Partial<Record<PeriodKey, PeriodSummary>> = {
          ...periods,
          [period]: mergeSummary(periods[period], summary),
        };

        enriched[matchIndex] = {
          ...match,
          sourceIds: { ...match.sourceIds, scores365: game.id },
          periodStoppage: nextPeriods,
          stoppage: {
            ...(match.stoppage ?? {}),
            totalStoppedMs: summary.totalStoppedMs,
            totalStoppedMinutes: summary.totalStoppedMinutes,
            predictedAddedMs: summary.predictedAddedMs,
            predictedAddedMinutes: summary.predictedAddedMinutes,
            source: summary.source,
            kind: summary.kind,
            periods: nextPeriods,
          },
        };
      } catch (error) {
        console.warn('[api/live] 365Scores detail enrichment failed:', game.id, error);
      }
    })
  );

  return enriched;
}

function persistVerifiedAddedTime(match: LiveMatch): LiveMatch {
  const key = `${competitionKey(match.competition)}__${matchKey(match)}`;
  const remembered = addedTimeMemory.get(key);
  const current = periodsFrom(match);

  const next: Partial<Record<PeriodKey, PeriodSummary>> = {
    firstHalf: current.firstHalf,
    secondHalf: current.secondHalf,
  };

  (['firstHalf', 'secondHalf'] as const).forEach((period) => {
    const summary = current[period];
    const verified =
      positive(summary?.actualAddedMinutes) && isVerifiedSource(summary?.source, summary?.kind)
        ? summary.actualAddedMinutes
        : undefined;

    if (positive(verified)) {
      const previous = addedTimeMemory.get(key) ?? { updatedAt: Date.now() };
      addedTimeMemory.set(key, { ...previous, [period]: verified, updatedAt: Date.now() });
      next[period] = summary;
      return;
    }

    const cached = remembered?.[period];
    if (positive(cached)) {
      next[period] = mergeSummary(summary, {
        actualAddedMinutes: cached,
        source: 'verified-live-cache',
        kind: 'announced-added-time',
        incidents: [],
      });
      return;
    }

    if (summary && (!isVerifiedSource(summary.source, summary.kind) || !positive(summary.actualAddedMinutes))) {
      next[period] = { ...summary, actualAddedMinutes: null };
    }
  });

  return {
    ...match,
    periodStoppage: next,
    stoppage: match.stoppage ? { ...match.stoppage, periods: next } : match.stoppage,
  };
}

function cleanupMemory() {
  const cutoff = Date.now() - MAX_MEMORY_AGE_MS;
  for (const [key, value] of addedTimeMemory.entries()) {
    if (value.updatedAt < cutoff) addedTimeMemory.delete(key);
  }
}

export async function GET(request: NextRequest) {
  cleanupMemory();

  const upstream = new URL('/api/365scores/live', request.nextUrl.origin);
  const response = await fetch(upstream, { cache: 'no-store' });
  const payload = await response.json().catch(() => ({ matches: [] }));

  if (!response.ok) {
    return NextResponse.json(payload, { status: response.status });
  }

  const rawMatches = Array.isArray(payload.matches) ? (payload.matches as LiveMatch[]) : [];
  const enrichedMatches = await enrichCalculatedStoppage(rawMatches);
  const matches = enrichedMatches.map(persistVerifiedAddedTime);

  return NextResponse.json({
    ...payload,
    matches,
    count: matches.length,
    lastUpdated: new Date().toISOString(),
    addedTimePolicy: 'referee-announced-only-v2',
    calculatedStoppageFallback: 'scores365-detail-by-team-match-v1',
  });
}
