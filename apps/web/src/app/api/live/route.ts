import { NextRequest, NextResponse } from 'next/server';

type PeriodKey = 'firstHalf' | 'secondHalf';
type PeriodSummary = {
  totalStoppedMinutes?: number | null;
  predictedAddedMinutes?: number | null;
  actualAddedMinutes?: number | null;
  source?: string;
  kind?: string;
  incidents?: unknown[];
};
type LiveMatch = Record<string, any> & {
  id: number;
  minute: number | string;
  statusText: string;
  homeTeam: { id: number; name: string; score: number };
  awayTeam: { id: number; name: string; score: number };
  competition?: string;
  periodStoppage?: { firstHalf?: PeriodSummary; secondHalf?: PeriodSummary };
  stoppage?: { periods?: { firstHalf?: PeriodSummary; secondHalf?: PeriodSummary } };
};

const addedTimeMemory = new Map<string, { firstHalf?: number; secondHalf?: number; updatedAt: number }>();
const MAX_MEMORY_AGE_MS = 8 * 60 * 60 * 1000;

const TEAM_ALIASES: Record<string, string> = {
  brasil:'brazil', brazil:'brazil',
  espanha:'spain', spain:'spain',
  belgica:'belgium', belgium:'belgium',
  franca:'france', france:'france',
  marrocos:'morocco', morocco:'morocco',
  inglaterra:'england', england:'england',
  mexico:'mexico', méxico:'mexico',
  noruega:'norway', norway:'norway',
  portugal:'portugal',
  argentina:'argentina',
  egito:'egypt', egypt:'egypt',
  suica:'switzerland', switzerland:'switzerland',
  alemanha:'germany', germany:'germany',
  holanda:'netherlands', netherlands:'netherlands',
  colombia:'colombia', colômbia:'colombia',
  canada:'canada', canadá:'canada',
  croacia:'croatia', croácia:'croatia', croatia:'croatia',
  argelia:'algeria', argélia:'algeria', algeria:'algeria',
  australia:'australia', austrália:'australia',
  'estados unidos':'usa', eua:'usa', usa:'usa',
  'rd congo':'congo dr', 'dr congo':'congo dr', 'congo dr':'congo dr',
  'costa do marfim':'cote d ivoire', 'ivory coast':'cote d ivoire', "cote d'ivoire":'cote d ivoire',
};

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

function canonicalTeam(value: unknown) {
  const normalized = normalize(value);
  return TEAM_ALIASES[normalized] ?? normalized;
}

function competitionKey(value: unknown) {
  const normalized = normalize(value);
  if (normalized.includes('world cup') || normalized.includes('copa do mundo')) return 'world cup';
  return normalized;
}

function matchKey(match: LiveMatch) {
  const teams = [canonicalTeam(match.homeTeam?.name), canonicalTeam(match.awayTeam?.name)].sort();
  return `${competitionKey(match.competition)}__${teams.join('__vs__')}`;
}

function periodFromMatch(match: LiveMatch): PeriodKey {
  const raw = `${match.minute ?? ''} ${match.statusText ?? ''}`.toLowerCase();
  if (/2h|2nd|second|segundo/.test(raw)) return 'secondHalf';
  const base = Number(raw.match(/\d{1,3}/)?.[0]);
  return Number.isFinite(base) && base > 45 ? 'secondHalf' : 'firstHalf';
}

function addedFromClock(match: LiveMatch, period: PeriodKey) {
  const raw = `${match.minute ?? ''} ${match.statusText ?? ''}`;
  const explicit = raw.match(/(?:45|90|105|120)\s*\+\s*(\d{1,2})/);
  if (explicit) return Number(explicit[1]);

  const minute = typeof match.minute === 'number' ? match.minute : Number(String(match.minute).match(/\d{1,3}/)?.[0]);
  if (!Number.isFinite(minute)) return null;
  if (period === 'firstHalf' && minute > 45 && minute <= 60) return minute - 45;
  if (period === 'secondHalf' && minute > 90 && minute <= 120) return minute - 90;
  return null;
}

function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function mergeSummary(a?: PeriodSummary, b?: PeriodSummary): PeriodSummary | undefined {
  if (!a) return b;
  if (!b) return a;
  return {
    ...a,
    totalStoppedMinutes: positive(a.totalStoppedMinutes) ? a.totalStoppedMinutes : b.totalStoppedMinutes,
    predictedAddedMinutes: positive(a.predictedAddedMinutes) ? a.predictedAddedMinutes : b.predictedAddedMinutes,
    actualAddedMinutes: positive(a.actualAddedMinutes) ? a.actualAddedMinutes : b.actualAddedMinutes,
    source: a.source ?? b.source,
    kind: a.kind ?? b.kind,
    incidents: (a.incidents?.length ?? 0) >= (b.incidents?.length ?? 0) ? a.incidents : b.incidents,
  };
}

function periods(match: LiveMatch) {
  return match.periodStoppage ?? match.stoppage?.periods ?? {};
}

function enrichAddedTime(match: LiveMatch): LiveMatch {
  const key = matchKey(match);
  const current = periods(match);
  const period = periodFromMatch(match);
  const inferred = addedFromClock(match, period);
  const existing = current[period]?.actualAddedMinutes;
  const remembered = addedTimeMemory.get(key);
  const finalValue = positive(existing) ? existing : positive(inferred) ? inferred : remembered?.[period];

  const nextPeriods = {
    firstHalf: mergeSummary(current.firstHalf, positive(remembered?.firstHalf) ? { actualAddedMinutes: remembered?.firstHalf, source:'persistent-live-cache' } : undefined),
    secondHalf: mergeSummary(current.secondHalf, positive(remembered?.secondHalf) ? { actualAddedMinutes: remembered?.secondHalf, source:'persistent-live-cache' } : undefined),
  };

  if (positive(finalValue)) {
    nextPeriods[period] = mergeSummary(nextPeriods[period], {
      actualAddedMinutes: finalValue,
      source: positive(existing) ? current[period]?.source : 'clock-or-merged-feed',
      kind: 'announced-added-time',
    });
    addedTimeMemory.set(key, {
      firstHalf: period === 'firstHalf' ? finalValue : remembered?.firstHalf,
      secondHalf: period === 'secondHalf' ? finalValue : remembered?.secondHalf,
      updatedAt: Date.now(),
    });
  }

  return { ...match, periodStoppage: nextPeriods };
}

function sourceRank(match: LiveMatch) {
  if (match.sourceIds?.scores365 || match.source === '365scores') return 1;
  if (match.sourceIds?.sofascore || match.source === 'sofascore') return 2;
  if (match.sourceIds?.apiFootball || match.source === 'api-football') return 3;
  return 9;
}

function mergeMatch(a: LiveMatch, b: LiveMatch): LiveMatch {
  const preferred = sourceRank(a) <= sourceRank(b) ? a : b;
  const other = preferred === a ? b : a;
  const preferredPeriods = periods(preferred);
  const otherPeriods = periods(other);
  return enrichAddedTime({
    ...other,
    ...preferred,
    minute: String(other.minute ?? '').includes('+') ? other.minute : preferred.minute,
    statusText: preferred.statusText ?? other.statusText,
    corners: preferred.corners ?? other.corners,
    liveStats: preferred.liveStats ?? other.liveStats,
    statsSource: preferred.statsSource ?? other.statsSource,
    sourceIds: { ...other.sourceIds, ...preferred.sourceIds },
    periodStoppage: {
      firstHalf: mergeSummary(preferredPeriods.firstHalf, otherPeriods.firstHalf),
      secondHalf: mergeSummary(preferredPeriods.secondHalf, otherPeriods.secondHalf),
    },
  });
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
  if (!response.ok) return NextResponse.json(payload, { status: response.status });

  const merged = new Map<string, LiveMatch>();
  for (const raw of Array.isArray(payload.matches) ? payload.matches : []) {
    const match = enrichAddedTime(raw as LiveMatch);
    const key = matchKey(match);
    const existing = merged.get(key);
    merged.set(key, existing ? mergeMatch(existing, match) : match);
  }

  return NextResponse.json({
    ...payload,
    matches: [...merged.values()],
    count: merged.size,
    lastUpdated: new Date().toISOString(),
    addedTimeMerge: 'multilingual-v1',
  });
}
