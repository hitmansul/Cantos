import { useState, useCallback } from "react";
import type { TeamCornerStats } from "@/data/cornerStats";

// Database team stats response format
interface DBTeamStats {
  id: number;
  team_id: number;
  team_name: string;
  short_name: string;
  season: string;
  games_played: number;
  avg_corners: number;
  home_avg: number;
  away_avg: number;
  over_85_pct: number;
  over_95_pct: number;
  over_105_pct: number;
  over_115_pct: number;
  home_games: number;
  away_games: number;
  games_winning: number;
  games_drawing: number;
  games_losing: number;
  corners_when_winning: number;
  corners_when_drawing: number;
  corners_when_losing: number;
  last_5_avg: number;
  recent_matches: string;
}

// Database upcoming match response format
interface DBUpcomingMatch {
  id: number;
  home_team: string;
  away_team: string;
  match_date: string;
  match_time: string;
  league: string;
  round: string;
  referee: string;
  home_corners: number | null;
  away_corners: number | null;
  is_completed: number;
}

// Database H2H response format
interface DBH2H {
  id: number;
  team1: string;
  team2: string;
  total_matches: number;
  avg_corners: number;
  last_match_date: string;
  last_match_corners: number;
  recent_matches: string;
}

// Transform DB format to app format (matches cornerStats.ts TeamCornerStats)
function transformDBTeamStats(dbStats: DBTeamStats[], league: string): TeamCornerStats[] {
  return dbStats.map(stat => ({
    team: stat.team_name,
    league: league,
    avgCornersFor: stat.avg_corners || 0,
    avgCornersAgainst: 0, // Calculate from other data if available
    avgTotalCorners: (stat.avg_corners || 0) * 2, // Approximate
    over85Pct: stat.over_85_pct || 0,
    over95Pct: stat.over_95_pct || 0,
    over105Pct: stat.over_105_pct || 0,
    firstCornerPct: 50, // Not stored in DB, default to 50%
    gamesPlayed: stat.games_played || 0,
  }));
}

// Fetch team stats from database with fallback
export function useDatabaseTeamStats() {
  const [stats, setStats] = useState<TeamCornerStats[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"database" | "static" | null>(null);

  const fetchStats = useCallback(async (
    league: string,
    fallbackData: TeamCornerStats[]
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/stats/teams/${encodeURIComponent(league)}?season=2026`);
      
      if (res.ok) {
        const dbStats: DBTeamStats[] = await res.json();
        
        // Check if we have meaningful data in the database
        if (dbStats && dbStats.length > 0) {
          const transformed = transformDBTeamStats(dbStats, league);
          setStats(transformed);
          setSource("database");
          return;
        }
      }
      
      // Fallback to static data
      setStats(fallbackData);
      setSource("static");
    } catch (err) {
      console.warn("Database fetch failed, using static data:", err);
      setStats(fallbackData);
      setSource("static");
      setError(null); // Don't show error since we have fallback
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading, error, source, fetchStats };
}

// Fetch upcoming matches from database with fallback
export function useDatabaseMatches() {
  const [matches, setMatches] = useState<DBUpcomingMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"database" | "static" | null>(null);

  const fetchMatches = useCallback(async (
    league: string,
    fallbackMatches: any[]
  ) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/stats/matches/${encodeURIComponent(league)}`);
      
      if (res.ok) {
        const dbMatches: DBUpcomingMatch[] = await res.json();
        
        if (dbMatches && dbMatches.length > 0) {
          setMatches(dbMatches);
          setSource("database");
          return;
        }
      }
      
      // Fallback to static data
      setMatches(fallbackMatches);
      setSource("static");
    } catch (err) {
      console.warn("Database fetch failed, using static data:", err);
      setMatches(fallbackMatches);
      setSource("static");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAllMatches = useCallback(async (fallbackMatches: any[]) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stats/matches");
      
      if (res.ok) {
        const dbMatches: DBUpcomingMatch[] = await res.json();
        
        if (dbMatches && dbMatches.length > 0) {
          setMatches(dbMatches);
          setSource("database");
          return;
        }
      }
      
      setMatches(fallbackMatches);
      setSource("static");
    } catch (err) {
      console.warn("Database fetch failed, using static data:", err);
      setMatches(fallbackMatches);
      setSource("static");
    } finally {
      setLoading(false);
    }
  }, []);

  return { matches, loading, error, source, fetchMatches, fetchAllMatches };
}

// Fetch H2H from database with fallback
export function useDatabaseH2H() {
  const [h2h, setH2H] = useState<DBH2H | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"database" | "static" | null>(null);

  const fetchH2H = useCallback(async (
    team1: string,
    team2: string,
    fallbackData: any
  ) => {
    if (!team1 || !team2) {
      setH2H(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/stats/h2h?team1=${encodeURIComponent(team1)}&team2=${encodeURIComponent(team2)}`
      );
      
      if (res.ok) {
        const dbH2H: DBH2H = await res.json();
        
        if (dbH2H && dbH2H.total_matches > 0) {
          setH2H(dbH2H);
          setSource("database");
          return;
        }
      }
      
      // Fallback to static data
      setH2H(fallbackData);
      setSource("static");
    } catch (err) {
      console.warn("Database H2H fetch failed, using static data:", err);
      setH2H(fallbackData);
      setSource("static");
    } finally {
      setLoading(false);
    }
  }, []);

  const clearH2H = useCallback(() => {
    setH2H(null);
    setSource(null);
  }, []);

  return { h2h, loading, error, source, fetchH2H, clearH2H };
}

// Export types for use in components
export type { DBTeamStats, DBUpcomingMatch, DBH2H };
