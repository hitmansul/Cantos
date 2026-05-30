import { NextRequest, NextResponse } from 'next/server';
import { fetchH2HStats } from '@/app/api/utils/footballData';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const { searchParams } = new URL(request.url);
  const team1 = searchParams.get('team1');
  const team2 = searchParams.get('team2');

  if (!team1 || !team2) {
    return NextResponse.json({ error: 'Both team1 and team2 are required' }, { status: 400 });
  }

  const h2hStats = await fetchH2HStats(leagueId, team1, team2);

  if (!h2hStats) {
    return NextResponse.json(
      { error: 'League not found or failed to fetch data' },
      { status: 404 }
    );
  }

  return NextResponse.json(h2hStats);
}
