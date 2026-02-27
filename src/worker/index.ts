import { Hono } from "hono";
import { cors } from "hono/cors";
import { getLeagues, fetchLeagueStats, fetchH2HStats } from "./footballData";
import { 
  scrapeCornerStats, 
  scrapeTeamDetails, 
  scrapeUpcomingMatches,
  getAvailableScrapingLeagues 
} from "./cornerStatsScraper";

interface AppEnv {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  THE_ODDS_API_KEY: string;
  FIRECRAWL_API_KEY: string;
  RAPIDAPI_KEY: string;
  // New providers
  APIFOOTBALL_KEY: string;
  THESPORTSDB_KEY: string;
}

const app = new Hono<{ Bindings: AppEnv }>();

app.use("/*", cors());

// ============================================================
// API-Football (API-Sports) + TheSportsDB
// ============================================================

const APIFOOTBALL_BASE = "https://v3.football.api-sports.io";
const THESPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json";

async function apiFootballGet(pathWithQuery: string, apiKey: string) {
  const url = `${APIFOOTBALL_BASE}${pathWithQuery}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-apisports-key": apiKey,
      "Accept": "application/json",
    },
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`API-Football returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const msg = data?.message || data?.errors || text;
    throw new Error(`API-Football error ${res.status}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
  }
  return data;
}

async function sportsDbGet(pathWithQuery: string, key: string) {
  const url = `${THESPORTSDB_BASE}/${encodeURIComponent(key)}${pathWithQuery}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TheSportsDB error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function resolveApiFootballSeason(apiKey: string, leagueId: number, requestedSeason?: number) {
  const leagues = await apiFootballGet(`/leagues?id=${leagueId}`, apiKey);
  const seasons: number[] = (leagues?.response?.[0]?.seasons || [])
    .map((s: any) => Number(s?.year))
    .filter((n: any) => Number.isFinite(n));
  const unique = Array.from(new Set(seasons)).sort((a, b) => b - a);

  // API-Football pode listar temporadas que o seu plano não permite consultar.
  // Ex.: em planos free, o endpoint pode retornar errors.plan para temporadas futuras.
  const candidates = Array.from(
    new Set([
      ...(requestedSeason ? [requestedSeason] : []),
      ...unique,
    ].filter((n) => Number.isFinite(n)))
  );

  let chosen = candidates[0] ?? new Date().getFullYear();
  for (const year of candidates) {
    try {
      const probe = await apiFootballGet(`/fixtures?league=${leagueId}&season=${year}&next=1`, apiKey);
      if (probe?.errors?.plan) continue;
      chosen = year;
      break;
    } catch {
      // tenta o próximo
    }
  }

  return { seasons: unique, chosen };
}

app.get("/api/apifootball/test", async (c) => {
  const apiKey = c.env.APIFOOTBALL_KEY;
  if (!apiKey) return c.json({ error: "APIFOOTBALL_KEY not configured" }, 500);
  try {
    const data = await apiFootballGet(`/timezone`, apiKey);
    return c.json({ ok: true, sample: Array.isArray(data?.response) ? data.response.slice(0, 5) : data?.response });
  } catch (e) {
    return c.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.get("/api/apifootball/seasons", async (c) => {
  const apiKey = c.env.APIFOOTBALL_KEY;
  if (!apiKey) return c.json({ error: "APIFOOTBALL_KEY not configured" }, 500);
  const league = Number(c.req.query("league"));
  const requestedSeason = c.req.query("season") ? Number(c.req.query("season")) : undefined;
  if (!Number.isFinite(league)) return c.json({ error: "league is required (number)" }, 400);
  try {
    const info = await resolveApiFootballSeason(apiKey, league, requestedSeason);
    return c.json(info);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.get("/api/apifootball/fixtures", async (c) => {
  const apiKey = c.env.APIFOOTBALL_KEY;
  if (!apiKey) return c.json({ error: "APIFOOTBALL_KEY not configured" }, 500);
  const league = Number(c.req.query("league"));
  const season = c.req.query("season") ? Number(c.req.query("season")) : undefined;
  const next = c.req.query("next") ? Number(c.req.query("next")) : 50;
  const mode = (c.req.query("mode") || "upcoming") as "upcoming" | "all";
  if (!Number.isFinite(league)) return c.json({ error: "league is required (number)" }, 400);

  try {
    const { chosen } = await resolveApiFootballSeason(apiKey, league, season);
    const cacheKey = `apifootball:fixtures:${league}:${chosen}:${mode}:${next}`;
    const cached = cacheGet<any>(cacheKey);
    if (cached) {
      c.header("Cache-Control", "no-store");
      return c.json(cached);
    }
    const data = await apiFootballGet(`/fixtures?league=${league}&season=${chosen}&next=${Math.min(next, 100)}`, apiKey);
    const fixtures = (data?.response || []).map((item: any) => ({
      id: item?.fixture?.id,
      timestamp: item?.fixture?.timestamp,
      date: item?.fixture?.date,
      status: item?.fixture?.status,
      league: item?.league,
      teams: item?.teams,
      goals: item?.goals,
      score: item?.score,
    }));
    const now = Date.now();
    const filtered = mode === "upcoming"
      ? fixtures.filter((f: any) => {
          const t = Number(f?.timestamp) ? Number(f.timestamp) * 1000 : Date.parse(f?.date);
          return Number.isFinite(t) && t >= now;
        })
      : fixtures;

    const payload = {
      provider: "API-Football",
      league,
      seasonRequested: season ?? null,
      seasonUsed: chosen,
      count: filtered.length,
      fixtures: filtered,
      rawErrors: data?.errors || null,
    };
    cacheSet(cacheKey, payload, 30_000);
    c.header("Cache-Control", "no-store");
    return c.json(payload);
  } catch (e) {
    return c.json({
      error: e instanceof Error ? e.message : String(e),
      hint: "Free plans may block future seasons. Check /api/apifootball/seasons?league=39",
    }, 500);
  }
});

app.get("/api/apifootball/standings", async (c) => {
  const apiKey = c.env.APIFOOTBALL_KEY;
  if (!apiKey) return c.json({ error: "APIFOOTBALL_KEY not configured" }, 500);
  const league = Number(c.req.query("league"));
  const season = c.req.query("season") ? Number(c.req.query("season")) : undefined;
  if (!Number.isFinite(league)) return c.json({ error: "league is required (number)" }, 400);
  try {
    const { chosen } = await resolveApiFootballSeason(apiKey, league, season);
    const cacheKey = `apifootball:standings:${league}:${chosen}`;
    const cached = cacheGet<any>(cacheKey);
    if (cached) {
      c.header("Cache-Control", "no-store");
      return c.json(cached);
    }
    const data = await apiFootballGet(`/standings?league=${league}&season=${chosen}`, apiKey);
    const payload = { provider: "API-Football", league, seasonUsed: chosen, data };
    cacheSet(cacheKey, payload, 60_000);
    c.header("Cache-Control", "no-store");
    return c.json(payload);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.get("/api/thesportsdb/test", async (c) => {
  const key = c.env.THESPORTSDB_KEY;
  if (!key) return c.json({ error: "THESPORTSDB_KEY not configured" }, 500);
  try {
    const data = await sportsDbGet(`/searchteams.php?t=Arsenal`, key);
    return c.json({ ok: true, teamsFound: Array.isArray((data as any)?.teams) ? (data as any).teams.length : 0 });
  } catch (e) {
    return c.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// ============================================
// Football-Data.co.uk Corner Statistics API
// ============================================

// Get all available leagues
app.get("/api/corner-stats/leagues", (c) => {
  const leagues = getLeagues();
  return c.json(leagues);
});

// Get statistics for a specific league
app.get("/api/corner-stats/league/:leagueId", async (c) => {
  const leagueId = c.req.param("leagueId");
  
  // Handle Brazilian league separately (uses local data)
  if (leagueId === "BR1") {
    return c.json({ 
      error: "Brazilian league uses local data",
      message: "Use /api/corner-stats/brazil endpoint for Brazilian teams"
    }, 400);
  }
  
  const stats = await fetchLeagueStats(leagueId);
  
  if (!stats) {
    return c.json({ error: "League not found or failed to fetch data" }, 404);
  }
  
  return c.json(stats);
});

// Get statistics for multiple leagues at once
app.get("/api/corner-stats/leagues/batch", async (c) => {
  const leagueIds = c.req.query("ids")?.split(",") || [];
  
  if (leagueIds.length === 0) {
    return c.json({ error: "No league IDs provided" }, 400);
  }
  
  // Limit to 5 leagues at once to avoid timeout
  const limitedIds = leagueIds.slice(0, 5);
  
  const results = await Promise.all(
    limitedIds.map(id => fetchLeagueStats(id))
  );
  
  const successfulResults = results.filter(r => r !== null);
  
  return c.json({
    leagues: successfulResults,
    requested: limitedIds.length,
    successful: successfulResults.length,
  });
});

// Get head-to-head statistics between two teams
app.get("/api/corner-stats/h2h/:leagueId", async (c) => {
  const leagueId = c.req.param("leagueId");
  const team1 = c.req.query("team1");
  const team2 = c.req.query("team2");
  
  if (!team1 || !team2) {
    return c.json({ error: "Both team1 and team2 parameters are required" }, 400);
  }
  
  const h2hStats = await fetchH2HStats(leagueId, team1, team2);
  
  if (!h2hStats) {
    return c.json({ error: "League not found or failed to fetch data" }, 404);
  }
  
  return c.json(h2hStats);
});

// Search for a team across all leagues
app.get("/api/corner-stats/search", async (c) => {
  const query = c.req.query("q")?.toLowerCase() || "";
  
  if (query.length < 2) {
    return c.json({ error: "Search query must be at least 2 characters" }, 400);
  }
  
  // Search in top 5 leagues for now
  const topLeagues = ["E0", "SP1", "I1", "D1", "F1"];
  const results: any[] = [];
  
  for (const leagueId of topLeagues) {
    const stats = await fetchLeagueStats(leagueId);
    if (stats) {
      const matchingTeams = stats.teams.filter(t => 
        t.team.toLowerCase().includes(query)
      );
      results.push(...matchingTeams);
    }
  }
  
  return c.json({
    query,
    results: results.slice(0, 20), // Limit results
    totalFound: results.length,
  });
});

const API_BASE = "https://api.the-odds-api.com/v4";

// Simple in-memory cache (persists between requests on warm Workers)
type CacheEntry<T> = { expiresAt: number; value: T };
const memCache = new Map<string, CacheEntry<any>>();

function cacheGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function cacheSet<T>(key: string, value: T, ttlMs: number) {
  memCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// Brazilian and international soccer sport keys
const SOCCER_SPORTS = [
  "soccer_brazil_campeonato",      // Brasileirão Série A
  "soccer_brazil_serie_b",          // Brasileirão Série B
  "soccer_conmebol_copa_libertadores", // Libertadores
  "soccer_conmebol_copa_sudamericana", // Sul-Americana
  "soccer_epl",                     // Premier League
  "soccer_spain_la_liga",           // La Liga
  "soccer_italy_serie_a",           // Serie A Italia
  "soccer_germany_bundesliga",      // Bundesliga
  "soccer_france_ligue_one",        // Ligue 1
  "soccer_uefa_champs_league",      // Champions League
];

// Helper to make API requests to The Odds API
async function oddsApiGet(path: string, apiKey: string, params: Record<string, string> = {}) {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("apiKey", apiKey);
  
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`The Odds API error ${response.status}: ${text}`);
  }

  return response.json();
}

// Get available sports
app.get("/api/sports", async (c) => {
  const apiKey = c.env.THE_ODDS_API_KEY;
  
  if (!apiKey) {
    return c.json({ error: "API key not configured" }, 500);
  }

  try {
    const sports = await oddsApiGet("/sports", apiKey);
    // Filter to only soccer sports
    const soccerSports = (sports as any[]).filter((s: any) => 
      s.key.startsWith("soccer_") && s.active
    );
    return c.json(soccerSports);
  } catch (error) {
    console.error("Error fetching sports:", error);
    return c.json({ error: "Failed to fetch sports" }, 500);
  }
});

// Get bookmakers (static list of available bookmakers from The Odds API)
// Note: Bet365, Betano, KTO, Estrela are NOT available in the free tier
app.get("/api/bookmakers", async (c) => {
  const bookmakers = AVAILABLE_BOOKMAKERS.map(b => ({
    key: b.key,
    title: b.title,
  }));
  return c.json(bookmakers);
});

// Bookmakers actually available for soccer totals odds in EU/UK regions
const AVAILABLE_BOOKMAKERS = [
  { key: "pinnacle", title: "Pinnacle" },
  { key: "williamhill", title: "William Hill" },
  { key: "onexbet", title: "1xBet" },
  { key: "nordicbet", title: "Nordic Bet" },
  { key: "betsson", title: "Betsson" },
  { key: "unibet_nl", title: "Unibet (NL)" },
  { key: "unibet_se", title: "Unibet (SE)" },
  { key: "leovegas", title: "LeoVegas" },
  { key: "leovegas_se", title: "LeoVegas (SE)" },
  { key: "casumo", title: "Casumo" },
  { key: "grosvenor", title: "Grosvenor" },
  { key: "tipico_de", title: "Tipico" },
  { key: "betonlineag", title: "BetOnline.ag" },
  { key: "coolbet", title: "Coolbet" },
  { key: "matchbook", title: "Matchbook" },
];

// Get live/upcoming events (fixtures)
app.get("/api/fixtures", async (c) => {
  const apiKey = c.env.THE_ODDS_API_KEY;
  const sportKey = c.req.query("sport") || "";
  const mode = (c.req.query("mode") || "upcoming") as "upcoming" | "all";
  
  if (!apiKey) {
    return c.json({ error: "API key not configured" }, 500);
  }

  try {
    const cacheKey = `fixtures:${mode}:${sportKey || "ALL"}`;
    const cached = cacheGet<any[]>(cacheKey);
    if (cached) {
      c.header("Cache-Control", "no-store");
      return c.json(cached);
    }

    const allEvents: any[] = [];
    
    // If specific sport requested, only fetch that one
    const sportsToFetch = sportKey ? [sportKey] : SOCCER_SPORTS;
    
    for (const sport of sportsToFetch) {
      try {
        const events = await oddsApiGet(`/sports/${sport}/events`, apiKey, {
          dateFormat: "iso",
        });
        
        if (Array.isArray(events)) {
          // Add sport info to each event
          for (const event of events) {
            allEvents.push({
              ...event,
              sport_key: sport,
            });
          }
        }
      } catch (err) {
        // Sport might not have events, continue
        console.log(`No events for ${sport}`);
      }
    }

    // Sort by commence time
    allEvents.sort((a, b) => 
      new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
    );

    // Filter out past events for upcoming mode
    const nowMs = Date.now();
    const filteredEvents = mode === "upcoming"
      ? allEvents.filter(e => {
          const t = new Date(e.commence_time).getTime();
          return Number.isFinite(t) && t >= nowMs;
        })
      : allEvents;

    // Transform to our format
    const fixtures = filteredEvents.map(event => ({
      id: event.id,
      sportKey: event.sport_key,
      sportTitle: event.sport_title || formatSportName(event.sport_key),
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      commenceTime: event.commence_time,
    }));

    // cache for 30s to reduce rate-limit hits
    cacheSet(cacheKey, fixtures, 30_000);

    c.header("Cache-Control", "no-store");
    return c.json(fixtures);
  } catch (error) {
    console.error("Error fetching fixtures:", error);
    return c.json({ error: "Failed to fetch fixtures" }, 500);
  }
});

function formatSportName(key: string): string {
  const names: Record<string, string> = {
    soccer_brazil_campeonato: "Brasileirão Série A",
    soccer_brazil_serie_b: "Brasileirão Série B",
    soccer_conmebol_copa_libertadores: "Copa Libertadores",
    soccer_conmebol_copa_sudamericana: "Copa Sul-Americana",
    soccer_epl: "Premier League",
    soccer_spain_la_liga: "La Liga",
    soccer_italy_serie_a: "Serie A (Itália)",
    soccer_germany_bundesliga: "Bundesliga",
    soccer_france_ligue_one: "Ligue 1",
    soccer_uefa_champs_league: "Champions League",
  };
  return names[key] || key.replace("soccer_", "").replace(/_/g, " ");
}

// Get odds for a specific event or sport
app.get("/api/odds/:sportKey", async (c) => {
  const apiKey = c.env.THE_ODDS_API_KEY;
  const sportKey = c.req.param("sportKey");
  const eventIds = c.req.query("eventIds") || "";
  const bookmakers = c.req.query("bookmakers") || "";
  
  if (!apiKey) {
    return c.json({ error: "API key not configured" }, 500);
  }

  try {
    const params: Record<string, string> = {
      regions: "eu,uk",
      markets: "totals,h2h,spreads",
      oddsFormat: "decimal",
      dateFormat: "iso",
    };
    
    // Only filter by bookmakers if explicitly requested
    if (bookmakers) {
      params.bookmakers = bookmakers;
    }
    
    if (eventIds) {
      params.eventIds = eventIds;
    }

    const odds = await oddsApiGet(`/sports/${sportKey}/odds`, apiKey, params);
    return c.json(odds as Record<string, unknown>[]);
  } catch (error) {
    console.error("Error fetching odds:", error);
    return c.json({ error: "Failed to fetch odds" }, 500);
  }
});

// Get odds for a specific event by ID
app.get("/api/event/:eventId/odds", async (c) => {
  const apiKey = c.env.THE_ODDS_API_KEY;
  const eventId = c.req.param("eventId");
  const sportKey = c.req.query("sport") || "";
  const bookmakers = c.req.query("bookmakers") || "";
  
  if (!apiKey) {
    return c.json({ error: "API key not configured" }, 500);
  }

  if (!sportKey) {
    return c.json({ error: "Sport key is required" }, 400);
  }

  try {
    const params: Record<string, string> = {
      regions: "eu,uk",
      markets: "totals,h2h,spreads",
      oddsFormat: "decimal",
      dateFormat: "iso",
      eventIds: eventId,
    };
    
    // Only filter by bookmakers if explicitly requested
    if (bookmakers) {
      params.bookmakers = bookmakers;
    }

    const odds = await oddsApiGet(`/sports/${sportKey}/odds`, apiKey, params);
    
    // Return the first (and should be only) event
    if (Array.isArray(odds) && odds.length > 0) {
      return c.json(odds[0] as Record<string, unknown>);
    }
    
    return c.json({ error: "Event not found" }, 404);
  } catch (error) {
    console.error("Error fetching event odds:", error);
    return c.json({ error: "Failed to fetch odds" }, 500);
  }
});

// Helper to delay between API calls to avoid rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Get all odds for multiple sports at once (for dashboard)
app.get("/api/all-odds", async (c) => {
  const apiKey = c.env.THE_ODDS_API_KEY;
  const bookmakers = c.req.query("bookmakers") || "";
  
  if (!apiKey) {
    return c.json({ error: "API key not configured" }, 500);
  }

  try {
    const allOdds: any[] = [];
    const params: Record<string, string> = {
      regions: "eu,uk",
      markets: "totals",
      oddsFormat: "decimal",
      dateFormat: "iso",
    };
    
    // Only filter by bookmakers if explicitly requested
    if (bookmakers) {
      params.bookmakers = bookmakers;
    }
    
    // Fetch odds sequentially with delays to avoid rate limiting
    // The Odds API has strict rate limits on the free tier
    for (const sport of SOCCER_SPORTS) {
      try {
        const odds = await oddsApiGet(`/sports/${sport}/odds`, apiKey, params);
        
        if (Array.isArray(odds)) {
          allOdds.push(...odds);
          console.log(`Got ${odds.length} odds for ${sport}`);
        }
      } catch (err) {
        console.log(`No odds for ${sport}: ${err}`);
      }
      
      // Delay between requests to avoid hitting rate limits
      await delay(300);
    }

    // Sort by commence time
    allOdds.sort((a, b) => 
      new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
    );

    console.log(`Total odds returned: ${allOdds.length}`);
    return c.json(allOdds);
  } catch (error) {
    console.error("Error fetching all odds:", error);
    return c.json({ error: "Failed to fetch odds" }, 500);
  }
});

// ============================================
// Corner-Stats.com Scraping API (Real-time Brazilian data)
// ============================================

// Get available leagues for scraping
app.get("/api/scrape/leagues", (c) => {
  const leagues = getAvailableScrapingLeagues();
  return c.json(leagues);
});

// Scrape corner stats for a Brazilian league
app.get("/api/scrape/league/:leagueKey", async (c) => {
  const apiKey = c.env.FIRECRAWL_API_KEY;
  const leagueKey = c.req.param("leagueKey") as any;
  
  if (!apiKey) {
    return c.json({ 
      error: "Firecrawl API key not configured",
      message: "Please add your FIRECRAWL_API_KEY in Settings → Secrets"
    }, 500);
  }

  try {
    const data = await scrapeCornerStats(apiKey, leagueKey);
    
    if (!data) {
      return c.json({ 
        error: "Failed to scrape data",
        message: "Could not extract data from Corner-Stats.com"
      }, 500);
    }
    
    return c.json(data);
  } catch (error) {
    console.error("Scraping error:", error);
    return c.json({ 
      error: "Scraping failed",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Scrape detailed stats for a specific team
app.get("/api/scrape/team/:teamSlug", async (c) => {
  const apiKey = c.env.FIRECRAWL_API_KEY;
  const teamSlug = c.req.param("teamSlug");
  
  if (!apiKey) {
    return c.json({ 
      error: "Firecrawl API key not configured",
      message: "Please add your FIRECRAWL_API_KEY in Settings → Secrets"
    }, 500);
  }

  try {
    const data = await scrapeTeamDetails(apiKey, teamSlug);
    
    if (!data) {
      return c.json({ 
        error: "Failed to scrape team data",
        message: "Could not extract data for this team"
      }, 500);
    }
    
    return c.json(data);
  } catch (error) {
    console.error("Team scraping error:", error);
    return c.json({ 
      error: "Scraping failed",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Scrape upcoming matches with corner predictions
app.get("/api/scrape/upcoming/:leagueKey", async (c) => {
  const apiKey = c.env.FIRECRAWL_API_KEY;
  const leagueKey = c.req.param("leagueKey") as any;
  
  if (!apiKey) {
    return c.json({ 
      error: "Firecrawl API key not configured",
      message: "Please add your FIRECRAWL_API_KEY in Settings → Secrets"
    }, 500);
  }

  try {
    const matches = await scrapeUpcomingMatches(apiKey, leagueKey);
    
    if (!matches) {
      return c.json({ 
        error: "Failed to scrape upcoming matches",
        message: "Could not extract upcoming match data"
      }, 500);
    }
    
    return c.json({
      league: leagueKey,
      matches,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Upcoming matches scraping error:", error);
    return c.json({ 
      error: "Scraping failed",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});


// ============================================
// Sofascore API via RapidAPI (Real-time fixtures and statistics)
// ============================================

const SOFASCORE_BASE = "https://sofascore.p.rapidapi.com";

// Brazilian league IDs in Sofascore
const SOFASCORE_LEAGUES = {
  brasileirao_a: { tournamentId: 325, seasonId: 58766 }, // Brasileirão Série A 2026
  brasileirao_b: { tournamentId: 390, seasonId: 58767 }, // Brasileirão Série B 2026
};

// Helper to make API requests to Sofascore via RapidAPI
async function sofascoreGet(path: string, apiKey: string): Promise<Record<string, unknown>> {
  const url = `${SOFASCORE_BASE}${path}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-rapidapi-host": "sofascore.p.rapidapi.com",
      "x-rapidapi-key": apiKey,
    },
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sofascore API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

// Get next matches for a tournament (Brasileirão)
app.get("/api/sofascore/fixtures/:league", async (c) => {
  const apiKey = c.env.RAPIDAPI_KEY;
  const league = c.req.param("league") as keyof typeof SOFASCORE_LEAGUES;
  const pageIndex = c.req.query("page") || "0";
  
  if (!apiKey) {
    return c.json({ 
      error: "RapidAPI key not configured",
      message: "Please add your RAPIDAPI_KEY in Settings → Secrets"
    }, 500);
  }

  const leagueInfo = SOFASCORE_LEAGUES[league];
  if (!leagueInfo) {
    return c.json({ 
      error: "Invalid league",
      validLeagues: Object.keys(SOFASCORE_LEAGUES)
    }, 400);
  }

  try {
    const data = await sofascoreGet(
      `/tournaments/get-next-matches?tournamentId=${leagueInfo.tournamentId}&seasonId=${leagueInfo.seasonId}&pageIndex=${pageIndex}`,
      apiKey
    );
    
    return c.json(data);
  } catch (error) {
    console.error("Sofascore fixtures error:", error);
    return c.json({ 
      error: "Failed to fetch fixtures",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Get match details and statistics
app.get("/api/sofascore/match/:matchId", async (c) => {
  const apiKey = c.env.RAPIDAPI_KEY;
  const matchId = c.req.param("matchId");
  
  if (!apiKey) {
    return c.json({ 
      error: "RapidAPI key not configured",
      message: "Please add your RAPIDAPI_KEY in Settings → Secrets"
    }, 500);
  }

  try {
    const data = await sofascoreGet(`/matches/get-statistics?matchId=${matchId}`, apiKey);
    return c.json(data);
  } catch (error) {
    console.error("Sofascore match stats error:", error);
    return c.json({ 
      error: "Failed to fetch match statistics",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Get team statistics for a season
app.get("/api/sofascore/team/:teamId/stats", async (c) => {
  const apiKey = c.env.RAPIDAPI_KEY;
  const teamId = c.req.param("teamId");
  const tournamentId = c.req.query("tournamentId") || "325"; // Default: Brasileirão A
  const seasonId = c.req.query("seasonId") || "58766";
  
  if (!apiKey) {
    return c.json({ 
      error: "RapidAPI key not configured",
      message: "Please add your RAPIDAPI_KEY in Settings → Secrets"
    }, 500);
  }

  try {
    const data = await sofascoreGet(
      `/teams/get-statistics?teamId=${teamId}&tournamentId=${tournamentId}&seasonId=${seasonId}&type=overall`,
      apiKey
    );
    return c.json(data);
  } catch (error) {
    console.error("Sofascore team stats error:", error);
    return c.json({ 
      error: "Failed to fetch team statistics",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Search for a team
app.get("/api/sofascore/search", async (c) => {
  const apiKey = c.env.RAPIDAPI_KEY;
  const query = c.req.query("q") || "";
  
  if (!apiKey) {
    return c.json({ 
      error: "RapidAPI key not configured",
      message: "Please add your RAPIDAPI_KEY in Settings → Secrets"
    }, 500);
  }

  if (query.length < 2) {
    return c.json({ error: "Query must be at least 2 characters" }, 400);
  }

  try {
    const data = await sofascoreGet(`/search?query=${encodeURIComponent(query)}`, apiKey);
    return c.json(data);
  } catch (error) {
    console.error("Sofascore search error:", error);
    return c.json({ 
      error: "Failed to search",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Get standings for a tournament
app.get("/api/sofascore/standings/:league", async (c) => {
  const apiKey = c.env.RAPIDAPI_KEY;
  const league = c.req.param("league") as keyof typeof SOFASCORE_LEAGUES;
  
  if (!apiKey) {
    return c.json({ 
      error: "RapidAPI key not configured",
      message: "Please add your RAPIDAPI_KEY in Settings → Secrets"
    }, 500);
  }

  const leagueInfo = SOFASCORE_LEAGUES[league];
  if (!leagueInfo) {
    return c.json({ 
      error: "Invalid league",
      validLeagues: Object.keys(SOFASCORE_LEAGUES)
    }, 400);
  }

  try {
    const data = await sofascoreGet(
      `/tournaments/get-standings?tournamentId=${leagueInfo.tournamentId}&seasonId=${leagueInfo.seasonId}`,
      apiKey
    );
    return c.json(data);
  } catch (error) {
    console.error("Sofascore standings error:", error);
    return c.json({ 
      error: "Failed to fetch standings",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

export default app;
