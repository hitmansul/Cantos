/**
 * TheSportsDB API hooks
 * For fetching Brazilian Serie A 2026 fixtures and results
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api/thesportsdb';

export interface TheSportsDBFixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamBadge: string | null;
  awayTeamBadge: string | null;
  date: string;
  time: string;
  timestamp: string;
  round: string;
  referee: string | null;
  venue: string | null;
  status?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
}

export interface TheSportsDBResult {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamBadge: string | null;
  awayTeamBadge: string | null;
  date: string;
  timestamp: string;
  round: string;
  referee: string | null;
  venue: string | null;
  homeScore: number;
  awayScore: number;
}

export interface TheSportsDBLeague {
  key: string;
  id: number;
  name: string;
  season: string;
}

// Hook to fetch fixtures for a league
export function useTheSportsDBFixtures(leagueKey: string) {
  const [fixtures, setFixtures] = useState<TheSportsDBFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFixtures = useCallback(async () => {
    if (!leagueKey) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/fixtures/${leagueKey}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch fixtures: ${response.status}`);
      }
      
      const data = await response.json();
      setFixtures(data.fixtures || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch fixtures');
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  }, [leagueKey]);

  useEffect(() => {
    fetchFixtures();
  }, [fetchFixtures]);

  return { fixtures, loading, error, refetch: fetchFixtures };
}

// Hook to fetch next fixtures (upcoming matches)
export function useTheSportsDBNextFixtures(leagueKey: string) {
  const [fixtures, setFixtures] = useState<TheSportsDBFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNextFixtures = useCallback(async () => {
    if (!leagueKey) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/next/${leagueKey}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch next fixtures: ${response.status}`);
      }
      
      const data = await response.json();
      setFixtures(data.fixtures || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch fixtures');
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  }, [leagueKey]);

  useEffect(() => {
    fetchNextFixtures();
  }, [fetchNextFixtures]);

  return { fixtures, loading, error, refetch: fetchNextFixtures };
}

// Hook to fetch results for a league
export function useTheSportsDBResults(leagueKey: string) {
  const [results, setResults] = useState<TheSportsDBResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    if (!leagueKey) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/results/${leagueKey}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch results: ${response.status}`);
      }
      
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch results');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [leagueKey]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  return { results, loading, error, refetch: fetchResults };
}

// Hook to fetch event details
export function useTheSportsDBEvent(eventId: string | null) {
  const [event, setEvent] = useState<TheSportsDBFixture | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    if (!eventId) {
      setEvent(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/event/${eventId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch event: ${response.status}`);
      }
      
      const data = await response.json();
      setEvent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch event');
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  return { event, loading, error, refetch: fetchEvent };
}

// Hook to fetch available leagues
export function useTheSportsDBLeagues() {
  const [leagues, setLeagues] = useState<TheSportsDBLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        const response = await fetch(`${API_BASE}/leagues`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch leagues: ${response.status}`);
        }
        
        const data = await response.json();
        setLeagues(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch leagues');
        setLeagues([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeagues();
  }, []);

  return { leagues, loading, error };
}

// Helper to get upcoming matches for the next N days
export function filterUpcomingMatches(
  fixtures: TheSportsDBFixture[], 
  days: number = 7
): TheSportsDBFixture[] {
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  
  return fixtures.filter(fixture => {
    const matchDate = new Date(fixture.timestamp);
    return matchDate >= now && matchDate <= futureDate;
  });
}

// Helper to group fixtures by round
export function groupFixturesByRound(
  fixtures: TheSportsDBFixture[]
): Record<string, TheSportsDBFixture[]> {
  return fixtures.reduce((acc, fixture) => {
    const round = fixture.round || 'Unknown';
    if (!acc[round]) {
      acc[round] = [];
    }
    acc[round].push(fixture);
    return acc;
  }, {} as Record<string, TheSportsDBFixture[]>);
}

// Helper to format match date
export function formatMatchDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
