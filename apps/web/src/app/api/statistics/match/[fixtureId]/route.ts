import { NextRequest, NextResponse } from 'next/server';
import { getMatchStatistics } from '@/lib/statistics/matchStatisticsEngine';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await params;

  if (!fixtureId || !/^\d+$/.test(fixtureId)) {
    return NextResponse.json(
      { error: 'Invalid fixture id' },
      { status: 400 },
    );
  }

  try {
    const result = await getMatchStatistics(fixtureId);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': result.source === 'none'
          ? 'public, s-maxage=60, stale-while-revalidate=120'
          : 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('[statistics] failed to load match statistics', error);
    return NextResponse.json(
      {
        error: 'Failed to load match statistics',
        fixtureId,
      },
      { status: 500 },
    );
  }
}
