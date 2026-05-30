// @ts-nocheck
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie } from "hono/cookie";
import {
  exchangeCodeForSessionToken,
  getOAuthRedirectUrl,
  authMiddleware,
  deleteSession,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
} from "@getmocha/users-service/backend";
import { GoogleGenAI } from "@google/genai";
import Firecrawl from "@mendable/firecrawl-js";
import { getLeagues, fetchLeagueStats, fetchH2HStats, fetchCardStats, fetchShotStats } from "./footballData";
import { 
  scrapeCornerStats, 
  scrapeTeamDetails, 
  scrapeUpcomingMatches,
  getAvailableScrapingLeagues 
} from "./cornerStatsScraper";
import { internationalFixtures } from "../data/internationalFixtures";

interface AppEnv {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  THE_ODDS_API_KEY: string;
  FIRECRAWL_API_KEY: string;
  GEMINI_API_KEY: string;
  MOCHA_USERS_SERVICE_API_URL: string;
  MOCHA_USERS_SERVICE_API_KEY: string;
}

const app = new Hono<{ Bindings: AppEnv }>();

app.use("/*", cors());

// ============================================
// Authentication Endpoints
// ============================================

// Get OAuth redirect URL
app.get("/api/oauth/google/redirect_url", async (c) => {
  const redirectUrl = await getOAuthRedirectUrl("google", {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });
  return c.json({ redirectUrl }, 200);
});

// Exchange code for session token
app.post("/api/sessions", async (c) => {
  const body = await c.req.json();

  if (!body.code) {
    return c.json({ error: "No authorization code provided" }, 400);
  }

  const sessionToken = await exchangeCodeForSessionToken(body.code, {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 24 * 60 * 60, // 60 days
  });

  return c.json({ success: true }, 200);
});

// Get current user
app.get("/api/users/me", authMiddleware, async (c) => {
  return c.json(c.get("user"));
});

// Logout
app.get("/api/logout", async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (typeof sessionToken === "string") {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
  }

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true }, 200);
});

// ============================================
// Admin API Endpoints (Protected)
// ============================================

// Check if user is admin
app.get("/api/admin/check", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ isAdmin: false }, 401);
  }
  
  // Check if user is in admin_users table
  const result = await c.env.DB.prepare(
    "SELECT * FROM admin_users WHERE user_id = ? AND is_active = 1"
  ).bind(user.id).first();
  
  return c.json({ isAdmin: !!result, user });
});

// Get all teams
app.get("/api/admin/teams", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM teams ORDER BY league, name"
  ).all();
  return c.json(results);
});

// Add/update team
app.post("/api/admin/teams", authMiddleware, async (c) => {
  const body = await c.req.json();
  const { id, name, short_name, league } = body;
  
  if (id) {
    await c.env.DB.prepare(
      "UPDATE teams SET name = ?, short_name = ?, league = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(name, short_name, league, id).run();
  } else {
    await c.env.DB.prepare(
      "INSERT INTO teams (name, short_name, league) VALUES (?, ?, ?)"
    ).bind(name, short_name, league).run();
  }
  
  return c.json({ success: true });
});

// Get team stats
app.get("/api/admin/team-stats", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT ts.*, t.name as team_name FROM team_stats ts LEFT JOIN teams t ON ts.team_id = t.id ORDER BY ts.season DESC, t.name"
  ).all();
  return c.json(results);
});

// Add/update team stats
app.post("/api/admin/team-stats", authMiddleware, async (c) => {
  const body = await c.req.json();
  const {
    id, team_id, season, games_played, avg_corners, home_avg, away_avg,
    over_85_pct, over_95_pct, over_105_pct, over_115_pct,
    home_games, away_games, games_winning, games_drawing, games_losing,
    corners_when_winning, corners_when_drawing, corners_when_losing,
    last_5_avg, recent_matches
  } = body;
  
  if (id) {
    await c.env.DB.prepare(`
      UPDATE team_stats SET 
        team_id = ?, season = ?, games_played = ?, avg_corners = ?, home_avg = ?, away_avg = ?,
        over_85_pct = ?, over_95_pct = ?, over_105_pct = ?, over_115_pct = ?,
        home_games = ?, away_games = ?, games_winning = ?, games_drawing = ?, games_losing = ?,
        corners_when_winning = ?, corners_when_drawing = ?, corners_when_losing = ?,
        last_5_avg = ?, recent_matches = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      team_id, season, games_played, avg_corners, home_avg, away_avg,
      over_85_pct, over_95_pct, over_105_pct, over_115_pct,
      home_games, away_games, games_winning, games_drawing, games_losing,
      corners_when_winning, corners_when_drawing, corners_when_losing,
      last_5_avg, recent_matches, id
    ).run();
  } else {
    await c.env.DB.prepare(`
      INSERT INTO team_stats (
        team_id, season, games_played, avg_corners, home_avg, away_avg,
        over_85_pct, over_95_pct, over_105_pct, over_115_pct,
        home_games, away_games, games_winning, games_drawing, games_losing,
        corners_when_winning, corners_when_drawing, corners_when_losing,
        last_5_avg, recent_matches
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      team_id, season, games_played, avg_corners, home_avg, away_avg,
      over_85_pct, over_95_pct, over_105_pct, over_115_pct,
      home_games, away_games, games_winning, games_drawing, games_losing,
      corners_when_winning, corners_when_drawing, corners_when_losing,
      last_5_avg, recent_matches
    ).run();
  }
  
  return c.json({ success: true });
});

// Get upcoming matches from DB
app.get("/api/admin/matches", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM upcoming_matches ORDER BY match_date, match_time"
  ).all();
  return c.json(results);
});

// Add/update match
app.post("/api/admin/matches", authMiddleware, async (c) => {
  const body = await c.req.json();
  const { id, home_team, away_team, match_date, match_time, league, round, referee } = body;
  
  if (id) {
    await c.env.DB.prepare(`
      UPDATE upcoming_matches SET 
        home_team = ?, away_team = ?, match_date = ?, match_time = ?, 
        league = ?, round = ?, referee = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(home_team, away_team, match_date, match_time, league, round, referee, id).run();
  } else {
    await c.env.DB.prepare(`
      INSERT INTO upcoming_matches (home_team, away_team, match_date, match_time, league, round, referee)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(home_team, away_team, match_date, match_time, league, round, referee).run();
  }
  
  return c.json({ success: true });
});

// Delete match
app.delete("/api/admin/matches/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM upcoming_matches WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

// Get pending matches (past matches without corner data)
app.get("/api/admin/matches/pending", authMiddleware, async (c) => {
  const today = new Date().toISOString().split("T")[0];
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM upcoming_matches 
     WHERE match_date < ? AND (is_completed = 0 OR is_completed IS NULL)
     ORDER BY match_date DESC, match_time DESC`
  ).bind(today).all();
  return c.json(results);
});

// Update match corner data
// Update match with all stats (corners, referee, cards, shots)
app.post("/api/admin/matches/:id/corners", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { 
    home_corners, away_corners, 
    referee,
    home_yellow_cards, away_yellow_cards, home_red_cards, away_red_cards,
    home_shots, away_shots, home_shots_on_target, away_shots_on_target 
  } = body;
  
  await c.env.DB.prepare(
    `UPDATE upcoming_matches SET 
      home_corners = ?, away_corners = ?, 
      referee = COALESCE(?, referee),
      home_yellow_cards = COALESCE(?, home_yellow_cards), 
      away_yellow_cards = COALESCE(?, away_yellow_cards),
      home_red_cards = COALESCE(?, home_red_cards), 
      away_red_cards = COALESCE(?, away_red_cards),
      home_shots = COALESCE(?, home_shots), 
      away_shots = COALESCE(?, away_shots),
      home_shots_on_target = COALESCE(?, home_shots_on_target), 
      away_shots_on_target = COALESCE(?, away_shots_on_target),
      is_completed = 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(
    home_corners, away_corners,
    referee || null,
    home_yellow_cards ?? null, away_yellow_cards ?? null, 
    home_red_cards ?? null, away_red_cards ?? null,
    home_shots ?? null, away_shots ?? null,
    home_shots_on_target ?? null, away_shots_on_target ?? null,
    id
  ).run();
  
  return c.json({ success: true });
});

// Get H2H records
app.get("/api/admin/h2h", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM head_to_head ORDER BY team1, team2"
  ).all();
  return c.json(results);
});

// Add/update H2H
app.post("/api/admin/h2h", authMiddleware, async (c) => {
  const body = await c.req.json();
  const { id, team1, team2, total_matches, avg_corners, last_match_date, last_match_corners, recent_matches } = body;
  
  if (id) {
    await c.env.DB.prepare(`
      UPDATE head_to_head SET 
        team1 = ?, team2 = ?, total_matches = ?, avg_corners = ?,
        last_match_date = ?, last_match_corners = ?, recent_matches = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(team1, team2, total_matches, avg_corners, last_match_date, last_match_corners, recent_matches, id).run();
  } else {
    await c.env.DB.prepare(`
      INSERT INTO head_to_head (team1, team2, total_matches, avg_corners, last_match_date, last_match_corners, recent_matches)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(team1, team2, total_matches, avg_corners, last_match_date, last_match_corners, recent_matches).run();
  }
  
  return c.json({ success: true });
});

// Get all admins
app.get("/api/admin/admins", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, user_id, email, is_active, created_at FROM admin_users ORDER BY created_at"
  ).all();
  return c.json(results);
});

// Add new admin by email
app.post("/api/admin/admins", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  
  // Check if current user is admin
  const isAdmin = await c.env.DB.prepare(
    "SELECT * FROM admin_users WHERE user_id = ? AND is_active = 1"
  ).bind(user.id).first();
  
  if (!isAdmin) {
    return c.json({ error: "Not authorized" }, 403);
  }
  
  const body = await c.req.json();
  const { email } = body;
  
  if (!email) {
    return c.json({ error: "Email is required" }, 400);
  }
  
  // Check if already admin
  const existing = await c.env.DB.prepare(
    "SELECT * FROM admin_users WHERE email = ?"
  ).bind(email).first();
  
  if (existing) {
    return c.json({ error: "This email is already an admin" }, 400);
  }
  
  // Add as admin (user_id will be updated when they login)
  await c.env.DB.prepare(
    "INSERT INTO admin_users (user_id, email, is_active) VALUES (?, ?, 1)"
  ).bind("pending_" + Date.now(), email).run();
  
  return c.json({ success: true });
});

// Remove admin
app.delete("/api/admin/admins/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  
  const adminId = c.req.param("id");
  
  // Check if trying to remove self
  const selfAdmin = await c.env.DB.prepare(
    "SELECT * FROM admin_users WHERE user_id = ? AND id = ?"
  ).bind(user.id, adminId).first();
  
  if (selfAdmin) {
    return c.json({ error: "You cannot remove yourself" }, 400);
  }
  
  await c.env.DB.prepare("DELETE FROM admin_users WHERE id = ?").bind(adminId).run();
  return c.json({ success: true });
});

// Add first admin (bootstrap - only works if no admins exist)
app.post("/api/admin/bootstrap", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  
  // Check if any admin exists
  const existing = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM admin_users"
  ).first() as { count: number };
  
  if (existing && existing.count > 0) {
    return c.json({ error: "Admin already exists" }, 400);
  }
  
  // Add current user as admin
  await c.env.DB.prepare(
    "INSERT INTO admin_users (user_id, email) VALUES (?, ?)"
  ).bind(user.id, user.email).run();
  
  return c.json({ success: true, message: "You are now an admin" });
});

// AI Assistant - Parse corner data from text
app.post("/api/admin/ai/parse-corners", authMiddleware, async (c) => {
  const user = c.get("user") as { id: string; email: string };
  
  // Check admin
  const adminCheck = await c.env.DB.prepare(
    "SELECT * FROM admin_users WHERE user_id = ? AND is_active = 1"
  ).bind(user.id).first();
  
  if (!adminCheck) {
    return c.json({ error: "Admin access required" }, 403);
  }
  
  const { text } = await c.req.json();
  
  if (!text || typeof text !== "string") {
    return c.json({ error: "Text is required" }, 400);
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: text,
      config: {
        systemInstruction: `Você é um assistente especializado em extrair dados de escanteios de futebol.
Analise o texto fornecido e extraia informações de partidas de futebol.

Retorne um JSON com o seguinte formato:
{
  "matches": [
    {
      "homeTeam": "Nome do time mandante",
      "awayTeam": "Nome do time visitante", 
      "homeCorners": número de escanteios do mandante,
      "awayCorners": número de escanteios do visitante,
      "date": "YYYY-MM-DD" (se disponível),
      "league": "Nome da liga" (se disponível)
    }
  ],
  "teamStats": [
    {
      "team": "Nome do time",
      "avgCorners": média de escanteios,
      "avgCornersFor": média de escanteios a favor,
      "avgCornersAgainst": média de escanteios contra,
      "gamesPlayed": número de jogos
    }
  ]
}

Se não encontrar dados válidos, retorne: {"matches": [], "teamStats": [], "error": "Não foi possível extrair dados"}
Sempre retorne JSON válido, sem markdown ou texto adicional.`,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    
    const result = JSON.parse(response.text || "{}");
    return c.json(result);
  } catch (error) {
    console.error("AI parsing error:", error);
    return c.json({ error: "Erro ao processar com IA", matches: [], teamStats: [] }, 500);
  }
});

// AI Assistant - Auto-update match corners
app.post("/api/admin/ai/update-match", authMiddleware, async (c) => {
  const user = c.get("user") as { id: string; email: string };
  
  // Check admin
  const adminCheck = await c.env.DB.prepare(
    "SELECT * FROM admin_users WHERE user_id = ? AND is_active = 1"
  ).bind(user.id).first();
  
  if (!adminCheck) {
    return c.json({ error: "Admin access required" }, 403);
  }
  
  const { matchId, homeCorners, awayCorners } = await c.req.json();
  
  if (!matchId || homeCorners === undefined || awayCorners === undefined) {
    return c.json({ error: "matchId, homeCorners, and awayCorners are required" }, 400);
  }
  
  await c.env.DB.prepare(`
    UPDATE upcoming_matches 
    SET home_corners = ?, away_corners = ?, is_completed = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(homeCorners, awayCorners, matchId).run();
  
  return c.json({ success: true });
});

// AI Assistant - Auto-search corner data using Firecrawl
// Legacy endpoint - corners only
app.post("/api/admin/ai/search-corners", authMiddleware, async (c) => {
  const user = c.get("user") as { id: string; email: string };
  
  // Check admin
  const adminCheck = await c.env.DB.prepare(
    "SELECT * FROM admin_users WHERE user_id = ? AND is_active = 1"
  ).bind(user.id).first();
  
  if (!adminCheck) {
    return c.json({ error: "Admin access required" }, 403);
  }
  
  const { homeTeam, awayTeam, date } = await c.req.json();
  
  if (!homeTeam || !awayTeam) {
    return c.json({ error: "homeTeam and awayTeam are required" }, 400);
  }
  
  try {
    const firecrawl = new Firecrawl({ apiKey: c.env.FIRECRAWL_API_KEY });
    
    // Format date for search
    const matchDate = date ? new Date(date).toLocaleDateString('pt-BR') : '';
    const searchQuery = `${homeTeam} x ${awayTeam} escanteios corners ${matchDate} resultado estatísticas`;
    
    // Search for match corner data
    const searchResults = await firecrawl.search(searchQuery, {
      limit: 3,
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: true,
      },
    });
    
    // Combine all search results into text - handle both response formats
    const webResults = (searchResults as any).data || searchResults;
    const combinedText = Array.isArray(webResults) 
      ? webResults.map((r: { title?: string; description?: string; markdown?: string }) => 
          `${r.title || ''}\n${r.description || ''}\n${r.markdown || ''}`
        ).join('\n\n---\n\n')
      : '';
    
    if (!combinedText) {
      return c.json({ 
        success: false, 
        error: "Nenhum resultado encontrado na busca",
        homeCorners: null,
        awayCorners: null
      });
    }
    
    // Use Gemini to extract corner data from search results
    const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Partida: ${homeTeam} vs ${awayTeam}
Data: ${matchDate || 'não especificada'}

Texto dos resultados de busca:
${combinedText}`,
      config: {
        systemInstruction: `Você é um assistente especializado em extrair dados de escanteios de futebol.
Analise o texto e encontre a quantidade de escanteios para a partida específica: ${homeTeam} vs ${awayTeam}.

Retorne APENAS um JSON com este formato:
{
  "found": true ou false,
  "homeCorners": número de escanteios do mandante (${homeTeam}),
  "awayCorners": número de escanteios do visitante (${awayTeam}),
  "totalCorners": total de escanteios,
  "source": "site/fonte onde encontrou",
  "confidence": "high", "medium" ou "low"
}

Se não encontrar dados específicos de escanteios para esta partida, retorne:
{"found": false, "homeCorners": null, "awayCorners": null, "error": "Dados não encontrados"}

IMPORTANTE: 
- Procure por "corners", "escanteios", "CK" ou estatísticas similares
- O número antes do "x" ou "-" geralmente é do time mandante
- Retorne apenas JSON válido, sem texto adicional`,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    
    const result = JSON.parse(response.text || "{}");
    return c.json({
      success: result.found === true,
      homeCorners: result.homeCorners,
      awayCorners: result.awayCorners,
      totalCorners: result.totalCorners,
      source: result.source,
      confidence: result.confidence,
      error: result.error
    });
    
  } catch (error) {
    console.error("Search corners error:", error);
    return c.json({ 
      success: false, 
      error: "Erro ao buscar dados: " + (error instanceof Error ? error.message : 'Erro desconhecido'),
      homeCorners: null,
      awayCorners: null
    }, 500);
  }
});

// NEW: Complete match stats search (corners + referee + cards + shots)
app.post("/api/admin/ai/search-complete", authMiddleware, async (c) => {
  const user = c.get("user") as { id: string; email: string };
  
  // Check admin
  const adminCheck = await c.env.DB.prepare(
    "SELECT * FROM admin_users WHERE user_id = ? AND is_active = 1"
  ).bind(user.id).first();
  
  if (!adminCheck) {
    return c.json({ error: "Admin access required" }, 403);
  }
  
  const { homeTeam, awayTeam, date } = await c.req.json();
  
  if (!homeTeam || !awayTeam) {
    return c.json({ error: "homeTeam and awayTeam are required" }, 400);
  }
  
  try {
    const firecrawl = new Firecrawl({ apiKey: c.env.FIRECRAWL_API_KEY });
    
    // Format date for search
    const matchDate = date ? new Date(date).toLocaleDateString('pt-BR') : '';
    
    // Search with comprehensive query including all stats
    const searchQuery = `${homeTeam} x ${awayTeam} ${matchDate} estatísticas completas escanteios corners cartões amarelos vermelhos finalizações chutes árbitro juiz`;
    
    // Search for match data
    const searchResults = await firecrawl.search(searchQuery, {
      limit: 5,
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: true,
      },
    });
    
    // Combine all search results into text
    const webResults = (searchResults as any).data || searchResults;
    const combinedText = Array.isArray(webResults) 
      ? webResults.map((r: { title?: string; description?: string; markdown?: string }) => 
          `${r.title || ''}\n${r.description || ''}\n${r.markdown || ''}`
        ).join('\n\n---\n\n')
      : '';
    
    if (!combinedText) {
      return c.json({ 
        success: false, 
        error: "Nenhum resultado encontrado na busca",
        corners: null,
        referee: null,
        cards: null,
        shots: null
      });
    }
    
    // Use Gemini to extract ALL match stats from search results
    const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Partida: ${homeTeam} vs ${awayTeam}
Data: ${matchDate || 'não especificada'}

Texto dos resultados de busca:
${combinedText}`,
      config: {
        systemInstruction: `Você é um assistente especializado em extrair estatísticas completas de partidas de futebol.
Analise o texto e encontre TODAS as estatísticas disponíveis para a partida: ${homeTeam} vs ${awayTeam}.

Retorne APENAS um JSON com este formato:
{
  "found": true ou false,
  "corners": {
    "homeCorners": número de escanteios do mandante (${homeTeam}),
    "awayCorners": número de escanteios do visitante (${awayTeam}),
    "found": true ou false
  },
  "referee": {
    "name": "nome completo do árbitro/juiz",
    "found": true ou false
  },
  "cards": {
    "homeYellow": cartões amarelos do mandante,
    "awayYellow": cartões amarelos do visitante,
    "homeRed": cartões vermelhos do mandante,
    "awayRed": cartões vermelhos do visitante,
    "found": true ou false
  },
  "shots": {
    "homeShots": total de finalizações/chutes do mandante,
    "awayShots": total de finalizações/chutes do visitante,
    "homeShotsOnTarget": finalizações no gol do mandante,
    "awayShotsOnTarget": finalizações no gol do visitante,
    "found": true ou false
  },
  "score": {
    "homeScore": placar do mandante,
    "awayScore": placar do visitante,
    "found": true ou false
  },
  "source": "site/fonte principal onde encontrou",
  "confidence": "high", "medium" ou "low"
}

Se não encontrar uma categoria específica, marque "found": false nela.
Se não encontrar nenhum dado, retorne:
{"found": false, "error": "Dados não encontrados"}

IMPORTANTE:
- Procure por: "corners", "escanteios", "CK", "cartões", "amarelos", "vermelhos", "finalizações", "chutes", "shots", "árbitro", "juiz", "referee"
- O número antes do "x" ou "-" geralmente é do time mandante
- Retorne apenas JSON válido, sem texto adicional`,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    
    const result = JSON.parse(response.text || "{}");
    
    return c.json({
      success: result.found === true,
      corners: result.corners?.found ? {
        homeCorners: result.corners.homeCorners,
        awayCorners: result.corners.awayCorners,
      } : null,
      referee: result.referee?.found ? result.referee.name : null,
      cards: result.cards?.found ? {
        homeYellow: result.cards.homeYellow,
        awayYellow: result.cards.awayYellow,
        homeRed: result.cards.homeRed,
        awayRed: result.cards.awayRed,
      } : null,
      shots: result.shots?.found ? {
        homeShots: result.shots.homeShots,
        awayShots: result.shots.awayShots,
        homeShotsOnTarget: result.shots.homeShotsOnTarget,
        awayShotsOnTarget: result.shots.awayShotsOnTarget,
      } : null,
      score: result.score?.found ? {
        homeScore: result.score.homeScore,
        awayScore: result.score.awayScore,
      } : null,
      source: result.source,
      confidence: result.confidence,
      error: result.error
    });
    
  } catch (error) {
    console.error("Search complete stats error:", error);
    return c.json({ 
      success: false, 
      error: "Erro ao buscar dados: " + (error instanceof Error ? error.message : 'Erro desconhecido'),
      corners: null,
      referee: null,
      cards: null,
      shots: null
    }, 500);
  }
});

// ============================================
// Public API - Read from Database
// ============================================

// Get team stats for a league (public, no auth)
app.get("/api/stats/teams/:league", async (c) => {
  const league = c.req.param("league");
  const season = c.req.query("season") || "2026";
  
  const { results } = await c.env.DB.prepare(`
    SELECT ts.*, t.name as team_name, t.short_name 
    FROM team_stats ts 
    LEFT JOIN teams t ON ts.team_id = t.id 
    WHERE t.league = ? AND ts.season = ?
    ORDER BY t.name
  `).bind(league, season).all();
  
  return c.json(results);
});

// Get single team stats (public)
app.get("/api/stats/team/:teamName", async (c) => {
  const teamName = c.req.param("teamName");
  const season = c.req.query("season") || "2026";
  
  const result = await c.env.DB.prepare(`
    SELECT ts.*, t.name as team_name, t.short_name, t.league
    FROM team_stats ts 
    LEFT JOIN teams t ON ts.team_id = t.id 
    WHERE t.name = ? AND ts.season = ?
  `).bind(teamName, season).first();
  
  if (!result) {
    return c.json({ error: "Team not found" }, 404);
  }
  
  return c.json(result);
});

// Get upcoming matches for a league (public)
app.get("/api/stats/matches/:league", async (c) => {
  const league = c.req.param("league");
  
  const { results } = await c.env.DB.prepare(`
    SELECT * FROM upcoming_matches 
    WHERE league = ? AND match_date >= date('now')
    ORDER BY match_date, match_time
  `).bind(league).all();
  
  return c.json(results);
});

// Get all upcoming matches (public)
app.get("/api/stats/matches", async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT * FROM upcoming_matches 
    WHERE match_date >= date('now')
    ORDER BY match_date, match_time
    LIMIT 50
  `).all();
  
  return c.json(results);
});

// Get H2H between two teams (public)
app.get("/api/stats/h2h", async (c) => {
  const team1 = c.req.query("team1");
  const team2 = c.req.query("team2");
  
  if (!team1 || !team2) {
    return c.json({ error: "Both team1 and team2 are required" }, 400);
  }
  
  // Search both combinations (team1 vs team2 OR team2 vs team1)
  const result = await c.env.DB.prepare(`
    SELECT * FROM head_to_head 
    WHERE (team1 = ? AND team2 = ?) OR (team1 = ? AND team2 = ?)
  `).bind(team1, team2, team2, team1).first();
  
  if (!result) {
    return c.json({ error: "H2H not found" }, 404);
  }
  
  return c.json(result);
});

// ============================================
// Football-Data.co.uk Corner Statistics API
// ============================================

// Get all available leagues (simple endpoint)
app.get("/api/leagues", (c) => {
  const leagues = getLeagues();
  return c.json({ leagues });
});

// Get all available leagues
app.get("/api/corner-stats/leagues", (c) => {
  const leagues = getLeagues();
  return c.json(leagues);
});

// Get statistics for a specific league (legacy endpoint for frontend)
app.get("/api/football-data/:leagueId", async (c) => {
  const leagueId = c.req.param("leagueId");
  
  // Handle Brazilian league separately (uses local data)
  if (leagueId === "BR1") {
    return c.json({ 
      error: "Brazilian league uses local data",
      message: "Use local data for Brazilian teams"
    }, 400);
  }
  
  const stats = await fetchLeagueStats(leagueId);
  
  if (!stats) {
    return c.json({ error: "League not found or failed to fetch data" }, 404);
  }
  
  return c.json(stats);
});

// Get H2H statistics (legacy endpoint for frontend)
app.get("/api/football-data/:leagueId/h2h", async (c) => {
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

// Get card statistics for a league
app.get("/api/corner-stats/cards/:leagueId", async (c) => {
  const leagueId = c.req.param("leagueId");
  
  const cardStats = await fetchCardStats(leagueId);
  
  if (!cardStats) {
    return c.json({ error: "League not found or no card data available" }, 404);
  }
  
  return c.json(cardStats);
});

// Get shot statistics for a league
app.get("/api/corner-stats/shots/:leagueId", async (c) => {
  const leagueId = c.req.param("leagueId");
  
  const shotStats = await fetchShotStats(leagueId);
  
  if (!shotStats) {
    return c.json({ error: "League not found or no shot data available" }, 404);
  }
  
  return c.json(shotStats);
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
  
  if (!apiKey) {
    return c.json({ error: "API key not configured" }, 500);
  }

  try {
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

    // Transform to our format
    const fixtures = allEvents.map(event => ({
      id: event.id,
      sportKey: event.sport_key,
      sportTitle: event.sport_title || formatSportName(event.sport_key),
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      commenceTime: event.commence_time,
    }));

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
// Sofascore Direct API (Internal API - no key required)
// ============================================

const SOFASCORE_DIRECT = "https://api.sofascore.com/api/v1";

// Get team corner statistics from Sofascore Direct API
app.get("/api/sofascore-direct/team/:teamId/corners", async (c) => {
  const teamId = c.req.param("teamId");
  const tournamentId = c.req.query("tournamentId") || "325"; // Default: Brasileirão A
  const seasonId = c.req.query("seasonId") || "58766";

  try {
    const url = `${SOFASCORE_DIRECT}/team/${teamId}/unique-tournament/${tournamentId}/season/${seasonId}/statistics/overall`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Sofascore API error ${response.status}: ${text}`);
    }

    const data = await response.json() as Record<string, unknown>;
    const stats = data.statistics as Record<string, unknown> | undefined;
    
    if (!stats) {
      return c.json({ error: "No statistics found" }, 404);
    }

    // Extract corner statistics
    const cornerStats = {
      teamId: parseInt(teamId),
      tournamentId: parseInt(tournamentId),
      seasonId: parseInt(seasonId),
      matches: stats.matches || 0,
      corners: stats.corners || 0,
      cornersAgainst: stats.cornersAgainst || 0,
      avgCorners: stats.matches ? Math.round(((stats.corners as number) / (stats.matches as number)) * 10) / 10 : 0,
      avgCornersAgainst: stats.matches ? Math.round(((stats.cornersAgainst as number) / (stats.matches as number)) * 10) / 10 : 0,
      avgTotalCorners: stats.matches ? Math.round((((stats.corners as number) + (stats.cornersAgainst as number)) / (stats.matches as number)) * 10) / 10 : 0,
      // Additional stats
      shots: stats.shots || 0,
      shotsOnTarget: stats.shotsOnTarget || 0,
      possession: stats.averageBallPossession || 0,
      goalsScored: stats.goalsScored || 0,
      goalsConceded: stats.goalsConceded || 0,
    };

    return c.json(cornerStats);
  } catch (error) {
    console.error("Sofascore direct API error:", error);
    return c.json({ 
      error: "Failed to fetch corner statistics",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Get all teams corner stats for a tournament
app.get("/api/sofascore-direct/tournament/:tournamentId/corners", async (c) => {
  const tournamentId = c.req.param("tournamentId");
  const seasonId = c.req.query("seasonId") || "58766";

  try {
    // First get standings to get all team IDs
    const standingsUrl = `${SOFASCORE_DIRECT}/unique-tournament/${tournamentId}/season/${seasonId}/standings/total`;
    
    const standingsResponse = await fetch(standingsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    
    if (!standingsResponse.ok) {
      throw new Error(`Failed to fetch standings: ${standingsResponse.status}`);
    }

    const standingsData = await standingsResponse.json() as Record<string, unknown>;
    const standings = standingsData.standings as Array<{ rows: Array<{ team: { id: number; name: string } }> }> | undefined;
    
    if (!standings || standings.length === 0) {
      return c.json({ error: "No standings found" }, 404);
    }

    // Get team IDs from standings
    const teams = standings[0].rows.map(row => ({
      id: row.team.id,
      name: row.team.name,
    }));

    // Fetch corner stats for each team (limited to avoid rate limiting)
    const cornerStats = [];
    
    for (const team of teams.slice(0, 20)) { // Limit to 20 teams
      try {
        const statsUrl = `${SOFASCORE_DIRECT}/team/${team.id}/unique-tournament/${tournamentId}/season/${seasonId}/statistics/overall`;
        
        const statsResponse = await fetch(statsUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
          },
        });
        
        if (statsResponse.ok) {
          const statsData = await statsResponse.json() as Record<string, unknown>;
          const stats = statsData.statistics as Record<string, unknown> | undefined;
          
          if (stats) {
            cornerStats.push({
              team: team.name,
              teamId: team.id,
              matches: stats.matches || 0,
              corners: stats.corners || 0,
              cornersAgainst: stats.cornersAgainst || 0,
              avgCorners: stats.matches ? Math.round(((stats.corners as number) / (stats.matches as number)) * 10) / 10 : 0,
              avgCornersAgainst: stats.matches ? Math.round(((stats.cornersAgainst as number) / (stats.matches as number)) * 10) / 10 : 0,
              avgTotalCorners: stats.matches ? Math.round((((stats.corners as number) + (stats.cornersAgainst as number)) / (stats.matches as number)) * 10) / 10 : 0,
            });
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch {
        // Skip teams that fail
        console.error(`Failed to fetch stats for ${team.name}`);
      }
    }

    // Sort by average corners (descending)
    cornerStats.sort((a, b) => b.avgCorners - a.avgCorners);

    return c.json({
      tournamentId: parseInt(tournamentId),
      seasonId: parseInt(seasonId),
      teams: cornerStats,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Sofascore tournament corners error:", error);
    return c.json({ 
      error: "Failed to fetch tournament corner statistics",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Get half-time corner stats for all teams in a tournament (from finished matches)
app.get("/api/sofascore-direct/tournament/:tournamentId/halftime-corners", async (c) => {
  const tournamentId = c.req.param("tournamentId");
  const seasonId = c.req.query("seasonId") || "58766";

  try {
    // Fetch last finished matches from Sofascore
    const eventsUrl = `${SOFASCORE_DIRECT}/unique-tournament/${tournamentId}/season/${seasonId}/events/last/0`;
    
    const eventsResponse = await fetch(eventsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    
    if (!eventsResponse.ok) {
      return c.json({ error: "Failed to fetch matches", status: eventsResponse.status }, 404);
    }

    const eventsData = await eventsResponse.json() as { events?: Array<{
      id: number;
      homeTeam: { id: number; name: string };
      awayTeam: { id: number; name: string };
      status?: { type: string };
    }> };
    
    const events = eventsData.events || [];
    // Filter to finished matches only and limit to last 50 matches to avoid timeout
    const finishedEvents = events
      .filter(e => e.status?.type === "finished")
      .slice(0, 50);
    
    if (finishedEvents.length === 0) {
      return c.json({ 
        tournamentId: parseInt(tournamentId),
        teams: [],
        message: "No finished matches found"
      });
    }

    // Team stats accumulator
    const teamStats: Record<string, {
      team: string;
      teamId: number;
      matches: number;
      corners1stHalf: number;
      cornersAgainst1stHalf: number;
      corners2ndHalf: number;
      cornersAgainst2ndHalf: number;
      totalCorners: number;
      totalCornersAgainst: number;
    }> = {};

    // Fetch statistics for each match
    for (const event of finishedEvents) {
      try {
        const statsUrl = `${SOFASCORE_DIRECT}/event/${event.id}/statistics`;
        const statsResponse = await fetch(statsUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
          },
        });
        
        if (!statsResponse.ok) continue;
        
        const statsData = await statsResponse.json() as { statistics?: Array<{
          period: string;
          groups: Array<{
            statisticsItems: Array<{
              key: string;
              homeValue?: number;
              awayValue?: number;
              home?: string;
              away?: string;
            }>;
          }>;
        }> };
        
        const statistics = statsData.statistics || [];
        
        let home1st = 0, away1st = 0, home2nd = 0, away2nd = 0, homeTotal = 0, awayTotal = 0;
        
        for (const period of statistics) {
          for (const group of period.groups) {
            for (const item of group.statisticsItems) {
              if (item.key === "cornerKicks") {
                const homeVal = item.homeValue || parseInt(item.home || "0") || 0;
                const awayVal = item.awayValue || parseInt(item.away || "0") || 0;
                
                if (period.period === "ALL") {
                  homeTotal = homeVal;
                  awayTotal = awayVal;
                } else if (period.period === "1ST") {
                  home1st = homeVal;
                  away1st = awayVal;
                } else if (period.period === "2ND") {
                  home2nd = homeVal;
                  away2nd = awayVal;
                }
              }
            }
          }
        }
        
        // Initialize home team stats
        const homeKey = String(event.homeTeam.id);
        if (!teamStats[homeKey]) {
          teamStats[homeKey] = {
            team: event.homeTeam.name,
            teamId: event.homeTeam.id,
            matches: 0,
            corners1stHalf: 0,
            cornersAgainst1stHalf: 0,
            corners2ndHalf: 0,
            cornersAgainst2ndHalf: 0,
            totalCorners: 0,
            totalCornersAgainst: 0,
          };
        }
        
        // Initialize away team stats
        const awayKey = String(event.awayTeam.id);
        if (!teamStats[awayKey]) {
          teamStats[awayKey] = {
            team: event.awayTeam.name,
            teamId: event.awayTeam.id,
            matches: 0,
            corners1stHalf: 0,
            cornersAgainst1stHalf: 0,
            corners2ndHalf: 0,
            cornersAgainst2ndHalf: 0,
            totalCorners: 0,
            totalCornersAgainst: 0,
          };
        }
        
        // Accumulate home team stats
        teamStats[homeKey].matches++;
        teamStats[homeKey].corners1stHalf += home1st;
        teamStats[homeKey].cornersAgainst1stHalf += away1st;
        teamStats[homeKey].corners2ndHalf += home2nd;
        teamStats[homeKey].cornersAgainst2ndHalf += away2nd;
        teamStats[homeKey].totalCorners += homeTotal;
        teamStats[homeKey].totalCornersAgainst += awayTotal;
        
        // Accumulate away team stats
        teamStats[awayKey].matches++;
        teamStats[awayKey].corners1stHalf += away1st;
        teamStats[awayKey].cornersAgainst1stHalf += home1st;
        teamStats[awayKey].corners2ndHalf += away2nd;
        teamStats[awayKey].cornersAgainst2ndHalf += home2nd;
        teamStats[awayKey].totalCorners += awayTotal;
        teamStats[awayKey].totalCornersAgainst += homeTotal;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch {
        continue;
      }
    }
    
    // Calculate averages and format output
    const teamsArray = Object.values(teamStats).map(team => ({
      team: team.team,
      teamId: team.teamId,
      matches: team.matches,
      avgCorners1stHalf: team.matches > 0 ? Math.round((team.corners1stHalf / team.matches) * 10) / 10 : 0,
      avgCornersAgainst1stHalf: team.matches > 0 ? Math.round((team.cornersAgainst1stHalf / team.matches) * 10) / 10 : 0,
      avgCorners2ndHalf: team.matches > 0 ? Math.round((team.corners2ndHalf / team.matches) * 10) / 10 : 0,
      avgCornersAgainst2ndHalf: team.matches > 0 ? Math.round((team.cornersAgainst2ndHalf / team.matches) * 10) / 10 : 0,
      avgTotal1stHalf: team.matches > 0 ? Math.round(((team.corners1stHalf + team.cornersAgainst1stHalf) / team.matches) * 10) / 10 : 0,
      avgTotal2ndHalf: team.matches > 0 ? Math.round(((team.corners2ndHalf + team.cornersAgainst2ndHalf) / team.matches) * 10) / 10 : 0,
      avgTotalCorners: team.matches > 0 ? Math.round(((team.totalCorners + team.totalCornersAgainst) / team.matches) * 10) / 10 : 0,
    }));
    
    // Sort by total 1st half average
    teamsArray.sort((a, b) => b.avgCorners1stHalf - a.avgCorners1stHalf);
    
    return c.json({
      tournamentId: parseInt(tournamentId),
      seasonId: parseInt(seasonId),
      teams: teamsArray,
      matchesAnalyzed: finishedEvents.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Sofascore halftime corners error:", error);
    return c.json({ 
      error: "Failed to fetch half-time corner statistics",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Get match corner statistics
app.get("/api/sofascore-direct/match/:matchId/statistics", async (c) => {
  const matchId = c.req.param("matchId");

  try {
    const url = `${SOFASCORE_DIRECT}/event/${matchId}/statistics`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      throw new Error(`Sofascore API error ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;
    
    // Extract corner data from statistics
    const statistics = data.statistics as Array<{
      period: string;
      groups: Array<{
        groupName: string;
        statisticsItems: Array<{
          name: string;
          home: string;
          away: string;
          homeValue: number;
          awayValue: number;
          key: string;
        }>;
      }>;
    }> | undefined;

    let homeCorners = 0;
    let awayCorners = 0;
    let homeCorners1stHalf = 0;
    let awayCorners1stHalf = 0;
    let homeCorners2ndHalf = 0;
    let awayCorners2ndHalf = 0;

    if (statistics) {
      for (const period of statistics) {
        for (const group of period.groups) {
          for (const item of group.statisticsItems) {
            if (item.key === "cornerKicks" || item.name.toLowerCase().includes("corner")) {
              const homeVal = item.homeValue || parseInt(item.home) || 0;
              const awayVal = item.awayValue || parseInt(item.away) || 0;
              
              if (period.period === "ALL") {
                homeCorners = homeVal;
                awayCorners = awayVal;
              } else if (period.period === "1ST") {
                homeCorners1stHalf = homeVal;
                awayCorners1stHalf = awayVal;
              } else if (period.period === "2ND") {
                homeCorners2ndHalf = homeVal;
                awayCorners2ndHalf = awayVal;
              }
              break;
            }
          }
        }
      }
    }

    return c.json({
      matchId: parseInt(matchId),
      homeCorners,
      awayCorners,
      totalCorners: homeCorners + awayCorners,
      // Half-time corners
      homeCorners1stHalf,
      awayCorners1stHalf,
      totalCorners1stHalf: homeCorners1stHalf + awayCorners1stHalf,
      homeCorners2ndHalf,
      awayCorners2ndHalf,
      totalCorners2ndHalf: homeCorners2ndHalf + awayCorners2ndHalf,
      fullStatistics: data,
    });
  } catch (error) {
    console.error("Sofascore match stats error:", error);
    return c.json({ 
      error: "Failed to fetch match statistics",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Get next matches for a tournament - uses scheduled events endpoint
app.get("/api/sofascore-direct/tournament/:tournamentId/matches", async (c) => {
  const tournamentId = c.req.param("tournamentId");
  const seasonId = c.req.query("seasonId") || "58766";

  try {
    // Try scheduled events endpoint first
    const url = `${SOFASCORE_DIRECT}/unique-tournament/${tournamentId}/season/${seasonId}/events/scheduled`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        "Referer": "https://www.sofascore.com/",
      },
    });
    
    if (!response.ok) {
      // Sofascore API may be blocked - return empty with message
      return c.json({ 
        events: [],
        message: "Sofascore API temporarily unavailable",
        status: response.status
      });
    }

    const data = await response.json() as Record<string, unknown>;
    
    return c.json(data);
  } catch (error) {
    console.error("Sofascore next matches error:", error);
    return c.json({ 
      events: [],
      error: "Failed to fetch next matches",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});



// ============================================
// 365Scores API (Free - Matches & Standings)
// ============================================

const SCORES365_BASE = "https://webws.365scores.com";

// Competition IDs for 365Scores
const SCORES365_COMPETITIONS: Record<string, { id: number; name: string; country: string }> = {
  // Brasil
  brasileirao_a: { id: 113, name: "Brasileirão Série A", country: "Brasil" },
  brasileirao_b: { id: 116, name: "Brasileirão Série B", country: "Brasil" },
  brasileirao_c: { id: 7810, name: "Brasileirão Série C", country: "Brasil" },
  brasileirao_d: { id: 7811, name: "Brasileirão Série D", country: "Brasil" },
  copa_do_brasil: { id: 115, name: "Copa do Brasil", country: "Brasil" },
  paulistao: { id: 114, name: "Campeonato Paulista", country: "Brasil" },
  mineiro: { id: 5057, name: "Campeonato Mineiro", country: "Brasil" },
  gaucho: { id: 5058, name: "Campeonato Gaúcho", country: "Brasil" },
  baiano: { id: 5059, name: "Campeonato Baiano", country: "Brasil" },
  carioca: { id: 5061, name: "Campeonato Carioca", country: "Brasil" },
  
  // England (7 divisions)
  premier_league: { id: 7, name: "Premier League", country: "England" },
  championship: { id: 1, name: "Championship", country: "England" },
  league_one: { id: 2, name: "League One", country: "England" },
  league_two: { id: 3, name: "League Two", country: "England" },
  national_league: { id: 4, name: "National League", country: "England" },
  national_league_n: { id: 7852, name: "National League N/S", country: "England" },
  
  // Spain
  la_liga: { id: 11, name: "La Liga", country: "Spain" },
  segunda_division: { id: 12, name: "La Liga 2", country: "Spain" },
  
  // Italy
  serie_a: { id: 17, name: "Serie A", country: "Italy" },
  serie_b_italy: { id: 18, name: "Serie B", country: "Italy" },
  
  // Germany
  bundesliga: { id: 25, name: "Bundesliga", country: "Germany" },
  bundesliga_2: { id: 26, name: "2. Bundesliga", country: "Germany" },
  liga_3: { id: 34, name: "3. Liga", country: "Germany" },
  
  // France
  ligue_1: { id: 35, name: "Ligue 1", country: "France" },
  ligue_2: { id: 36, name: "Ligue 2", country: "France" },
  
  // Other European
  eredivisie: { id: 63, name: "Eredivisie", country: "Netherlands" },
  primeira_liga: { id: 266, name: "Primeira Liga", country: "Portugal" },
  liga_portugal_2: { id: 267, name: "Liga Portugal 2", country: "Portugal" },
  scottish_prem: { id: 68, name: "Scottish Premiership", country: "Scotland" },
  belgian_pro: { id: 98, name: "Jupiler Pro League", country: "Belgium" },
  austrian: { id: 111, name: "Bundesliga Österreich", country: "Austria" },
  swiss_super: { id: 67, name: "Super League", country: "Switzerland" },
  turkish_super: { id: 78, name: "Süper Lig", country: "Turkey" },
  greek_super: { id: 84, name: "Super League", country: "Greece" },
  russian_premier: { id: 89, name: "Premier Liga", country: "Russia" },
  ukrainian_premier: { id: 129, name: "Premier Liga", country: "Ukraine" },
  danish_super: { id: 119, name: "Superliga", country: "Denmark" },
  swedish_allsvenskan: { id: 122, name: "Allsvenskan", country: "Sweden" },
  norwegian_eliteserien: { id: 125, name: "Eliteserien", country: "Norway" },
  
  // UEFA
  champions_league: { id: 572, name: "Champions League", country: "UEFA" },
  europa_league: { id: 573, name: "Europa League", country: "UEFA" },
  conference_league: { id: 6899, name: "Conference League", country: "UEFA" },
  
  // South America
  libertadores: { id: 385, name: "Copa Libertadores", country: "CONMEBOL" },
  sudamericana: { id: 480, name: "Copa Sul-Americana", country: "CONMEBOL" },
  argentina: { id: 72, name: "Liga Profesional", country: "Argentina" },
  argentina_2: { id: 419, name: "Primera Nacional", country: "Argentina" },
};

// Helper to make 365Scores API requests
async function scores365Get(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`${SCORES365_BASE}${path}`);
  
  // Default params for Portuguese language
  url.searchParams.set("appTypeId", "5");
  url.searchParams.set("langId", "31"); // Portuguese
  
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
    },
  });
  
  if (!response.ok) {
    throw new Error(`365Scores API error ${response.status}`);
  }

  return response.json();
}

// Get available competitions
app.get("/api/365scores/competitions", async (c) => {
  try {
    // Return our curated list
    const competitions = Object.entries(SCORES365_COMPETITIONS).map(([key, value]) => ({
      key,
      ...value,
    }));
    
    return c.json(competitions);
  } catch (error) {
    console.error("365Scores competitions error:", error);
    return c.json({ error: "Failed to fetch competitions" }, 500);
  }
});

// Get recent results for a competition
app.get("/api/365scores/results/:competitionKey", async (c) => {
  const competitionKey = c.req.param("competitionKey");
  const competition = SCORES365_COMPETITIONS[competitionKey];
  
  if (!competition) {
    return c.json({ error: "Competition not found" }, 404);
  }

  try {
    const data = await scores365Get("/web/games/results/", {
      competitions: competition.id.toString(),
    }) as { games?: Array<{
      id: number;
      statusId: number;
      statusText: string;
      startTime: string;
      roundNum?: number;
      roundName?: string;
      homeCompetitor: { id: number; name: string; score?: number; symbolicName?: string; color?: string };
      awayCompetitor: { id: number; name: string; score?: number; symbolicName?: string; color?: string };
    }> };
    
    if (!data.games) {
      return c.json({ 
        competition: competitionKey,
        matches: [],
        message: "No results found"
      });
    }

    // Transform to our format
    const matches = data.games.map(game => ({
      id: game.id,
      status: game.statusId,
      statusText: game.statusText,
      startTime: game.startTime,
      round: game.roundNum,
      roundName: game.roundName,
      homeTeam: {
        id: game.homeCompetitor.id,
        name: game.homeCompetitor.name,
        shortName: game.homeCompetitor.symbolicName,
        score: game.homeCompetitor.score || 0,
        color: game.homeCompetitor.color,
      },
      awayTeam: {
        id: game.awayCompetitor.id,
        name: game.awayCompetitor.name,
        shortName: game.awayCompetitor.symbolicName,
        score: game.awayCompetitor.score || 0,
        color: game.awayCompetitor.color,
      },
    }));

    // Sort by start time (newest first)
    matches.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    return c.json({
      competition: competitionKey,
      competitionName: competition.name,
      country: competition.country,
      matches,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("365Scores results error:", error);
    return c.json({ error: "Failed to fetch results" }, 500);
  }
});

// Get upcoming matches for a competition (extracted from standings)
app.get("/api/365scores/upcoming/:competitionKey", async (c) => {
  const competitionKey = c.req.param("competitionKey");
  const competition = SCORES365_COMPETITIONS[competitionKey];
  
  if (!competition) {
    return c.json({ error: "Competition not found" }, 404);
  }

  try {
    // Get upcoming matches from standings data (each team has nextMatch)
    const data = await scores365Get("/web/standings/", {
      competitions: competition.id.toString(),
    }) as { standings?: Array<{
      rows: Array<{
        competitor: { id: number; name: string };
        nextMatch?: {
          id: number;
          startTime: string;
          roundNum?: number;
          roundName?: string;
          homeCompetitor: { id: number; name: string; symbolicName?: string };
          awayCompetitor: { id: number; name: string; symbolicName?: string };
        };
      }>;
    }> };
    
    if (!data.standings || data.standings.length === 0) {
      return c.json({ 
        competition: competitionKey,
        matches: [],
      });
    }

    // Extract unique upcoming matches from all teams
    const matchesMap = new Map<number, {
      id: number;
      startTime: string;
      round?: number;
      roundName?: string;
      homeTeam: { id: number; name: string; shortName?: string };
      awayTeam: { id: number; name: string; shortName?: string };
    }>();

    for (const row of data.standings[0].rows) {
      if (row.nextMatch) {
        const match = row.nextMatch;
        if (!matchesMap.has(match.id)) {
          matchesMap.set(match.id, {
            id: match.id,
            startTime: match.startTime,
            round: match.roundNum,
            roundName: match.roundName,
            homeTeam: {
              id: match.homeCompetitor.id,
              name: match.homeCompetitor.name,
              shortName: match.homeCompetitor.symbolicName,
            },
            awayTeam: {
              id: match.awayCompetitor.id,
              name: match.awayCompetitor.name,
              shortName: match.awayCompetitor.symbolicName,
            },
          });
        }
      }
    }

    const matches = Array.from(matchesMap.values());
    
    // Sort by start time
    matches.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return c.json({
      competition: competitionKey,
      competitionName: competition.name,
      country: competition.country,
      matches,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("365Scores upcoming error:", error);
    return c.json({ error: "Failed to fetch upcoming matches" }, 500);
  }
});

// Get standings/table for a competition
app.get("/api/365scores/standings/:competitionKey", async (c) => {
  const competitionKey = c.req.param("competitionKey");
  const competition = SCORES365_COMPETITIONS[competitionKey];
  
  if (!competition) {
    return c.json({ error: "Competition not found" }, 404);
  }

  try {
    const data = await scores365Get("/web/standings/", {
      competitions: competition.id.toString(),
    }) as { standings?: Array<{
      rows: Array<{
        position: number;
        competitor: { id: number; name: string; symbolicName?: string; color?: string; imageVersion?: number };
        gamePlayed: number;
        gamesWon: number;
        gamesEven: number;
        gamesLost: number;
        for: number;
        against: number;
        ratio: number;
        points: number;
        recentForm?: string[];
        detailedRecentForm?: Array<{
          id: number;
          startTime: string;
          homeCompetitor: { name: string; score: number };
          awayCompetitor: { name: string; score: number };
          outcome: number;
        }>;
        nextMatch?: {
          id: number;
          startTime: string;
          homeCompetitor: { id: number; name: string };
          awayCompetitor: { id: number; name: string };
        };
      }>;
      name?: string;
    }> };
    
    if (!data.standings || data.standings.length === 0) {
      return c.json({ 
        competition: competitionKey,
        standings: [],
        message: "No standings found"
      });
    }

    // Get the main standings table (usually first one)
    const mainStandings = data.standings[0];
    
    const standings = mainStandings.rows.map(row => ({
      position: row.position,
      team: {
        id: row.competitor.id,
        name: row.competitor.name,
        shortName: row.competitor.symbolicName,
        color: row.competitor.color,
        imageVersion: row.competitor.imageVersion,
      },
      played: row.gamePlayed,
      won: row.gamesWon,
      drawn: row.gamesEven,
      lost: row.gamesLost,
      goalsFor: row.for,
      goalsAgainst: row.against,
      goalDiff: row.ratio,
      points: row.points,
      form: row.recentForm || [],
      recentMatches: row.detailedRecentForm?.slice(0, 5).map(m => ({
        id: m.id,
        date: m.startTime,
        home: m.homeCompetitor.name,
        away: m.awayCompetitor.name,
        homeScore: m.homeCompetitor.score,
        awayScore: m.awayCompetitor.score,
        result: m.outcome === 1 ? 'W' : m.outcome === 2 ? 'D' : 'L',
      })) || [],
      nextMatch: row.nextMatch ? {
        id: row.nextMatch.id,
        date: row.nextMatch.startTime,
        home: row.nextMatch.homeCompetitor.name,
        away: row.nextMatch.awayCompetitor.name,
      } : null,
    }));

    return c.json({
      competition: competitionKey,
      competitionName: competition.name,
      country: competition.country,
      tableName: mainStandings.name,
      standings,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("365Scores standings error:", error);
    return c.json({ error: "Failed to fetch standings" }, 500);
  }
});

// ============================================
// TheSportsDB API (Free - Brazilian 2026 Fixtures)
// ============================================

const THESPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";

// TheSportsDB League IDs
const THESPORTSDB_LEAGUES: Record<string, { id: number; name: string; season: string }> = {
  brasileirao_a: { id: 4351, name: "Brazilian Serie A", season: "2026" },
  brasileirao_b: { id: 4355, name: "Brazilian Serie B", season: "2026" },
  copa_do_brasil: { id: 4406, name: "Copa do Brasil", season: "2026" },
  premier_league: { id: 4328, name: "English Premier League", season: "2025-2026" },
  la_liga: { id: 4335, name: "Spanish La Liga", season: "2025-2026" },
  serie_a: { id: 4332, name: "Italian Serie A", season: "2025-2026" },
  bundesliga: { id: 4331, name: "German Bundesliga", season: "2025-2026" },
  ligue_1: { id: 4334, name: "French Ligue 1", season: "2025-2026" },
};

// Get upcoming fixtures from TheSportsDB
app.get("/api/thesportsdb/fixtures/:leagueKey", async (c) => {
  const leagueKey = c.req.param("leagueKey");
  const league = THESPORTSDB_LEAGUES[leagueKey];
  
  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  try {
    // Get upcoming/scheduled events for the league
    const url = `${THESPORTSDB_BASE}/eventsseason.php?id=${league.id}&s=${league.season}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      throw new Error(`TheSportsDB API error ${response.status}`);
    }

    const data = await response.json() as { events?: Array<{
      idEvent: string;
      strEvent: string;
      strHomeTeam: string;
      strAwayTeam: string;
      dateEvent: string;
      strTime: string;
      strTimestamp: string;
      intRound: string;
      strOfficial: string | null;
      strStatus: string | null;
      intHomeScore: string | null;
      intAwayScore: string | null;
      strVenue: string | null;
      idHomeTeam: string;
      idAwayTeam: string;
      strHomeTeamBadge: string | null;
      strAwayTeamBadge: string | null;
    }> };
    
    if (!data.events) {
      return c.json({
        league: leagueKey,
        leagueName: league.name,
        season: league.season,
        fixtures: [],
        message: "No fixtures found",
      });
    }

    // Get current date
    const now = new Date();
    
    // Filter and transform fixtures
    const fixtures = data.events
      .filter(event => {
        const eventDate = new Date(event.strTimestamp);
        // Include upcoming matches (not finished)
        return event.strStatus !== "Match Finished" || eventDate > now;
      })
      .map(event => ({
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

    return c.json({
      league: leagueKey,
      leagueName: league.name,
      season: league.season,
      fixtures,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("TheSportsDB fixtures error:", error);
    return c.json({ 
      error: "Failed to fetch fixtures",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Get past results from TheSportsDB
app.get("/api/thesportsdb/results/:leagueKey", async (c) => {
  const leagueKey = c.req.param("leagueKey");
  const league = THESPORTSDB_LEAGUES[leagueKey];
  
  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  try {
    // Get past events
    const url = `${THESPORTSDB_BASE}/eventspastleague.php?id=${league.id}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      throw new Error(`TheSportsDB API error ${response.status}`);
    }

    const data = await response.json() as { events?: Array<{
      idEvent: string;
      strEvent: string;
      strHomeTeam: string;
      strAwayTeam: string;
      dateEvent: string;
      strTimestamp: string;
      intRound: string;
      strOfficial: string | null;
      intHomeScore: string | null;
      intAwayScore: string | null;
      strVenue: string | null;
      idHomeTeam: string;
      idAwayTeam: string;
      strHomeTeamBadge: string | null;
      strAwayTeamBadge: string | null;
    }> };
    
    if (!data.events) {
      return c.json({
        league: leagueKey,
        leagueName: league.name,
        results: [],
      });
    }

    // Transform results (most recent first)
    const results = data.events
      .filter(event => event.intHomeScore !== null)
      .map(event => ({
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
        homeScore: parseInt(event.intHomeScore || "0"),
        awayScore: parseInt(event.intAwayScore || "0"),
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return c.json({
      league: leagueKey,
      leagueName: league.name,
      season: league.season,
      results,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("TheSportsDB results error:", error);
    return c.json({ 
      error: "Failed to fetch results",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Get next fixtures from TheSportsDB (next 15 events)
// For Brazilian leagues, use local data with referee info
app.get("/api/thesportsdb/next/:leagueKey", async (c) => {
  const leagueKey = c.req.param("leagueKey");
  const league = THESPORTSDB_LEAGUES[leagueKey];
  
  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  // Use local data for Brazilian leagues (has referee info)
  if (leagueKey === 'brasileirao_a' || leagueKey === 'brasileirao_b' || leagueKey === 'copa_do_brasil') {
    const localMatches = internationalFixtures[leagueKey as 'brasileirao_a' | 'brasileirao_b' | 'copa_do_brasil'] || [];
    
    // Filter to upcoming matches only (from today onwards)
    const now = new Date();
    const upcomingMatches = localMatches.filter(match => {
      const matchDate = new Date(match.date.replace(' ', 'T') + ':00');
      return matchDate >= now;
    });
    
    const fixtures = upcomingMatches.map(match => ({
      id: String(match.id),
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeTeamId: '',
      awayTeamId: '',
      homeTeamBadge: null,
      awayTeamBadge: null,
      date: match.date.split(' ')[0],
      time: match.date.split(' ')[1],
      timestamp: match.date.replace(' ', 'T') + ':00-03:00',
      round: `Rodada ${match.round}`,
      referee: match.referee || null,
      venue: null,
    }));
    
    return c.json({
      league: leagueKey,
      leagueName: league.name,
      season: league.season,
      fixtures,
      source: 'local',
      lastUpdated: new Date().toISOString(),
    });
  }

  // For other leagues, use TheSportsDB API
  try {
    const url = `${THESPORTSDB_BASE}/eventsnextleague.php?id=${league.id}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      throw new Error(`TheSportsDB API error ${response.status}`);
    }

    const data = await response.json() as { events?: Array<{
      idEvent: string;
      strEvent: string;
      strHomeTeam: string;
      strAwayTeam: string;
      dateEvent: string;
      strTime: string;
      strTimestamp: string;
      intRound: string;
      strOfficial: string | null;
      strVenue: string | null;
      idHomeTeam: string;
      idAwayTeam: string;
      strHomeTeamBadge: string | null;
      strAwayTeamBadge: string | null;
    }> };
    
    if (!data.events) {
      return c.json({
        league: leagueKey,
        leagueName: league.name,
        fixtures: [],
      });
    }

    const fixtures = data.events.map(event => ({
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
    }));

    return c.json({
      league: leagueKey,
      leagueName: league.name,
      season: league.season,
      fixtures,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("TheSportsDB next fixtures error:", error);
    return c.json({ 
      error: "Failed to fetch next fixtures",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Get event details (for referee info)
app.get("/api/thesportsdb/event/:eventId", async (c) => {
  const eventId = c.req.param("eventId");

  try {
    const url = `${THESPORTSDB_BASE}/lookupevent.php?id=${eventId}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      throw new Error(`TheSportsDB API error ${response.status}`);
    }

    const data = await response.json() as { events?: Array<{
      idEvent: string;
      strEvent: string;
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
      strHomeLineupGoalkeeper: string | null;
      strAwayLineupGoalkeeper: string | null;
      strHomeLineupDefense: string | null;
      strAwayLineupDefense: string | null;
      strHomeLineupMidfield: string | null;
      strAwayLineupMidfield: string | null;
      strHomeLineupForward: string | null;
      strAwayLineupForward: string | null;
      idHomeTeam: string;
      idAwayTeam: string;
      strHomeTeamBadge: string | null;
      strAwayTeamBadge: string | null;
      intSpectators: string | null;
    }> };
    
    if (!data.events || data.events.length === 0) {
      return c.json({ error: "Event not found" }, 404);
    }

    const event = data.events[0];
    
    return c.json({
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
      lineups: {
        home: {
          goalkeeper: event.strHomeLineupGoalkeeper,
          defense: event.strHomeLineupDefense,
          midfield: event.strHomeLineupMidfield,
          forward: event.strHomeLineupForward,
        },
        away: {
          goalkeeper: event.strAwayLineupGoalkeeper,
          defense: event.strAwayLineupDefense,
          midfield: event.strAwayLineupMidfield,
          forward: event.strAwayLineupForward,
        },
      },
    });
  } catch (error) {
    console.error("TheSportsDB event error:", error);
    return c.json({ 
      error: "Failed to fetch event",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Get available TheSportsDB leagues
app.get("/api/thesportsdb/leagues", (c) => {
  const leagues = Object.entries(THESPORTSDB_LEAGUES).map(([key, value]) => ({
    key,
    ...value,
  }));
  return c.json(leagues);
});

// Get live matches from Sofascore
app.get("/api/sofascore-direct/live", async (c) => {
  try {
    const response = await fetch("https://api.sofascore.com/api/v1/sport/football/events/live", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });

    if (!response.ok) {
      return c.json({ matches: [], source: "sofascore", error: "API unavailable" });
    }

    const data = await response.json() as { 
      events?: Array<{
        id: number;
        tournament?: { name: string; uniqueTournament?: { name: string } };
        homeTeam: { name: string; id: number };
        awayTeam: { name: string; id: number };
        homeScore?: { current?: number };
        awayScore?: { current?: number };
        status?: { description?: string; type?: string };
        time?: { currentPeriodStartTimestamp?: number };
      }> 
    };

    const liveMatches = (data.events || []).map(event => ({
      id: event.id,
      homeTeam: {
        id: event.homeTeam.id,
        name: event.homeTeam.name,
        score: event.homeScore?.current ?? 0,
      },
      awayTeam: {
        id: event.awayTeam.id,
        name: event.awayTeam.name,
        score: event.awayScore?.current ?? 0,
      },
      competition: event.tournament?.uniqueTournament?.name || event.tournament?.name || "Unknown",
      statusText: event.status?.description || "Ao vivo",
      source: "sofascore",
    }));

    return c.json({
      matches: liveMatches,
      count: liveMatches.length,
      source: "sofascore",
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Sofascore live error:", error);
    return c.json({ matches: [], source: "sofascore", error: "Failed to fetch" });
  }
});

// Get live matches across all competitions
app.get("/api/365scores/live", async (c) => {
  try {
    // Get all competition IDs
    const competitionIds = Object.values(SCORES365_COMPETITIONS).map(c => c.id).join(",");
    
    const data = await scores365Get("/web/games/current/", {
      competitions: competitionIds,
    }) as { games?: Array<{
      id: number;
      statusId: number;
      statusText: string;
      gameTime?: number;
      gameTimeDisplay?: string;
      startTime: string;
      homeCompetitor: { id: number; name: string; score?: number };
      awayCompetitor: { id: number; name: string; score?: number };
      competitionId: number;
      competitionDisplayName?: string;
    }> };
    
    if (!data.games) {
      return c.json({ matches: [], message: "No live matches" });
    }

    // Filter to live matches: statusId 2 = in progress, 3 = halftime/break, 5 = penalties
    // Also include status 6-9 which can indicate extra time, delays, etc.
    const liveStatusIds = [2, 3, 5, 6, 7, 8, 9];
    
    const liveMatches = data.games
      .filter(game => liveStatusIds.includes(game.statusId))
      .map(game => ({
        id: game.id,
        minute: game.gameTime || game.gameTimeDisplay,
        statusText: game.statusText,
        homeTeam: {
          id: game.homeCompetitor.id,
          name: game.homeCompetitor.name,
          score: game.homeCompetitor.score || 0,
        },
        awayTeam: {
          id: game.awayCompetitor.id,
          name: game.awayCompetitor.name,
          score: game.awayCompetitor.score || 0,
        },
        competition: game.competitionDisplayName,
        competitionId: game.competitionId,
        statusId: game.statusId,
      }));

    return c.json({
      matches: liveMatches,
      count: liveMatches.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("365Scores live error:", error);
    return c.json({ error: "Failed to fetch live matches" }, 500);
  }
});

export default app;
