import { NextRequest, NextResponse } from 'next/server';

type LiveMatch = {
  id: number;
  minute: number | string;
  statusText?: string;
  competition?: string;
  homeTeam: { id: number; name: string; score: number };
  awayTeam: { id: number; name: string; score: number };
  corners?: { home: number; away: number; total: number };
  liveStats?: Array<{ key: string; label: string; home: string; away: string }>;
  stoppage?: unknown;
  periodStoppage?: unknown;
  sourceIds?: { scores365?: number; sofascore?: number; apiFootball?: number };
  [key: string]: unknown;
};

type Snapshot = {
  capturedAt: string;
  minute: number | string;
  homeScore: number;
  awayScore: number;
  corners: number | null;
  statsCount: number;
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

const HISTORY_LIMIT = 240;
const MAX_STALE_MS = 35_000;

function eventKey(match: LiveMatch) {
  return String(
    match.sourceIds?.sofascore ??
      match.sourceIds?.apiFootball ??
      match.sourceIds?.scores365 ??
      match.id
  );
}

function appendHistory(matches: LiveMatch[]) {
  const capturedAt = new Date().toISOString();
  for (const match of matches) {
    const key = eventKey(match);
    const history = state.history[key] ?? [];
    const snapshot: Snapshot = {
      capturedAt,
      minute: match.minute,
      homeScore: match.homeTeam.score,
      awayScore: match.awayTeam.score,
      corners: match.corners?.total ?? null,
      statsCount: match.liveStats?.length ?? 0,
    };
    const previous = history.at(-1);
    const changed =
      !previous ||
      previous.minute !== snapshot.minute ||
      previous.homeScore !== snapshot.homeScore ||
      previous.awayScore !== snapshot.awayScore ||
      previous.corners !== snapshot.corners ||
      previous.statsCount !== snapshot.statsCount;
    if (changed) state.history[key] = [...history, snapshot].slice(-HISTORY_LIMIT);
  }
}

async function refresh(origin: string) {
  if (state.refreshInFlight) return state.refreshInFlight;
  state.refreshInFlight = (async () => {
    const url = new URL('/api/live/enriched', origin);
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

  const matches = state.matches.map((match) => {
    const key = eventKey(match);
    return {
      ...match,
      engineHistory: state.history[key] ?? [],
      engineUpdatedAt: state.updatedAt,
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
      trackedMatches: Object.keys(state.history).length,
      coverage: state.coverage ?? null,
    },
  });
}
