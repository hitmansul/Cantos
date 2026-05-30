import { useState, useCallback } from "react";
import type { ScrapedLeagueData, ScrapedTeamStats } from "@/worker/cornerStatsScraper";

// Re-export types for frontend use
export type { ScrapedLeagueData, ScrapedTeamStats };

interface ScrapingLeague {
  id: string;
  name: string;
  url: string;
}

// Hook to get available scraping leagues
export function useScrapingLeagues() {
  const [leagues, setLeagues] = useState<ScrapingLeague[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeagues = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/scrape/leagues");
      if (!res.ok) throw new Error("Failed to fetch leagues");
      const data = await res.json();
      setLeagues(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  return { leagues, loading, error, fetchLeagues };
}

// Hook to scrape league stats
export function useScrapedLeagueStats() {
  const [data, setData] = useState<ScrapedLeagueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrapeLeague = useCallback(async (leagueKey: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/scrape/league/${leagueKey}`);
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.message || json.error || "Failed to scrape league");
      }
      
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearData = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, loading, error, scrapeLeague, clearData };
}

// Hook to scrape team details
export function useScrapedTeamDetails() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrapeTeam = useCallback(async (teamSlug: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/scrape/team/${teamSlug}`);
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.message || json.error || "Failed to scrape team");
      }
      
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearData = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, loading, error, scrapeTeam, clearData };
}

// Hook to scrape upcoming matches
export function useScrapedUpcomingMatches() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const scrapeUpcoming = useCallback(async (leagueKey: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/scrape/upcoming/${leagueKey}`);
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.message || json.error || "Failed to scrape matches");
      }
      
      setMatches(json.matches || []);
      setLastUpdated(json.lastUpdated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearData = useCallback(() => {
    setMatches([]);
    setError(null);
    setLastUpdated(null);
  }, []);

  return { matches, loading, error, lastUpdated, scrapeUpcoming, clearData };
}
