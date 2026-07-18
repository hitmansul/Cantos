import { NextRequest, NextResponse } from 'next/server';
import {
  THESPORTSDB_BASE,
  THESPORTSDB_LEAGUES,
  THESPORTSDB_HEADERS,
  type TheSportsDBEvent,
} from '@/app/api/utils/thesportsdb';
import { getUpcomingFixtures } from '@/lib/competitions/competitionDataService';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leagueKey: string }> }
) {
  const { leagueKey } = await params;

  // Novo fluxo central: API-Football principal, seguida dos fallbacks definidos
  // no registro. Inclui Série A/B/C/D, Copa do Brasil e qualquer chave api_ID_ANO.
  const unified = await getUpcomingFixtures(leagueKey);
  if (unified.definition) {
    return NextResponse.json({
      league: leagueKey,
      leagueName: unified.definition.name,
      season: unified.definition.season ?? new Date().getUTCFullYear(),
      fixtures: unified.fixtures,
      source: unified.source,
      attemptedSources: unified.attempts,
      lastUpdated: new Date().toISOString(),
    });
  }

  // Compatibilidade com ligas antigas ainda cadastradas somente no TheSportsDB.
  const league = THESPORTSDB_LEAGUES[leagueKey];
  if (!league) {
    return NextResponse.json({ error: 'League not found' }, { status: 404 });
  }

  try {
    const url = `${THESPORTSDB_BASE}/eventsseason.php?id=${league.id}&s=${league.season}`;
    const response = await fetch(url, { headers: THESPORTSDB_HEADERS, next: { revalidate: 1800 } });
    if (!response.ok) throw new Error(`TheSportsDB API error ${response.status}`);

    const data = (await response.json()) as { events?: TheSportsDBEvent[] };
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const fixtures = (data.events || [])
      .filter((event) => event.dateEvent && new Date(event.dateEvent) >= now)
      .filter((event) => event.intHomeScore == null || event.intAwayScore == null)
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
        timestamp: event.strTimestamp || `${event.dateEvent}T${event.strTime || '00:00:00'}`,
        round: event.intRound ? `Rodada ${event.intRound}` : 'Rodada',
        referee: event.strOfficial || null,
        venue: event.strVenue,
        source: 'thesportsdb',
      }));

    return NextResponse.json({
      league: leagueKey,
      leagueName: league.name,
      season: league.season,
      fixtures,
      source: 'thesportsdb',
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch next fixtures',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
