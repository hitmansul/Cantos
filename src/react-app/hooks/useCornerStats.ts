import { useState, useCallback } from "react";
import type { LeagueConfig, TeamCornerStats, LeagueStatsResponse, H2HResponse } from "@/shared/footballDataTypes";

interface UseLeaguesResult {
  leagues: LeagueConfig[];
  loading: boolean;
  error: string | null;
  fetchLeagues: () => Promise<void>;
}

interface UseLeagueStatsResult {
  stats: LeagueStatsResponse | null;
  loading: boolean;
  error: string | null;
  fetchStats: (leagueId: string) => Promise<void>;
}

interface UseTeamSearchResult {
  results: TeamCornerStats[];
  loading: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
}

/**
 * Hook to fetch available leagues
 */
export function useLeagues(): UseLeaguesResult {
  const [leagues, setLeagues] = useState<LeagueConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeagues = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/corner-stats/leagues");
      if (!response.ok) throw new Error("Failed to fetch leagues");
      
      const data = await response.json();
      setLeagues(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  return { leagues, loading, error, fetchLeagues };
}

/**
 * Hook to fetch statistics for a specific league
 */
export function useLeagueStats(): UseLeagueStatsResult {
  const [stats, setStats] = useState<LeagueStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (leagueId: string) => {
    setLoading(true);
    setError(null);
    setStats(null);
    
    try {
      const response = await fetch(`/api/corner-stats/league/${leagueId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch league stats");
      }
      
      const data: LeagueStatsResponse = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading, error, fetchStats };
}

/**
 * Hook to search for teams across leagues
 */
export function useTeamSearch(): UseTeamSearchResult {
  const [results, setResults] = useState<TeamCornerStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/corner-stats/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Search failed");
      
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, search };
}

interface UseH2HResult {
  h2h: H2HResponse | null;
  loading: boolean;
  error: string | null;
  fetchH2H: (leagueId: string, team1: string, team2: string) => Promise<void>;
  clearH2H: () => void;
}

/**
 * Hook to fetch head-to-head statistics between two teams
 */
export function useH2H(): UseH2HResult {
  const [h2h, setH2H] = useState<H2HResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchH2H = useCallback(async (leagueId: string, team1: string, team2: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/corner-stats/h2h/${leagueId}?team1=${encodeURIComponent(team1)}&team2=${encodeURIComponent(team2)}`
      );
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch H2H stats");
      }
      
      const data: H2HResponse = await response.json();
      setH2H(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const clearH2H = useCallback(() => {
    setH2H(null);
    setError(null);
  }, []);

  return { h2h, loading, error, fetchH2H, clearH2H };
}
