import { NextRequest, NextResponse } from 'next/server';
import {
  THESPORTSDB_BASE,
  THESPORTSDB_LEAGUES,
  THESPORTSDB_HEADERS,
  type TheSportsDBEvent,
} from '@/app/api/utils/thesportsdb';
import { SCORES365_COMPETITIONS, scores365Get } from '@/app/api/utils/scores365';
import { currentUpcomingMatches } from '@/data/currentFixtures';

function saoPauloDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function saoPauloTimeString(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function localFallback(leagueKey: string) {
  const now = Date.now() - 6 * 60 * 60 * 1000;
  return currentUpcomingMatches
    .filter((match) => match.leagueKey === leagueKey)
    .filter((match) => {
      const parsed = Date.parse(`${match.date.replace(' ', 'T')}:00-03:00`);
      return Number.isFinite(parsed) && parsed >= now;
    })
    .map((match, index) => ({
      id: `local-${index}-${match.homeTeam}-${match.awayTeam}`,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeTeamId: '',
      awayTeamId: '',
      homeTeamBadge: null,
      awayTeamBadge: null,
      date: match.date.slice(0, 10),
      time: match.date.slice(11, 16),
      timestamp: `${match.date.replace(' ', 'T')}:00`,
      round: match.round || 'Próximos jogos',
      referee: match.referee || null,
      venue: match.venue || null,
      status: null,
      homeScore: null,
      awayScore: null,
    }));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leagueKey: string }> }
) {
  const { leagueKey } = await params;
  const league = THESPORTSDB_LEAGUES[leagueKey];

  if (!league) {
    return NextResponse.json({ error: 'League not found' }, { status: 404 });
  }

  const isBrazilian = ['brasileirao_a', 'brasileirao_b', 'copa_do_brasil'].includes(leagueKey);

  if (isBrazilian) {
    try {
      const competition = SCORES365_COMPETITIONS[leagueKey];
      if (competition) {
        const data = (await scores365Get('/web/games/', {
          competitions: String(competition.id),
          statuses: '1,2',
        })) as {
          games?: Array<{
            id: number;
            startTime: string;
            statusGroup?: number;
            roundNum?: number;
            roundName?: string;
            homeCompetitor: { id: number; name: string };
            awayCompetitor: { id: number; name: string };
          }>;
        };

        const today = saoPauloDateString();
        const fixtures = (data.games || [])
          .filter((game) => game.statusGroup !== 3)
          .filter((game) => saoPauloDateString(new Date(game.startTime)) >= today)
          .map((game) => {
            const start = new Date(game.startTime);
            const date = saoPauloDateString(start);
            const time = saoPauloTimeString(start);
            return {
              id: String(game.id),
              homeTeam: game.homeCompetitor.name,
              awayTeam: game.awayCompetitor.name,
              homeTeamId: String(game.homeCompetitor.id),
              awayTeamId: String(game.awayCompetitor.id),
              homeTeamBadge: null,
              awayTeamBadge: null,
              date,
              time,
              timestamp: `${date}T${time}:00`,
              round: game.roundNum ? `Rodada ${game.roundNum}` : game.roundName || 'Rodada',
              referee: null,
              venue: null,
              status: null,
              homeScore: null,
              awayScore: null,
            };
          })
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        if (fixtures.length > 0) {
          return NextResponse.json({
            league: leagueKey,
            leagueName: league.name,
            season: league.season,
            fixtures,
            source: '365scores',
            lastUpdated: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('365Scores upcoming fallback error:', error);
    }

    const fixtures = localFallback(leagueKey);
    return NextResponse.json({
      league: leagueKey,
      leagueName: league.name,
      season: league.season,
      fixtures,
      source: 'local',
      lastUpdated: new Date().toISOString(),
    });
  }

  try {
    const url = `${THESPORTSDB_BASE}/eventsseason.php?id=${league.id}&s=${league.season}`;
    const response = await fetch(url, { headers: THESPORTSDB_HEADERS });
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
