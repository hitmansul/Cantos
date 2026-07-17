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

const addedTimeMemory = new Map<string, CacheEntry>();
const MAX_MEMORY_AGE_MS = 12 * 60 * 60 * 1000;

function normalize(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|ec|club|clube|futebol|sport|sporting|real|atletico)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function competitionKey(value: unknown) {
  const key = normalize(value);
  if (key.includes('serie a') && (key.includes('brazil') || key.includes('brasil'))) {
    return 'serie a brazil';
  }
  return key;
}

function matchKey(match: LiveMatch) {
  const teams = [normalize(match.homeTeam?.name), normalize(match.awayTeam?.name)].sort();
  return `${competitionKey(match.competition)}__${teams.join('__vs__')}`;
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

function persistVerifiedAddedTime(match: LiveMatch): LiveMatch {
  const key = matchKey(match);
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
  const matches = rawMatches.map(persistVerifiedAddedTime);

  return NextResponse.json({
    ...payload,
    matches,
    count: matches.length,
    lastUpdated: new Date().toISOString(),
    addedTimePolicy: 'referee-announced-only-v1',
  });
}
