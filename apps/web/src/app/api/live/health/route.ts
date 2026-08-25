import { NextResponse } from 'next/server';
import sql from '../../utils/sql';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [matchRow] = await sql`
      SELECT
        COUNT(*)::int AS active_matches,
        EXTRACT(EPOCH FROM (NOW() - MAX(updated_at)))::int AS newest_match_age_seconds
      FROM live_engine_matches
      WHERE updated_at > NOW() - INTERVAL '15 minutes'
    ` as Array<{ active_matches: number; newest_match_age_seconds: number | null }>;

    const [snapshotRow] = await sql`
      WITH recent AS (
        SELECT
          event_key,
          captured_at,
          snapshot_data,
          LAG(captured_at) OVER (PARTITION BY event_key ORDER BY captured_at) AS previous_at,
          LAG(snapshot_data) OVER (PARTITION BY event_key ORDER BY captured_at) AS previous_data
        FROM live_engine_snapshots
        WHERE captured_at > NOW() - INTERVAL '10 minutes'
      )
      SELECT
        COUNT(*)::int AS snapshots_10m,
        COUNT(DISTINCT event_key)::int AS matches_with_snapshots_10m,
        COUNT(*) FILTER (
          WHERE previous_at IS NOT NULL
            AND captured_at - previous_at <= INTERVAL '30 seconds'
            AND (snapshot_data - 'capturedAt') = (previous_data - 'capturedAt')
        )::int AS exact_near_duplicates,
        EXTRACT(EPOCH FROM (NOW() - MAX(captured_at)))::int AS newest_snapshot_age_seconds
      FROM recent
    ` as Array<{
      snapshots_10m: number;
      matches_with_snapshots_10m: number;
      exact_near_duplicates: number;
      newest_snapshot_age_seconds: number | null;
    }>;

    const activeMatches = Number(matchRow?.active_matches ?? 0);
    const newestMatchAgeSeconds = matchRow?.newest_match_age_seconds ?? null;
    const snapshots10m = Number(snapshotRow?.snapshots_10m ?? 0);
    const matchesWithSnapshots10m = Number(snapshotRow?.matches_with_snapshots_10m ?? 0);
    const exactNearDuplicates = Number(snapshotRow?.exact_near_duplicates ?? 0);
    const newestSnapshotAgeSeconds = snapshotRow?.newest_snapshot_age_seconds ?? null;

    const stale = activeMatches > 0 && (newestMatchAgeSeconds === null || newestMatchAgeSeconds > 120);
    const snapshotStale = activeMatches > 0 && (newestSnapshotAgeSeconds === null || newestSnapshotAgeSeconds > 180);
    const duplicateRatio = snapshots10m > 0 ? exactNearDuplicates / snapshots10m : 0;
    const status = stale || snapshotStale || duplicateRatio > 0.15 ? 'degraded' : 'healthy';

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      status,
      activeMatches,
      newestMatchAgeSeconds,
      snapshots10m,
      matchesWithSnapshots10m,
      exactNearDuplicates,
      duplicateRatio: Number(duplicateRatio.toFixed(3)),
      newestSnapshotAgeSeconds,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'live health diagnostics failed',
    }, { status: 500 });
  }
}
