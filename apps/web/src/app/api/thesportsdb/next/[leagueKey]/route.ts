import { NextRequest, NextResponse } from 'next/server';
import {
  THESPORTSDB_BASE,
  THESPORTSDB_LEAGUES,
  THESPORTSDB_HEADERS,
  type TheSportsDBEvent,
} from '@/app/api/utils/thesportsdb';
import { brazilianFixtures } from '@/data/brazilianFixtures';
import { currentUpcomingMatches } from '@/data/currentFixtures';
import { SCORES365_COMPETITIONS, scores365Get } from '@/app/api/utils/scores365';
import sql from '@/app/api/utils/sql';

function saoPauloDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

function saoPauloDateString(date = new Date()): string {
  const parts = saoPauloDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function saoPauloTimeString(date: Date): string {
  const parts = saoPauloDateParts(date);
  return `${parts.hour}:${parts.minute}`;
}

function dateOnly(value: string): string {
  return value.split(/[ T]/)[0] || value;
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

  // For Brazilian leagues: try DB first, then 365Scores live API, then fall back to static file
  if (
    leagueKey === 'brasileirao_a' ||
    leagueKey === 'brasileirao_b' ||
    leagueKey === 'copa_do_brasil'
  ) {
    try {
      const today = saoPauloDateString();
      const dbMatches = await sql`
        SELECT home_team, away_team, match_date, match_time, round, referee, venue
        FROM upcoming_matches
        WHERE league = ${leagueKey}
          AND match_date >= ${today}
          AND (is_completed = 0 OR is_completed IS NULL)
        ORDER BY match_date ASC, match_time ASC
        LIMIT 60
      `;

      if ((dbMatches as unknown[]).length > 0) {
        const fixtures = (
          dbMatches as Array<{
            home_team: string;
            away_team: string;
            match_date: string;
            match_time: string | null;
            round: string | null;
            referee: string | null;
            venue: string | null;
          }>
        ).map((m, idx) => ({
          id: String(idx + 1),
          homeTeam: m.home_team,
          awayTeam: m.away_team,
          homeTeamId: '',
          awayTeamId: '',
          homeTeamBadge: null,
          awayTeamBadge: null,
          date: m.match_date,
          time: m.match_time || '00:00',
          timestamp: `${m.match_date}T${m.match_time || '00:00'}:00`,
          round: m.round
            ? m.round.startsWith('Rodada')
              ? m.round
              : `Rodada ${m.round}`
            : 'Rodada',
          referee: m.referee || null,
          venue: m.venue || null,
        }));

        if (leagueKey !== 'brasileirao_b' || fixtures.length >= 6) {
          return NextResponse.json({
            league: leagueKey,
            leagueName: league.name,
            season: league.season,
            fixtures,
            source: 'database',
            lastUpdated: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.error('DB fetch error for Brazilian fixtures, trying 365Scores:', e);
    }

    // Intermediate fallback: 365Scores live API (fresh data, no static/outdated games)
    try {
      const todayStr = saoPauloDateString();
      const comp365 = SCORES365_COMPETITIONS[leagueKey];
      if (comp365) {
        const data365 = (await scores365Get(
          `/web/games/scheduled/?competitions=${comp365.id}&sports=1`,
          {}
        )) as {
          games?: Array<{
            id: number;
            startTime: string;
            roundNum?: number;
            roundName?: string;
            statusGroup?: number;
            homeCompetitor: { id: number; name: string };
            awayCompetitor: { id: number; name: string };
          }>;
        };

        if (data365.games && data365.games.length > 0) {
          const upcoming = data365.games.filter((g) => {
            if (g.statusGroup === 3) return false;
            return saoPauloDateString(new Date(g.startTime)) >= todayStr;
          });

          if (upcoming.length > 0) {
            const fixtures365 = upcoming.map((g, idx) => {
              const dt = new Date(g.startTime);
              const dateStr = saoPauloDateString(dt);
              const timeStr = saoPauloTimeString(dt);
              return {
                id: String(g.id || idx + 1),
                homeTeam: g.homeCompetitor.name,
                awayTeam: g.awayCompetitor.name,
                homeTeamId: '',
                awayTeamId: '',
                homeTeamBadge: null,
                awayTeamBadge: null,
                date: dateStr,
                time: timeStr,
                timestamp: `${dateStr}T${timeStr}:00`,
                round: g.roundNum ? `Rodada ${g.roundNum}` : g.roundName || 'Rodada',
                referee: null,
                venue: null,
              };
            });

            fixtures365.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            if (leagueKey !== 'brasileirao_b' || fixtures365.length >= 6) {
              return NextResponse.json({
                league: leagueKey,
                leagueName: league.name,
                season: league.season,
                fixtures: fixtures365,
                source: '365scores',
                lastUpdated: new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('365Scores fallback error for Brazilian fixtures:', e);
    }

    // Final fallback to static file
    const currentLocalMatches = currentUpcomingMatches.filter((match) => match.leagueKey === leagueKey);
    const localMatches = (currentLocalMatches.length > 0
      ? currentLocalMatches
      : brazilianFixtures[leagueKey as keyof typeof brazilianFixtures] || []) as Array<{
      id?: string | number;
      homeTeam: string;
      awayTeam: string;
      date: string;
      round?: string | number;
      referee?: string | null;
      venue?: string | null;
    }>;
    const today = saoPauloDateString();

    const upcomingMatches = localMatches.filter((match) => {
      return dateOnly(match.date) >= today;
    });

    const fixtures = upcomingMatches.map((match, idx) => ({
      id: String(match.id || idx + 1),
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeTeamId: '',
      awayTeamId: '',
      homeTeamBadge: null,
      awayTeamBadge: null,
      date: match.date.split(' ')[0],
      time: match.date.split(' ')[1] || '00:00',
      timestamp: match.date.includes('T') ? match.date : match.date.replace(' ', 'T') + ':00',
      round: match.round
        ? String(match.round).startsWith('Rodada')
          ? String(match.round)
          : `Rodada ${match.round}`
        : 'Rodada',
      referee: match.referee || null,
      venue: match.venue || null,
    }));

    return NextResponse.json({
      league: leagueKey,
      leagueName: league.name,
      season: league.season,
      fixtures,
      source: 'local',
      lastUpdated: new Date().toISOString(),
    });
  }

  // For other leagues, use TheSportsDB eventsseason.php (free tier)
  try {
    const url = `${THESPORTSDB_BASE}/eventsseason.php?id=${league.id}&s=${league.season}`;
    const response = await fetch(url, { headers: THESPORTSDB_HEADERS });

    if (!response.ok) {
      throw new Error(`TheSportsDB API error ${response.status}`);
    }

    const data = (await response.json()) as { events?: TheSportsDBEvent[] };

    if (!data.events || data.events.length === 0) {
      // Fallback: next 5 events
      const fallbackUrl = `${THESPORTSDB_BASE}/eventsnextleague.php?id=${league.id}`;
      const fallbackRes = await fetch(fallbackUrl, { headers: THESPORTSDB_HEADERS });
      if (fallbackRes.ok) {
        const fallbackData = (await fallbackRes.json()) as { events?: TheSportsDBEvent[] };
        const fallbackFixtures = (fallbackData.events || []).map((event) => ({
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
          round: event.intRound ? `Rodada ${event.intRound}` : 'Rodada',
          referee: event.strOfficial || null,
          venue: event.strVenue,
        }));
        return NextResponse.json({
          league: leagueKey,
          leagueName: league.name,
          season: league.season,
          fixtures: fallbackFixtures,
          lastUpdated: new Date().toISOString(),
        });
      }
      return NextResponse.json({ league: leagueKey, leagueName: league.name, fixtures: [] });
    }

    // Filter only upcoming/future events
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcomingEvents = data.events.filter((event) => {
      if (!event.dateEvent) return false;
      // Skip games that already have scores
      if (
        event.intHomeScore !== null &&
        event.intHomeScore !== '' &&
        event.intAwayScore !== null &&
        event.intAwayScore !== ''
      )
        return false;
      const matchDate = new Date(event.dateEvent);
      return matchDate >= now;
    });

    const fixtures = upcomingEvents.map((event) => ({
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

    fixtures.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({
      league: leagueKey,
      leagueName: league.name,
      season: league.season,
      fixtures,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('TheSportsDB next fixtures error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch next fixtures',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
