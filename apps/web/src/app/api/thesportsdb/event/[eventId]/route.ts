import { NextRequest, NextResponse } from 'next/server';
import { THESPORTSDB_BASE, THESPORTSDB_HEADERS } from '@/app/api/utils/thesportsdb';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  try {
    const url = `${THESPORTSDB_BASE}/lookupevent.php?id=${eventId}`;
    const response = await fetch(url, { headers: THESPORTSDB_HEADERS });

    if (!response.ok) {
      throw new Error(`TheSportsDB API error ${response.status}`);
    }

    const data = (await response.json()) as {
      events?: Array<{
        idEvent: string;
        strHomeTeam: string;
        strAwayTeam: string;
        dateEvent: string;
        strTime: string;
        strTimestamp: string;
        intRound: string;
        strOfficial: string | null;
        strVenue: string | null;
        strCity: string | null;
        intHomeScore: string | null;
        intAwayScore: string | null;
        idHomeTeam: string;
        idAwayTeam: string;
        strHomeTeamBadge: string | null;
        strAwayTeamBadge: string | null;
        intSpectators: string | null;
      }>;
    };

    if (!data.events || data.events.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = data.events[0];
    return NextResponse.json({
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
      city: event.strCity,
      homeScore: event.intHomeScore ? parseInt(event.intHomeScore) : null,
      awayScore: event.intAwayScore ? parseInt(event.intAwayScore) : null,
      spectators: event.intSpectators ? parseInt(event.intSpectators) : null,
    });
  } catch (error) {
    console.error('TheSportsDB event error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch event',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
