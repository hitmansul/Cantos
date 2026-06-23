import { NextRequest, NextResponse } from 'next/server';
import {
  replaceWorldCupMatchStatistics,
  upsertWorldCupMatch,
  type WorldCupMatchInput,
  type WorldCupStatisticInput,
} from '@/lib/persistence/worldCupRepository';

type ImportMatch = WorldCupMatchInput & {
  statistics?: WorldCupStatisticInput[];
};

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret') ?? request.nextUrl.searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { matches?: ImportMatch[] } | null;
  const matches = body?.matches ?? [];
  if (!Array.isArray(matches) || matches.length === 0) {
    return NextResponse.json({ error: 'Envie { matches: [...] } com jogos e estatisticas FIFA.' }, { status: 400 });
  }

  let matchesUpserted = 0;
  let statisticsInserted = 0;

  for (const match of matches) {
    const matchId = await upsertWorldCupMatch({
      ...match,
      sourceKey: 'fifa',
      sourceUpdatedAt: match.sourceUpdatedAt ?? new Date().toISOString(),
    });
    matchesUpserted += 1;

    const statistics = (match.statistics ?? []).map((stat) => ({
      ...stat,
      sourceKey: 'fifa',
      sourceUpdatedAt: stat.sourceUpdatedAt ?? new Date().toISOString(),
    }));

    if (statistics.length > 0) {
      statisticsInserted += await replaceWorldCupMatchStatistics(matchId, statistics, 'fifa');
    }
  }

  return NextResponse.json({
    source: 'fifa',
    matchesReceived: matches.length,
    matchesUpserted,
    statisticsInserted,
    importedAt: new Date().toISOString(),
  });
}
