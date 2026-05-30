import { NextRequest, NextResponse } from 'next/server';
import { fetchShotStats } from '@/app/api/utils/footballData';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const shotStats = await fetchShotStats(leagueId);

  if (!shotStats) {
    return NextResponse.json(
      { error: 'League not found or no shot data available' },
      { status: 404 }
    );
  }

  return NextResponse.json(shotStats);
}
