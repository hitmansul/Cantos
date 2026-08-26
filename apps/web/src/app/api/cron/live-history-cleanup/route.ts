import { NextRequest, NextResponse } from 'next/server';
import sql from '../../../utils/sql';

const SNAPSHOT_RETENTION_HOURS = 6;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authorization = request.headers.get('authorization');
    if (authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await sql`
      DELETE FROM live_engine_snapshots
      WHERE captured_at < NOW() - (${SNAPSHOT_RETENTION_HOURS} * INTERVAL '1 hour')
      RETURNING id
    ` as Array<{ id: number }>;

    return NextResponse.json({
      ok: true,
      retentionHours: SNAPSHOT_RETENTION_HOURS,
      deletedSnapshots: result.length,
      cleanedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[live-history-cleanup] Cleanup skipped.', error);
    return NextResponse.json({
      ok: false,
      retentionHours: SNAPSHOT_RETENTION_HOURS,
      error: error instanceof Error ? error.message : 'Cleanup unavailable',
    }, { status: 503 });
  }
}
