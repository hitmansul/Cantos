import { NextRequest, NextResponse } from 'next/server';

type LiveStatRow = {
  key: string;
  label: string;
  home: string;
  away: string;
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
  stoppage?: {
    totalStoppedMinutes?: number;
    predictedAddedMinutes?: number;
    incidents?: unknown[];
  };
  periodStoppage?: unknown;
  sourceIds?: { scores365?: number; sofascore?: number; apiFootball?: number };
  [key: string]: unknown;
};

type NumericPair = { home: number | null; away: number | null; total: number | null };

type Snapshot = {
  capturedAt: string;
  minute: number | string;
  minuteNumber: number | null;
  homeScore: number;
  awayScore: number;
  corners: NumericPair;
  shots: NumericPair;
  shotsOnTarget: NumericPair;
  dangerousAttacks: NumericPair;
  attacks: NumericPair;
  possession: NumericPair;
  totalStoppedMinutes: number | null;
  predictedAddedMinutes: number | null;
  stoppageIncidents: number;
  statsCount: number;
};

type Trend = {
  windowMinutes: number;
  samples: number;
  cornersDelta: NumericPair;
  shotsDelta: NumericPair;
  shotsOnTargetDelta: NumericPair;
  dangerousAttacksDelta: NumericPair;
  scoreDelta: NumericPair;
  pace: 'accelerating' | 'stable' | 'cooling' | 'insufficient-data';
  lastChangeAt: string | null;
};

type EngineState = {
  matches: LiveMatch[];
  history: Record<string, Snapshot[]>;
  updatedAt: string | null;
  refreshInFlight: Promise<void> | null;
  coverage?: Record<string, unknown>;
};

const globalStore = globalThis as typeof globalThis & { __cornerGptLiveEngine?: EngineState };
const state: EngineState = globalStore.__cornerGptLiveEngine ?? {
  matches: [],
  history: {},
  updatedAt: null,
  refreshInFlight: null,
};
globalStore.__cornerGptLiveEngine = state;

const HISTORY_LIMIT = 360;
const MAX_STALE_MS = 35_000;
const TREND_WINDOW_MINUTES = 10;

function eventKey(match: LiveMatch) {
  return String(
    match.sourceIds?.sofascore ??
      match.sourceIds?.apiFootball ??
      match.sourceIds?.scores365 ??
      match.id
  );
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const normalized = String(value).replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function minuteNumber(value: number | string) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const match = String(value).match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/);
  if (!match) return null;
  return Number(match[1]) + Number(match[2] ?? 0);
}

function statPair(match: LiveMatch, aliases: string[]): NumericPair {
  const rows = match.liveStats ?? [];
  const row = rows.find((item) => {
    const haystack = normalize(`${item.key} ${item.label}`);
    return aliases.some((alias) => haystack.includes(alias));
  });
  const home = parseNumber(row?.home);
  const away = parseNumber(row?.away);
  return {
    home,
    away,
    total: home !== null && away !== null ? home + away : null,
  };
}

function pair(home: number | null, away: number | null): NumericPair {
  return { home, away, total: home !== null && away !== null ? home + away : null };
}

function createSnapshot(match: LiveMatch, capturedAt: string): Snapshot {
  return {
    capturedAt,
    minute: match.minute,
    minuteNumber: minuteNumber(match.minute),
    homeScore: match.homeTeam.score,
    awayScore: match.awayTeam.score,
    corners: match.corners
      ? pair(match.corners.home, match.corners.away)
      : statPair(match, ['corner', 'escanteio']),
    shots: statPair(match, ['total shots', 'shots total', 'chutes totais', 'finalizacoes']),
    shotsOnTarget: statPair(match, ['shots on target', 'on target', 'chutes no gol', 'finalizacoes certas']),
    dangerousAttacks: statPair(match, ['dangerous attacks', 'ataques perigosos']),
    attacks: statPair(match, ['total attacks', 'attacks', 'ataques']),
    possession: statPair(match, ['ball possession', 'possession', 'posse de bola']),
    totalStoppedMinutes: parseNumber(match.stoppage?.totalStoppedMinutes),
    predictedAddedMinutes: parseNumber(match.stoppage?.predictedAddedMinutes),
    stoppageIncidents: Array.isArray(match.stoppage?.incidents) ? match.stoppage.incidents.length : 0,
    statsCount: match.liveStats?.length ?? 0,
  };
}

function pairChanged(a: NumericPair, b: NumericPair) {
  return a.home !== b.home || a.away !== b.away || a.total !== b.total;
}

function snapshotChanged(previous: Snapshot | undefined, current: Snapshot) {
  if (!previous) return true;
  return (
    previous.minute !== current.minute ||
    previous.homeScore !== current.homeScore ||
    previous.awayScore !== current.awayScore ||
    pairChanged(previous.corners, current.corners) ||
    pairChanged(previous.shots, current.shots) ||
    pairChanged(previous.shotsOnTarget, current.shotsOnTarget) ||
    pairChanged(previous.dangerousAttacks, current.dangerousAttacks) ||
    previous.totalStoppedMinutes !== current.totalStoppedMinutes ||
    previous.predictedAddedMinutes !== current.predictedAddedMinutes ||
    previous.stoppageIncidents !== current.stoppageIncidents ||
    previous.statsCount !== current.statsCount
  );
}

function appendHistory(matches: LiveMatch[]) {
  const capturedAt = new Date().toISOString();
  for (const match of matches) {
    const key = eventKey(match);
    const history = state.history[key] ?? [];
    const snapshot = createSnapshot(match, capturedAt);
    if (snapshotChanged(history.at(-1), snapshot)) {
      state.history[key] = [...history, snapshot].slice(-HISTORY_LIMIT);
    }
  }
}

function deltaPair(current: NumericPair, previous: NumericPair): NumericPair {
  const difference = (a: number | null, b: number | null) =>
    a !== null && b !== null ? a - b : null;
  return pair(difference(current.home, previous.home), difference(current.away, previous.away));
}

function buildTrend(history: Snapshot[]): Trend {
  if (history.length < 2) {
    return {
      windowMinutes: TREND_WINDOW_MINUTES,
      samples: history.length,
      cornersDelta: pair(null, null),
      shotsDelta: pair(null, null),
      shotsOnTargetDelta: pair(null, null),
      dangerousAttacksDelta: pair(null, null),
      scoreDelta: pair(null, null),
      pace: 'insufficient-data',
      lastChangeAt: history.at(-1)?.capturedAt ?? null,
    };
  }

  const latest = history.at(-1)!;
  const latestMinute = latest.minuteNumber;
  const candidates = history.filter((snapshot) => {
    if (latestMinute === null || snapshot.minuteNumber === null) return true;
    return latestMinute - snapshot.minuteNumber <= TREND_WINDOW_MINUTES;
  });
  const baseline = candidates[0] ?? history[0];
  const cornersDelta = deltaPair(latest.corners, baseline.corners);
  const shotsDelta = deltaPair(latest.shots, baseline.shots);
  const shotsOnTargetDelta = deltaPair(latest.shotsOnTarget, baseline.shotsOnTarget);
  const dangerousAttacksDelta = deltaPair(latest.dangerousAttacks, baseline.dangerousAttacks);
  const scoreDelta = pair(
    latest.homeScore - baseline.homeScore,
    latest.awayScore - baseline.awayScore
  );

  const activity =
    (cornersDelta.total ?? 0) * 3 +
    (shotsOnTargetDelta.total ?? 0) * 2 +
    (shotsDelta.total ?? 0) +
    (dangerousAttacksDelta.total ?? 0) * 0.25;
  const pace: Trend['pace'] =
    candidates.length < 2
      ? 'insufficient-data'
      : activity >= 8
        ? 'accelerating'
        : activity <= 1
          ? 'cooling'
          : 'stable';

  return {
    windowMinutes: TREND_WINDOW_MINUTES,
    samples: candidates.length,
    cornersDelta,
    shotsDelta,
    shotsOnTargetDelta,
    dangerousAttacksDelta,
    scoreDelta,
    pace,
    lastChangeAt: latest.capturedAt,
  };
}

async function refresh(origin: string) {
  if (state.refreshInFlight) return state.refreshInFlight;
  state.refreshInFlight = (async () => {
    const url = new URL('/api/live/corners-fast', origin);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`live enrichment failed: ${response.status}`);
    const payload = (await response.json()) as {
      matches?: LiveMatch[];
      statisticsCoverage?: Record<string, unknown>;
    };
    const matches = Array.isArray(payload.matches) ? payload.matches : [];
    appendHistory(matches);
    state.matches = matches;
    state.coverage = payload.statisticsCoverage;
    state.updatedAt = new Date().toISOString();
  })().finally(() => {
    state.refreshInFlight = null;
  });
  return state.refreshInFlight;
}

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get('refresh') === '1';
  const includeHistory = request.nextUrl.searchParams.get('history') !== '0';
  const requestedMatchId = request.nextUrl.searchParams.get('matchId');
  const age = state.updatedAt ? Date.now() - new Date(state.updatedAt).getTime() : Number.POSITIVE_INFINITY;

  if (force || age > MAX_STALE_MS || state.matches.length === 0) {
    try {
      await refresh(request.nextUrl.origin);
    } catch (error) {
      if (state.matches.length === 0) {
        return NextResponse.json(
          { matches: [], error: error instanceof Error ? error.message : 'Falha no motor ao vivo' },
          { status: 502 }
        );
      }
    }
  }

  const sourceMatches = requestedMatchId
    ? state.matches.filter((match) => String(match.id) === requestedMatchId)
    : state.matches;

  const matches = sourceMatches.map((match) => {
    const key = eventKey(match);
    const history = state.history[key] ?? [];
    return {
      ...match,
      engineHistory: includeHistory ? history : undefined,
      engineTrend: buildTrend(history),
      engineUpdatedAt: state.updatedAt,
      engineTrackedSince: history[0]?.capturedAt ?? null,
      engineSnapshotCount: history.length,
    };
  });

  return NextResponse.json({
    matches,
    count: matches.length,
    lastUpdated: state.updatedAt,
    engine: {
      mode: 'central-continuous',
      refreshSeconds: 25,
      historyLimit: HISTORY_LIMIT,
      trendWindowMinutes: TREND_WINDOW_MINUTES,
      trackedMatches: Object.keys(state.history).length,
      totalSnapshots: Object.values(state.history).reduce((sum, history) => sum + history.length, 0),
      coverage: state.coverage ?? null,
    },
  });
}
