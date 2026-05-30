import { useState, useEffect, useCallback } from "react";
import type { TeamCornerStats, H2HResponse, LeagueConfig } from "@/shared/footballDataTypes";

// Fetch league stats from Football-Data.co.uk
export function useLeagueStats() {
  const [stats, setStats] = useState<{ teams: TeamCornerStats[]; matchesAnalyzed?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (leagueId: string) => {
    if (!leagueId) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/football-data/${leagueId}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      const result = await res.json();
      setStats({ 
        teams: result.teams || [],
        matchesAnalyzed: result.matchesAnalyzed || result.teams?.length || 0
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading, error, fetchStats, refetch: fetchStats };
}

// Get H2H data between two teams from a league
export function useH2H() {
  const [h2h, setH2h] = useState<H2HResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchH2H = useCallback(async (leagueId: string, team1: string, team2: string) => {
    if (!leagueId || !team1 || !team2) {
      setH2h(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/football-data/${leagueId}/h2h?team1=${encodeURIComponent(team1)}&team2=${encodeURIComponent(team2)}`);
      if (!res.ok) throw new Error("Failed to fetch H2H");
      const result = await res.json();
      setH2h(result as H2HResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setH2h(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearH2H = useCallback(() => {
    setH2h(null);
    setError(null);
  }, []);

  return { h2h, loading, error, fetchH2H, clearH2H };
}

// Get available leagues from API
export function useLeagues() {
  const [leagues, setLeagues] = useState<LeagueConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeagues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leagues");
      if (!res.ok) throw new Error("Failed to fetch leagues");
      const data = await res.json();
      setLeagues(data.leagues || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar ligas");
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  return { leagues, loading, error, fetchLeagues };
}
