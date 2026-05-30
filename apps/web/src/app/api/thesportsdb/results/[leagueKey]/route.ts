import { NextRequest, NextResponse } from 'next/server';
import {
  THESPORTSDB_BASE,
  THESPORTSDB_LEAGUES,
  THESPORTSDB_HEADERS,
  type TheSportsDBEvent,
} from '@/app/api/utils/thesportsdb';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leagueKey: string }> }
) {
  const { leagueKey } = await params;
  const league = THESPORTSDB_LEAGUES[leagueKey];

  if (!league) {
    return NextResponse.json({ error: 'League not found' }, { status: 404 });
  }

  try {
    const url = `${THESPORTSDB_BASE}/eventspastleague.php?id=${league.id}`;
    const response = await fetch(url, { headers: THESPORTSDB_HEADERS });

    if (!response.ok) {
      throw new Error(`TheSportsDB API error ${response.status}`);
    }

    const data = (await response.json()) as { events?: TheSportsDBEvent[] };

    if (!data.events) {
      return NextResponse.json({ league: leagueKey, leagueName: league.name, results: [] });
    }

    const results = data.events
      .filter((event) => event.intHomeScore !== null)
      .map((event) => ({
        id: event.idEvent,
        homeTeam: event.strHomeTeam,
        awayTeam: event.strAwayTeam,
        homeTeamId: event.idHomeTeam,
        awayTeamId: event.idAwayTeam,
        homeTeamBadge: event.strHomeTeamBadge,
        awayTeamBadge: event.strAwayTeamBadge,
        date: event.dateEvent,
        timestamp: event.strTimestamp,
        round: event.intRound,
        referee: event.strOfficial || null,
        venue: event.strVenue,
        homeScore: parseInt(event.intHomeScore || '0'),
        awayScore: parseInt(event.intAwayScore || '0'),
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      league: leagueKey,
      leagueName: league.name,
      season: league.season,
      results,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('TheSportsDB results error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch results',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
