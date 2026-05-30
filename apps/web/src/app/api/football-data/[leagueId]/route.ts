import { NextRequest, NextResponse } from 'next/server';
import { fetchLeagueStats } from '@/app/api/utils/footballData';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;

  if (leagueId === 'BR1') {
    return NextResponse.json({ error: 'Brazilian league uses local data' }, { status: 400 });
  }

  const stats = await fetchLeagueStats(leagueId);

  if (!stats) {
    return NextResponse.json(
      { error: 'League not found or failed to fetch data' },
      { status: 404 }
    );
  }

  return NextResponse.json(stats);
}
