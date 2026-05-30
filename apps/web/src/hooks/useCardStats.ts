import { useState, useEffect, useCallback } from 'react';
import { TeamCardStats, CardStatsResponse } from '@/shared/footballDataTypes';

/**
 * Hook to fetch card statistics for a league
 */
export function useCardStats(leagueId: string | null) {
  const [data, setData] = useState<CardStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!leagueId) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/corner-stats/cards/${leagueId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Estatísticas de cartões não disponíveis para esta liga');
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
        setData(null);
        return;
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching card stats:', err);
      setError('Erro ao carregar estatísticas de cartões');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { data, isLoading, error, refetch: fetchStats };
}

/**
 * Get a specific team's card stats from the response
 */
export function getTeamCardStats(
  data: CardStatsResponse | null, 
  teamName: string
): TeamCardStats | undefined {
  if (!data) return undefined;
  
  const normalizedSearch = teamName.toLowerCase().trim();
  
  return data.teams.find(t => {
    const normalizedTeam = t.team.toLowerCase();
    return normalizedTeam === normalizedSearch || 
           normalizedTeam.includes(normalizedSearch) ||
           normalizedSearch.includes(normalizedTeam);
  });
}
