import { NextRequest, NextResponse } from 'next/server';
import sql from '../../../utils/sql';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Decision = 'OPORTUNIDADE' | 'ACOMPANHAR' | 'EVITAR';
type Confidence = 'Alta' | 'Média' | 'Baixa' | 'Insuficiente';
type Pair = { home: number | null; away: number | null; total: number | null };
type Snapshot = { capturedAt?: string | null; corners?: Pair; shots?: Pair; dangerousAttacks?: Pair };
type Match = {
  id: number;
  minute: number | string;
  competition?: string;
  homeTeam?: { name?: string; score?: number };
  awayTeam?: { name?: string; score?: number };
  corners?: { home?: number; away?: number; total?: number };
  engineHistory?: Snapshot[];
  engineTrend?: {
    pace?: string;
    status?: string;
    cornersDelta?: Pair | number;
    shotsDelta?: Pair | number;
    dangerousAttacksDelta?: Pair | number;
  };
};

type Intelligence = {
  ready: boolean;
  decision: Decision | 'COLETANDO';
  score: number;
  probability: number | null;
  pressure: number | null;
  speed: number | null;
  confidence: Confidence;
};

function authorized(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!authorization || !secret) return true;
  return authorization === `Bearer ${secret}`;
}

function num(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullable(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function minuteNumber(value: number | string) {
  const match = String(value ?? '').match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/);
  return match ? num(match[1]) + num(match[2]) : 0;
}

function pairTotal(value: Pair | number | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  return nullable(value?.total) ?? ((nullable(value?.home) ?? 0) + (nullable(value?.away) ?? 0));
}

function useful(match: Match) {
  const latest = match.engineHistory?.at(-1);
  return match.corners?.total !== undefined
    || latest?.corners?.total !== null && latest?.corners?.total !== undefined
    || latest?.shots?.total !== null && latest?.shots?.total !== undefined
    || latest?.dangerousAttacks?.total !== null && latest?.dangerousAttacks?.total !== undefined;
}

function calculate(match: Match): Intelligence {
  const history = Array.isArray(match.engineHistory) ? match.engineHistory : [];
  const pace = match.engineTrend?.pace ?? match.engineTrend?.status ?? 'insufficient-data';
  const ready = history.length >= 3 && useful(match) && pace !== 'insufficient-data';
  if (!ready) return { ready: false, decision: 'COLETANDO', score: 0, probability: null, pressure: null, speed: null, confidence: 'Insuficiente' };

  const latest = history.at(-1);
  const corners = nullable(match.corners?.total) ?? nullable(latest?.corners?.total) ?? 0;
  const recentCorners = Math.max(pairTotal(match.engineTrend?.cornersDelta), 0);
  const recentShots = Math.max(pairTotal(match.engineTrend?.shotsDelta), 0);
  const recentDangerous = Math.max(pairTotal(match.engineTrend?.dangerousAttacksDelta), 0);
  const hasCorners = match.corners?.total !== undefined || nullable(latest?.corners?.total) !== null;
  const hasShots = nullable(latest?.shots?.total) !== null;
  const hasDangerous = nullable(latest?.dangerousAttacks?.total) !== null;
  const coverage = Number(hasCorners) + Number(hasShots) + Number(hasDangerous);
  const trendBoost = pace === 'accelerating' ? 24 : pace === 'stable' ? 11 : -8;
  const pressure = Math.max(0, Math.min(100, Math.round(recentDangerous * 7 + recentShots * 8 + recentCorners * 20 + trendBoost)));
  const speed = Math.max(0, Math.min(100, Math.round(recentCorners * 24 + recentShots * 11 + recentDangerous * 4 + trendBoost)));
  const minute = minuteNumber(match.minute);
  const minuteWindow = minute >= 55 && minute <= 88 ? 12 : minute >= 25 && minute < 55 ? 7 : 1;
  const recentActivity = Math.min(30, recentCorners * 10 + recentShots * 3 + recentDangerous * 1.5);
  const accumulatedContext = Math.min(10, corners * 0.8) + Math.min(8, history.length * 1.2);
  const coolingPenalty = pace === 'cooling' && recentCorners === 0 && recentShots === 0 ? 12 : 0;
  const score = Math.max(0, Math.min(100, Math.round(pressure * 0.28 + speed * 0.24 + recentActivity + accumulatedContext + minuteWindow - coolingPenalty)));
  const probability = Math.max(8, Math.min(92, Math.round(12 + pressure * 0.34 + speed * 0.26 + recentCorners * 5 + minuteWindow * 0.45 - coolingPenalty * 0.5)));
  const confidence: Confidence = coverage === 3 && history.length >= 6 ? 'Alta' : coverage >= 2 && history.length >= 4 ? 'Média' : 'Baixa';
  const canBeOpportunity = (confidence === 'Alta' || confidence === 'Média') && probability >= 60;
  const decision: Decision = score >= 72 && canBeOpportunity ? 'OPORTUNIDADE' : score >= 46 ? 'ACOMPANHAR' : 'EVITAR';
  return { ready: true, decision, score, probability, pressure, speed, confidence };
}

function eventKey(match: Match) {
  return String(match.id);
}

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS live_recommendation_events (
      id BIGSERIAL PRIMARY KEY,
      event_key TEXT NOT NULL,
      fixture TEXT NOT NULL,
      competition TEXT,
      decision TEXT NOT NULL,
      score INTEGER NOT NULL,
      probability INTEGER,
      pressure INTEGER,
      speed INTEGER,
      confidence TEXT NOT NULL,
      match_minute INTEGER NOT NULL,
      minute_bucket INTEGER NOT NULL,
      corners_before INTEGER NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      corner_within_5m BOOLEAN,
      corner_within_10m BOOLEAN,
      resolved_at TIMESTAMPTZ,
      UNIQUE(event_key, decision, minute_bucket)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS live_recommendation_events_pending_idx ON live_recommendation_events (resolved_at, recorded_at)`;
}

async function resolvePending() {
  await sql`
    UPDATE live_recommendation_events r
    SET
      corner_within_5m = CASE
        WHEN NOW() >= r.recorded_at + INTERVAL '5 minutes' THEN EXISTS (
          SELECT 1 FROM live_engine_snapshots s
          WHERE s.event_key = r.event_key
            AND s.captured_at > r.recorded_at
            AND s.captured_at <= r.recorded_at + INTERVAL '5 minutes'
            AND COALESCE((s.snapshot_data->'corners'->>'total')::int, 0) > r.corners_before
        )
        ELSE r.corner_within_5m
      END,
      corner_within_10m = CASE
        WHEN NOW() >= r.recorded_at + INTERVAL '10 minutes' THEN EXISTS (
          SELECT 1 FROM live_engine_snapshots s
          WHERE s.event_key = r.event_key
            AND s.captured_at > r.recorded_at
            AND s.captured_at <= r.recorded_at + INTERVAL '10 minutes'
            AND COALESCE((s.snapshot_data->'corners'->>'total')::int, 0) > r.corners_before
        )
        ELSE r.corner_within_10m
      END,
      resolved_at = CASE WHEN NOW() >= r.recorded_at + INTERVAL '10 minutes' THEN NOW() ELSE r.resolved_at END
    WHERE r.resolved_at IS NULL
      AND r.recorded_at > NOW() - INTERVAL '24 hours'
  `;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });

  try {
    await ensureSchema();
    await resolvePending();

    const centralUrl = new URL('/api/live/central', request.nextUrl.origin);
    centralUrl.searchParams.set('history', 'compact');
    centralUrl.searchParams.set('t', String(Date.now()));
    const response = await fetch(centralUrl, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Falha ao carregar Motor Central');

    const matches = Array.isArray(payload.matches) ? payload.matches as Match[] : [];
    let inserted = 0;
    for (const match of matches) {
      const intelligence = calculate(match);
      if (!intelligence.ready || intelligence.decision === 'COLETANDO') continue;
      const minute = minuteNumber(match.minute);
      const minuteBucket = Math.floor(minute / 5) * 5;
      const latest = match.engineHistory?.at(-1);
      const cornersBefore = nullable(match.corners?.total) ?? nullable(latest?.corners?.total);
      if (cornersBefore === null) continue;
      const fixture = `${match.homeTeam?.name ?? 'Mandante'} x ${match.awayTeam?.name ?? 'Visitante'}`;
      const rows = await sql`
        INSERT INTO live_recommendation_events (
          event_key, fixture, competition, decision, score, probability, pressure, speed,
          confidence, match_minute, minute_bucket, corners_before
        ) VALUES (
          ${eventKey(match)}, ${fixture}, ${match.competition ?? null}, ${intelligence.decision}, ${intelligence.score},
          ${intelligence.probability}, ${intelligence.pressure}, ${intelligence.speed}, ${intelligence.confidence},
          ${minute}, ${minuteBucket}, ${cornersBefore}
        )
        ON CONFLICT(event_key, decision, minute_bucket) DO NOTHING
        RETURNING id
      ` as Array<{ id: number }>;
      inserted += rows.length;
    }

    const [summary] = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE decision='OPORTUNIDADE')::int AS opportunities,
        COUNT(*) FILTER (WHERE decision='ACOMPANHAR')::int AS watch,
        COUNT(*) FILTER (WHERE decision='EVITAR')::int AS avoid,
        COUNT(*) FILTER (WHERE resolved_at IS NOT NULL)::int AS resolved,
        COUNT(*) FILTER (WHERE decision='OPORTUNIDADE' AND resolved_at IS NOT NULL AND corner_within_10m IS TRUE)::int AS opportunity_hits,
        COUNT(*) FILTER (WHERE decision='OPORTUNIDADE' AND resolved_at IS NOT NULL)::int AS opportunity_resolved
      FROM live_recommendation_events
      WHERE recorded_at > NOW() - INTERVAL '30 days'
    ` as Array<Record<string, number>>;

    return NextResponse.json({ ok: true, inserted, activeMatches: matches.length, summary: summary ?? {} }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Falha ao registrar recomendações' }, { status: 500 });
  }
}
