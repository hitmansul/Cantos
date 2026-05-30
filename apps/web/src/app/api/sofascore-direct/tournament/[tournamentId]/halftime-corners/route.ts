import { NextRequest, NextResponse } from 'next/server';
import { fetchHalftimeTeamStats } from '@/app/api/utils/sofascoreHalftime';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params;
  const { searchParams } = new URL(request.url);
  const seasonId = parseInt(searchParams.get('seasonId') || '58766', 10);
  const maxMatches = parseInt(searchParams.get('max') || '50', 10);

  try {
    const result = await fetchHalftimeTeamStats(parseInt(tournamentId, 10), seasonId, maxMatches);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Sofascore halftime corners error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch half-time stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
