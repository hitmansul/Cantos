import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import {
  THESPORTSDB_BASE,
  THESPORTSDB_LEAGUES,
  THESPORTSDB_HEADERS,
  type TheSportsDBEvent,
} from '@/app/api/utils/thesportsdb';
import { SCORES365_COMPETITIONS, scores365Get } from '@/app/api/utils/scores365';
import { isAdmin } from '@/app/api/utils/adminAuth';

// ─── Match shape ───────────────────────────────────────────────────────────────

interface ImportedMatch {
  home_team: string;
  away_team: string;
  match_date: string;
  match_time: string | null;
  league: string;
  round: string | null;
  referee: string | null;
}

// ─── TheSportsDB ───────────────────────────────────────────────────────────────

async function fetchFromTheSportsDB(leagueKey: string): Promise<{
  matches: ImportedMatch[];
  leagueName: string;
  count: number;
  error?: string;
}> {
  const league = THESPORTSDB_LEAGUES[leagueKey];
  if (!league)
    return { matches: [], leagueName: leagueKey, count: 0, error: 'Liga não encontrada' };

  const today = new Date().toISOString().split('T')[0];

  try {
    const url = `${THESPORTSDB_BASE}/eventsseason.php?id=${league.id}&s=${league.season}`;
    const response = await fetch(url, { headers: THESPORTSDB_HEADERS });
    if (!response.ok) throw new Error(`TheSportsDB erro ${response.status}`);

    const data = (await response.json()) as { events?: TheSportsDBEvent[] };
    if (!data.events || data.events.length === 0) {
      return { matches: [], leagueName: league.name, count: 0, error: 'Nenhum jogo retornado' };
    }

    const matches = data.events
      .filter((e) => {
        if (!e.dateEvent) return false;
        if (e.strStatus === 'Match Finished') return false;
        return e.dateEvent >= today;
      })
      .map((e) => ({
        home_team: e.strHomeTeam,
        away_team: e.strAwayTeam,
        match_date: e.dateEvent,
        match_time: e.strTime ? e.strTime.substring(0, 5) : null,
        league: leagueKey, // ← correct league key always stored
        round: e.intRound ? String(e.intRound) : null,
        referee: e.strOfficial || null,
      }));

    return { matches, leagueName: league.name, count: matches.length };
  } catch (err) {
    return {
      matches: [],
      leagueName: league.name,
      count: 0,
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    };
  }
}

// ─── 365Scores ────────────────────────────────────────────────────────────────

async function fetchFrom365Scores(leagueKey: string): Promise<{
  matches: ImportedMatch[];
  leagueName: string;
  count: number;
  error?: string;
}> {
  const competition = SCORES365_COMPETITIONS[leagueKey];
  if (!competition)
    return { matches: [], leagueName: leagueKey, count: 0, error: 'Competição não encontrada' };

  const today = new Date().toISOString().split('T')[0];

  // Try multiple endpoints — 365Scores has different APIs for different regions
  const endpoints = [
    // Endpoint 1: scheduled games for a competition
    `/web/games/scheduled/?competitions=${competition.id}&sports=1`,
    // Endpoint 2: generic games (with pagination)
    `/web/games/?competitions=${competition.id}&sports=1&startDate=${today}`,
  ];

  for (const path of endpoints) {
    try {
      const data = (await scores365Get(path, {})) as {
        games?: Array<{
          id: number;
          startTime: string;
          roundNum?: number;
          roundName?: string;
          competitionId?: number; // ← KEY: only keep games from this competition
          statusGroup?: number; // 1=scheduled, 2=live, 3=finished
          homeCompetitor: { id: number; name: string };
          awayCompetitor: { id: number; name: string };
        }>;
      };

      if (!data.games || data.games.length === 0) continue;

      const matches = data.games
        .filter((g) => {
          // Only skip finished games and past dates — remove the overly strict competitionId filter
          if (g.statusGroup === 3) return false; // skip finished
          const gameDate = new Date(g.startTime).toISOString().split('T')[0];
          return gameDate >= today;
        })
        .map((g) => {
          const dt = new Date(g.startTime);
          const dateStr = dt.toISOString().split('T')[0];
          const h = String(dt.getUTCHours()).padStart(2, '0');
          const m = String(dt.getUTCMinutes()).padStart(2, '0');
          return {
            home_team: g.homeCompetitor.name,
            away_team: g.awayCompetitor.name,
            match_date: dateStr,
            match_time: `${h}:${m}`,
            league: leagueKey, // ← correct league key always stored
            round: g.roundNum ? String(g.roundNum) : g.roundName || null,
            referee: null,
          };
        });

      if (matches.length > 0) {
        return { matches, leagueName: competition.name, count: matches.length };
      }
    } catch {
      // try next endpoint
    }
  }

  // Fallback: try standings to extract nextMatch info
  try {
    const standingsData = (await scores365Get('/web/standings/', {
      competitions: competition.id.toString(),
    })) as {
      standings?: Array<{
        rows: Array<{
          nextMatch?: {
            id: number;
            startTime: string;
            roundNum?: number;
            roundName?: string;
            homeCompetitor: { id: number; name: string };
            awayCompetitor: { id: number; name: string };
          };
        }>;
      }>;
    };

    if (standingsData.standings && standingsData.standings.length > 0) {
      const matchesMap = new Map<number, ImportedMatch>();
      for (const row of standingsData.standings[0].rows) {
        const m = row.nextMatch;
        if (!m || matchesMap.has(m.id)) continue;
        const dt = new Date(m.startTime);
        const dateStr = dt.toISOString().split('T')[0];
        if (dateStr < today) continue;
        const h = String(dt.getUTCHours()).padStart(2, '0');
        const min = String(dt.getUTCMinutes()).padStart(2, '0');
        matchesMap.set(m.id, {
          home_team: m.homeCompetitor.name,
          away_team: m.awayCompetitor.name,
          match_date: dateStr,
          match_time: `${h}:${min}`,
          league: leagueKey,
          round: m.roundNum ? String(m.roundNum) : m.roundName || null,
          referee: null,
        });
      }
      const matches = Array.from(matchesMap.values());
      if (matches.length > 0) {
        return { matches, leagueName: competition.name, count: matches.length };
      }
    }
  } catch {
    // fallback also failed
  }

  return {
    matches: [],
    leagueName: competition.name,
    count: 0,
    error: 'Nenhum jogo encontrado em todas as tentativas',
  };
}

// ─── Save matches to DB ────────────────────────────────────────────────────────

async function saveMatches(
  matches: ImportedMatch[]
): Promise<{ inserted: number; skipped: number; errors: number }> {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const match of matches) {
    try {
      const existing = await sql`
        SELECT id FROM upcoming_matches
        WHERE home_team = ${match.home_team}
          AND away_team = ${match.away_team}
          AND match_date = ${match.match_date}
        LIMIT 1
      `;
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await sql`
        INSERT INTO upcoming_matches
          (home_team, away_team, match_date, match_time, league, round, referee, is_completed)
        VALUES
          (${match.home_team}, ${match.away_team}, ${match.match_date},
           ${match.match_time}, ${match.league}, ${match.round}, ${match.referee}, 0)
      `;
      inserted++;
    } catch (err) {
      console.error('Error inserting match:', err, JSON.stringify(match));
      errors++;
    }
  }
  return { inserted, skipped, errors };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    leagues,
    source = 'auto',
    previewOnly = false,
  } = body as {
    leagues: string[];
    source?: 'thesportsdb' | '365scores' | 'auto';
    previewOnly?: boolean;
  };

  if (!leagues || leagues.length === 0) {
    return NextResponse.json({ error: 'Selecione pelo menos uma liga' }, { status: 400 });
  }

  const results: Array<{
    league: string;
    leagueName: string;
    fetched: number;
    inserted: number;
    skipped: number;
    error?: string;
    // for auto mode when both sources return data
    conflict?: {
      sources: Array<{ name: string; count: number; sample: string[] }>;
      matches365: ImportedMatch[];
      matchesSportsDB: ImportedMatch[];
    };
  }> = [];

  let totalInserted = 0;

  for (const leagueKey of leagues) {
    if (source === 'auto') {
      // Try BOTH sources in parallel and compare
      const [r365, rSDB] = await Promise.all([
        fetchFrom365Scores(leagueKey),
        fetchFromTheSportsDB(leagueKey),
      ]);

      const has365 = r365.matches.length > 0;
      const hasSDB = rSDB.matches.length > 0;

      if (!has365 && !hasSDB) {
        results.push({
          league: leagueKey,
          leagueName: r365.leagueName || rSDB.leagueName || leagueKey,
          fetched: 0,
          inserted: 0,
          skipped: 0,
          error: `365Scores: ${r365.error ?? 'sem dados'} | TheSportsDB: ${rSDB.error ?? 'sem dados'}`,
        });
        continue;
      }

      // If both have data → flag as conflict so the UI can ask the user
      if (has365 && hasSDB && !previewOnly) {
        const sample365 = r365.matches.slice(0, 3).map((m) => `${m.home_team} vs ${m.away_team}`);
        const sampleSDB = rSDB.matches.slice(0, 3).map((m) => `${m.home_team} vs ${m.away_team}`);
        results.push({
          league: leagueKey,
          leagueName: r365.leagueName,
          fetched: 0,
          inserted: 0,
          skipped: 0,
          conflict: {
            sources: [
              { name: '365Scores', count: r365.matches.length, sample: sample365 },
              { name: 'TheSportsDB', count: rSDB.matches.length, sample: sampleSDB },
            ],
            matches365: r365.matches,
            matchesSportsDB: rSDB.matches,
          },
        });
        continue;
      }

      // Only one has data — just use it
      const winner = has365 ? r365 : rSDB;
      if (!previewOnly) {
        const { inserted, skipped, errors: insertErrors } = await saveMatches(winner.matches);
        totalInserted += inserted;
        results.push({
          league: leagueKey,
          leagueName: winner.leagueName,
          fetched: winner.matches.length,
          inserted,
          skipped,
          error: insertErrors > 0 ? `${insertErrors} erros ao inserir` : undefined,
        });
      } else {
        results.push({
          league: leagueKey,
          leagueName: winner.leagueName,
          fetched: winner.matches.length,
          inserted: 0,
          skipped: 0,
        });
      }
    } else {
      // Explicit source
      const fetchResult =
        source === '365scores'
          ? await fetchFrom365Scores(leagueKey)
          : await fetchFromTheSportsDB(leagueKey);

      if (fetchResult.error && fetchResult.matches.length === 0) {
        results.push({
          league: leagueKey,
          leagueName: fetchResult.leagueName,
          fetched: 0,
          inserted: 0,
          skipped: 0,
          error: fetchResult.error,
        });
        continue;
      }

      if (!previewOnly) {
        const { inserted, skipped, errors: insertErrors } = await saveMatches(fetchResult.matches);
        totalInserted += inserted;
        results.push({
          league: leagueKey,
          leagueName: fetchResult.leagueName,
          fetched: fetchResult.matches.length,
          inserted,
          skipped,
          error: insertErrors > 0 ? `${insertErrors} erros ao inserir` : undefined,
        });
      } else {
        results.push({
          league: leagueKey,
          leagueName: fetchResult.leagueName,
          fetched: fetchResult.matches.length,
          inserted: 0,
          skipped: 0,
        });
      }
    }
  }

  const conflicts = results.filter((r) => r.conflict);

  return NextResponse.json({
    imported: totalInserted,
    skipped: results.reduce((acc, r) => acc + r.skipped, 0),
    errors: results.filter((r) => r.error).length,
    hasConflicts: conflicts.length > 0,
    conflicts: conflicts.map((r) => ({
      league: r.league,
      leagueName: r.leagueName,
      sources: r.conflict?.sources,
      matches365: r.conflict?.matches365,
      matchesSportsDB: r.conflict?.matchesSportsDB,
    })),
    leagues: results
      .filter((r) => !r.conflict)
      .map((r) => ({
        league: r.leagueName || r.league,
        imported: r.inserted,
        skipped: r.skipped,
        error: r.error,
      })),
  });
}

// GET: list available leagues per source
export async function GET() {
  const scores365Obj: Record<string, { name: string }> = {};
  for (const [key, val] of Object.entries(SCORES365_COMPETITIONS)) {
    scores365Obj[key] = { name: val.name };
  }
  const sportsdbObj: Record<string, { name: string }> = {};
  for (const [key, val] of Object.entries(THESPORTSDB_LEAGUES)) {
    sportsdbObj[key] = { name: val.name };
  }
  return NextResponse.json({ '365scores': scores365Obj, thesportsdb: sportsdbObj });
}
