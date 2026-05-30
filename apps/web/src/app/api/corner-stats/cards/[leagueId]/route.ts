import { NextRequest, NextResponse } from 'next/server';
import { fetchCardStats } from '@/app/api/utils/footballData';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const cardStats = await fetchCardStats(leagueId);

  if (!cardStats) {
    return NextResponse.json(
      { error: 'League not found or no card data available' },
      { status: 404 }
    );
  }

  return NextResponse.json(cardStats);
}
