/**
 * Live matches endpoint — uses Sofascore as primary source (most reliable),
 * with API-Football as secondary source for corner statistics.
 *
 * Sofascore's /sport/football/events/live returns ALL live football matches globally.
 */
import { NextResponse } from 'next/server';

interface LiveMatch {
  id: number;
  minute: number | string;
  statusText: string;
  homeTeam: { id: number; name: string; score: number };
  awayTeam: { id: number; name: string; score: number };
  competition?: string;
  competitionId: number;
  corners?: { home: number; away: number; total: number };
  source?: string;
}

async function fetchFrom365Scores(): Promise<LiveMatch[]> {
  try {
    const res = await fetch('https://webws.365scores.com/web/games/?appTypeId=5&langId=31&statuses=2', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      games?: Array<{
        id: number;
        sportId?: number;
        statusGroup?: number;
        statusText?: string;
        gameTime?: number;
        competitionId?: number;
        competitionDisplayName?: string;
        competition?: { name?: string };
        homeCompetitor?: { id?: number; name?: string; score?: number; sportId?: number };
        awayCompetitor?: { id?: number; name?: string; score?: number; sportId?: number };
      }>;
    };

    return (data.games ?? [])
      .filter((game) => {
        const isFootball = game.sportId === 1 || game.homeCompetitor?.sportId === 1;
        return isFootball && game.statusGroup === 3 && game.homeCompetitor && game.awayCompetitor;
      })
      .map((game) => ({
        id: game.id,
        minute:
          typeof game.gameTime === 'number' && game.gameTime >= 0
            ? game.gameTime
            : game.statusText || 'AO VIVO',
        statusText: game.statusText || 'Ao vivo',
        homeTeam: {
          id: game.homeCompetitor?.id ?? 0,
          name: game.homeCompetitor?.name ?? 'Mandante',
          score: Math.max(0, game.homeCompetitor?.score ?? 0),
        },
        awayTeam: {
          id: game.awayCompetitor?.id ?? 0,
          name: game.awayCompetitor?.name ?? 'Visitante',
          score: Math.max(0, game.awayCompetitor?.score ?? 0),
        },
        competition: game.competitionDisplayName ?? game.competition?.name ?? 'Competicao',
        competitionId: game.competitionId ?? 0,
        source: '365scores',
      }));
  } catch (err) {
    console.error('[live/365scores] error:', err);
    return [];
  }
}

// ── Sofascore live (primary) ──────────────────────────────────────────────────

async function fetchFromSofascore(): Promise<LiveMatch[]> {
  try {
    const res = await fetch('https://api.sofascore.com/api/v1/sport/football/events/live', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        Referer: 'https://www.sofascore.com/',
        Origin: 'https://www.sofascore.com',
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.warn('[live/sofascore] status:', res.status);
      return [];
    }

    const data = (await res.json()) as {
      events?: Array<{
        id: number;
        startTimestamp: number;
        tournament?: {
          name: string;
          uniqueTournament?: { id?: number; name: string };
        };
        homeTeam: { id: number; name: string };
        awayTeam: { id: number; name: string };
        homeScore?: { current?: number; display?: number };
        awayScore?: { current?: number; display?: number };
        status?: { description?: string; type?: string; period?: string };
        time?: { currentPeriodStartTimestamp?: number; played?: number; extra?: number };
      }>;
    };

    const events = data.events ?? [];
    console.log('[live/sofascore] events:', events.length);

    return events.map((ev) => {
      // Calculate elapsed minutes
      let minute: number | string = ev.status?.description ?? 'AO VIVO';
      if (ev.time?.currentPeriodStartTimestamp && ev.status?.period) {
        const elapsed = Math.floor((Date.now() / 1000 - ev.time.currentPeriodStartTimestamp) / 60);
        if (ev.status.period === '1st' || ev.status.period === 'HT') {
          minute = Math.min(45, elapsed);
        } else if (ev.status.period === '2nd') {
          minute = Math.min(90, 45 + elapsed);
        } else if (ev.status.period === 'OT') {
          minute = 90 + elapsed;
        }
      }

      return {
        id: ev.id,
        minute,
        statusText: ev.status?.description ?? 'Ao vivo',
        homeTeam: {
          id: ev.homeTeam.id,
          name: ev.homeTeam.name,
          score: ev.homeScore?.current ?? ev.homeScore?.display ?? 0,
        },
        awayTeam: {
          id: ev.awayTeam.id,
          name: ev.awayTeam.name,
          score: ev.awayScore?.current ?? ev.awayScore?.display ?? 0,
        },
        competition: ev.tournament?.uniqueTournament?.name ?? ev.tournament?.name ?? 'Competição',
        competitionId: ev.tournament?.uniqueTournament?.id ?? 0,
        source: 'sofascore',
      };
    });
  } catch (err) {
    console.error('[live/sofascore] error:', err);
    return [];
  }
}

// ── API-Football live (for corner stats) ──────────────────────────────────────

async function fetchFromApiFootball(): Promise<LiveMatch[]> {
  const API_KEY = process.env.API_FOOTBALL_KEY || process.env.RAPIDAPI_KEY;
  if (!API_KEY) return [];

  try {
    const res = await fetch('https://v3.football.api-sports.io/fixtures?live=all', {
      headers: {
        'x-apisports-key': API_KEY,
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
      cache: 'no-store',
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      errors?: Record<string, string>;
      response?: Array<{
        fixture: {
          id: number;
          status: { elapsed?: number; short?: string; long?: string };
        };
        league: { id: number; name: string; country: string };
        teams: {
          home: { id: number; name: string };
          away: { id: number; name: string };
        };
        goals: { home: number | null; away: number | null };
        statistics?: Array<{
          team: { id: number };
          statistics: Array<{ type: string; value: number | string | null }>;
        }>;
      }>;
    };

    if (data.errors && Object.keys(data.errors).length > 0) return [];

    return (data.response ?? []).map((item) => {
      // Extract corner stats
      let corners: { home: number; away: number; total: number } | undefined = undefined;
      if (item.statistics && item.statistics.length >= 2) {
        const homeStats = item.statistics[0]?.statistics ?? [];
        const awayStats = item.statistics[1]?.statistics ?? [];
        const homeCornersRaw = homeStats.find((s) => s.type === 'Corner Kicks')?.value;
        const awayCornersRaw = awayStats.find((s) => s.type === 'Corner Kicks')?.value;
        const hc =
          typeof homeCornersRaw === 'number'
            ? homeCornersRaw
            : parseInt(String(homeCornersRaw ?? ''), 10);
        const ac =
          typeof awayCornersRaw === 'number'
            ? awayCornersRaw
            : parseInt(String(awayCornersRaw ?? ''), 10);
        if (!isNaN(hc) && !isNaN(ac)) {
          corners = { home: hc, away: ac, total: hc + ac };
        }
      }

      return {
        id: item.fixture.id,
        minute: item.fixture.status.elapsed ?? item.fixture.status.short ?? 'AO VIVO',
        statusText: item.fixture.status.long ?? 'Em andamento',
        homeTeam: {
          id: item.teams.home.id,
          name: item.teams.home.name,
          score: item.goals.home ?? 0,
        },
        awayTeam: {
          id: item.teams.away.id,
          name: item.teams.away.name,
          score: item.goals.away ?? 0,
        },
        competition: `${item.league.name} (${item.league.country})`,
        competitionId: item.league.id,
        corners,
        source: 'api-football',
      };
    });
  } catch (err) {
    console.error('[live/api-football] error:', err);
    return [];
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const [scores365Result, sofascoreResult, apiFootballResult] = await Promise.allSettled([
      fetchFrom365Scores(),
      fetchFromSofascore(),
      fetchFromApiFootball(),
    ]);

    const scores365Matches = scores365Result.status === 'fulfilled' ? scores365Result.value : [];
    const sfMatches = sofascoreResult.status === 'fulfilled' ? sofascoreResult.value : [];
    const afMatches = apiFootballResult.status === 'fulfilled' ? apiFootballResult.value : [];

    // Merge: use 365Scores/Sofascore as base, enrich with API-Football corner data
    const seenKeys = new Set<string>();
    const allMatches: LiveMatch[] = [];

    // Build a lookup for API-Football corners by team name key
    const afCornersByKey = new Map<string, { home: number; away: number; total: number }>();
    for (const m of afMatches) {
      const key = `${m.homeTeam.name.toLowerCase()}-${m.awayTeam.name.toLowerCase()}`;
      if (m.corners) {
        afCornersByKey.set(key, m.corners);
      }
    }

    for (const m of [...scores365Matches, ...sfMatches]) {
      const key = `${m.homeTeam.name.toLowerCase()}-${m.awayTeam.name.toLowerCase()}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const corners = afCornersByKey.get(key);
        allMatches.push({ ...m, corners: corners ?? m.corners });
      }
    }

    // Add API-Football matches not in Sofascore
    for (const m of afMatches) {
      const key = `${m.homeTeam.name.toLowerCase()}-${m.awayTeam.name.toLowerCase()}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        allMatches.push(m);
      }
    }

    return NextResponse.json({
      matches: allMatches,
      count: allMatches.length,
      lastUpdated: new Date().toISOString(),
      sources: {
        scores365: scores365Matches.length,
        sofascore: sfMatches.length,
        apiFootball: afMatches.length,
      },
    });
  } catch (error) {
    console.error('[live] error:', error);
    return NextResponse.json(
      { matches: [], error: 'Failed to fetch live matches' },
      { status: 500 }
    );
  }
}
