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
    const url = `${THESPORTSDB_BASE}/eventsseason.php?id=${league.id}&s=${league.season}`;
    const response = await fetch(url, { headers: THESPORTSDB_HEADERS });

    if (!response.ok) {
      throw new Error(`TheSportsDB API error ${response.status}`);
    }

    const data = (await response.json()) as { events?: TheSportsDBEvent[] };

    if (!data.events) {
      return NextResponse.json({
        league: leagueKey,
        leagueName: league.name,
        season: league.season,
        fixtures: [],
        message: 'No fixtures found',
      });
    }

    const now = new Date();
    const fixtures = data.events
      .filter((event) => {
        const eventDate = new Date(event.strTimestamp);
        return event.strStatus !== 'Match Finished' || eventDate > now;
      })
      .map((event) => ({
        id: event.idEvent,
        homeTeam: event.strHomeTeam,
        awayTeam: event.strAwayTeam,
        homeTeamId: event.idHomeTeam,
        awayTeamId: event.idAwayTeam,
        homeTeamBadge: event.strHomeTeamBadge,
        awayTeamBadge: event.strAwayTeamBadge,
        date: event.dateEvent,
        time: event.strTime,
        timestamp: event.strTimestamp,
        round: event.intRound,
        referee: event.strOfficial || null,
        venue: event.strVenue,
        status: event.strStatus,
        homeScore: event.intHomeScore ? parseInt(event.intHomeScore) : null,
        awayScore: event.intAwayScore ? parseInt(event.intAwayScore) : null,
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return NextResponse.json({
      league: leagueKey,
      leagueName: league.name,
      season: league.season,
      fixtures,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('TheSportsDB fixtures error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch fixtures',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
