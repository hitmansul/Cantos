import { after, NextRequest, NextResponse } from 'next/server';
import sql from '../../utils/sql';

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
  hydratedAt: number;
};

type MatchRow = {
  event_key: string;
  match_data: LiveMatch | string;
  updated_at: string | Date;
};

type SnapshotRow = {
  event_key: string;
  snapshot_data: Snapshot | string;
};

const globalStore = globalThis as typeof globalThis & { __cornerGptLiveEngine?: EngineState };
const state: EngineState = globalStore.__cornerGptLiveEngine ?? {
  matches: [],
  history: {},
  updatedAt: null,
  refreshInFlight: null,
  hydratedAt: 0,
};
globalStore.__cornerGptLiveEngine = state;

const HISTORY_LIMIT = 120;
const COMPACT_HISTORY_LIMIT = 12;
const SUMMARY_HISTORY_LIMIT = 3;
const HISTORY_WINDOW_HOURS = 3;
const MAX_STALE_MS = 35_000;
const HYDRATE_MAX_AGE_MS = 60_000;
const ACTIVE_MATCH_MAX_AGE_MINUTES = 15;
const TREND_WINDOW_MINUTES = 10;

let schemaReady: Promise<void> | null = null;

function parseJson<T>(value: T | string): T {
  if (typeof value !== 'string') return value;
  return JSON.parse(value) as T;
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS live_engine_matches (
          event_key TEXT PRIMARY KEY,
          match_data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS live_engine_snapshots (
          id BIGSERIAL PRIMARY KEY,
          event_key TEXT NOT NULL,
          captured_at TIMESTAMPTZ NOT NULL,
          snapshot_data JSONB NOT NULL,
          UNIQUE (event_key, captured_at)
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS live_engine_snapshots_event_time_idx
        ON live_engine_snapshots (event_key, captured_at DESC)
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

async function loadHistoryFromDatabase(limit: number, requestedMatchId?: string) {
  const matchId = requestedMatchId ?? '';
  const snapshotRows = await sql`
    SELECT event_key, snapshot_data
    FROM (
      SELECT snapshots.event_key, snapshots.snapshot_data, snapshots.captured_at,
        ROW_NUMBER() OVER (PARTITION BY snapshots.event_key ORDER BY snapshots.captured_at DESC) AS row_number
      FROM live_engine_snapshots snapshots
      INNER JOIN live_engine_matches matches ON matches.event_key = snapshots.event_key
      WHERE matches.updated_at > NOW() - (${ACTIVE_MATCH_MAX_AGE_MINUTES} * INTERVAL '1 minute')
        AND snapshots.captured_at > NOW() - (${HISTORY_WINDOW_HOURS} * INTERVAL '1 hour')
        AND (${matchId} = '' OR matches.match_data->>'id' = ${matchId})
    ) recent
    WHERE row_number <= ${limit}
    ORDER BY event_key, captured_at ASC
  ` as SnapshotRow[];
  const history: Record<string, Snapshot[]> = {};
  for (const row of snapshotRows) {
    const snapshot = parseJson(row.snapshot_data);
    (history[row.event_key] ??= []).push(snapshot);
  }
  return history;
}

async function hydrateFromDatabase(force = false) {
  if (!force && Date.now() - state.hydratedAt < HYDRATE_MAX_AGE_MS) return;
  await ensureSchema();

  const matchRows = await sql`
    SELECT event_key, match_data, updated_at
    FROM live_engine_matches
    WHERE updated_at > NOW() - (${ACTIVE_MATCH_MAX_AGE_MINUTES} * INTERVAL '1 minute')
    ORDER BY updated_at DESC
  ` as MatchRow[];

  const history = await loadHistoryFromDatabase(COMPACT_HISTORY_LIMIT);

  state.matches = matchRows.map((row) => parseJson(row.match_data));
  if (matchRows.length > 0) {
    const newest = matchRows[0]?.updated_at;
    state.updatedAt = newest ? new Date(newest).toISOString() : state.updatedAt;
  }
  state.history = history;
  state.hydratedAt = Date.now();
}

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

async function persistMatches(matches: LiveMatch[], capturedAt: string) {
  await Promise.all(matches.map((match) => {
    const key = eventKey(match);
    return sql`
      INSERT INTO live_engine_matches (event_key, match_data, updated_at)
      VALUES (${key}, ${JSON.stringify(match)}::jsonb, ${capturedAt}::timestamptz)
      ON CONFLICT (event_key)
      DO UPDATE SET match_data = EXCLUDED.match_data, updated_at = EXCLUDED.updated_at
    `;
  }));

  await sql`
    DELETE FROM live_engine_matches
    WHERE updated_at <= ${capturedAt}::timestamptz - (${ACTIVE_MATCH_MAX_AGE_MINUTES} * INTERVAL '1 minute')
  `;
}

async function appendHistory(matches: LiveMatch[]) {
  const capturedAt = new Date().toISOString();
  const snapshotsToPersist: Array<{ key: string; snapshot: Snapshot }> = [];

  for (const match of matches) {
    const key = eventKey(match);
    const history = state.history[key] ?? [];
    const snapshot = createSnapshot(match, capturedAt);
    if (snapshotChanged(history.at(-1), snapshot)) {
      state.history[key] = [...history, snapshot].slice(-HISTORY_LIMIT);
      snapshotsToPersist.push({ key, snapshot });
    }
  }

  try {
    await persistMatches(matches, capturedAt);
    await Promise.all(snapshotsToPersist.map(({ key, snapshot }) => sql`
      INSERT INTO live_engine_snapshots (event_key, captured_at, snapshot_data)
      VALUES (${key}, ${snapshot.capturedAt}::timestamptz, ${JSON.stringify(snapshot)}::jsonb)
      ON CONFLICT (event_key, captured_at) DO NOTHING
    `));
  } catch (error) {
    console.warn('[live-engine] Persistência indisponível; mantendo histórico em memória.', error);
  }

  state.hydratedAt = Date.now();
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

function mergeFreshStats(previous: LiveMatch | undefined, current: LiveMatch): LiveMatch {
  if (!previous) return current;
  return {
    ...previous,
    ...current,
    corners: current.corners ?? previous.corners,
    liveStats: current.liveStats?.length ? current.liveStats : previous.liveStats,
  };
}

async function refresh(origin: string) {
  if (state.refreshInFlight) return state.refreshInFlight;
  state.refreshInFlight = (async () => {
    try {
      await hydrateFromDatabase();
    } catch (error) {
      console.warn('[live-engine] Neon indisponível durante hidratação; seguindo com coleta ao vivo.', error);
    }
    const previousByKey = new Map(state.matches.map((match) => [eventKey(match), match] as const));
    const url = new URL('/api/live/corners-fast', origin);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`live enrichment failed: ${response.status}`);
    const payload = (await response.json()) as {
      matches?: LiveMatch[];
      statisticsCoverage?: Record<string, unknown>;
      cornerCoverage?: Record<string, unknown>;
    };
    const rawMatches = Array.isArray(payload.matches) ? payload.matches : [];
    const matches = rawMatches.map((match) => mergeFreshStats(previousByKey.get(eventKey(match)), match));
    await appendHistory(matches);
    state.matches = matches;
    state.coverage = payload.statisticsCoverage ?? payload.cornerCoverage;
    state.updatedAt = new Date().toISOString();
  })().finally(() => {
    state.refreshInFlight = null;
  });
  return state.refreshInFlight;
}

function scheduleRefresh(origin: string) {
  after(async () => {
    try {
      await refresh(origin);
    } catch {
      // Mantém os dados persistidos quando uma fonte estiver lenta ou indisponível.
    }
  });
}

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get('refresh') === '1';
  const historyMode = request.nextUrl.searchParams.get('history') ?? '1';
  const includeHistory = historyMode !== '0';
  const requestedMatchId = request.nextUrl.searchParams.get('matchId');
  const collector = request.nextUrl.searchParams.get('collector');

  try {
    await hydrateFromDatabase();
  } catch (error) {
    console.warn('[live-engine] Neon indisponível no GET; usando coleta/memória.', error);
  }

  const age = state.updatedAt ? Date.now() - new Date(state.updatedAt).getTime() : Number.POSITIVE_INFINITY;
  const hasCachedMatches = state.matches.length > 0;
  const shouldRefresh = force || age > MAX_STALE_MS;

  if (!hasCachedMatches || (force && collector === 'cron')) {
    try {
      await refresh(request.nextUrl.origin);
    } catch (error) {
      if (!hasCachedMatches) {
        return NextResponse.json(
          { matches: [], error: error instanceof Error ? error.message : 'Falha no motor ao vivo' },
          { status: 502 }
        );
      }
    }
  } else if (shouldRefresh) {
    scheduleRefresh(request.nextUrl.origin);
  }

  const sourceMatches = requestedMatchId
    ? state.matches.filter((match) => String(match.id) === requestedMatchId)
    : state.matches;

  let responseHistory = state.history;
  if (includeHistory && historyMode === 'summary') {
    responseHistory = Object.fromEntries(
      Object.entries(state.history).map(([key, history]) => [key, history.slice(-SUMMARY_HISTORY_LIMIT)])
    );
  } else if (includeHistory && historyMode !== 'compact') {
    try {
      responseHistory = await loadHistoryFromDatabase(HISTORY_LIMIT, requestedMatchId ?? undefined);
    } catch {
      responseHistory = state.history;
    }
  }

  const matches = sourceMatches.map((match) => {
    const key = eventKey(match);
    const history = responseHistory[key] ?? state.history[key] ?? [];
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
    refreshQueued: hasCachedMatches && shouldRefresh && collector !== 'cron',
    engine: {
      mode: 'central-persistent-neon-compact-live-set',
      persistence: 'neon-postgresql',
      refreshing: Boolean(state.refreshInFlight),
      refreshSeconds: 25,
      historyLimit: HISTORY_LIMIT,
      compactHistoryLimit: COMPACT_HISTORY_LIMIT,
      summaryHistoryLimit: SUMMARY_HISTORY_LIMIT,
      trendWindowMinutes: TREND_WINDOW_MINUTES,
      trackedMatches: Object.keys(state.history).length,
      totalSnapshots: Object.values(state.history).reduce((sum, history) => sum + history.length, 0),
      coverage: state.coverage ?? null,
    },
  });
}
