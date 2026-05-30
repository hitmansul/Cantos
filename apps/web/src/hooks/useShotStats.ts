import { useState, useEffect, useCallback } from 'react';
import { TeamShotStats, ShotStatsResponse } from '@/shared/footballDataTypes';

/**
 * Hook to fetch shot statistics for a league
 */
export function useShotStats(leagueId: string | null) {
  const [data, setData] = useState<ShotStatsResponse | null>(null);
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
      const response = await fetch(`/api/corner-stats/shots/${leagueId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Estatísticas de finalizações não disponíveis para esta liga');
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
        setData(null);
        return;
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching shot stats:', err);
      setError('Erro ao carregar estatísticas de finalizações');
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
 * Get a specific team's shot stats from the response
 */
export function getTeamShotStats(
  data: ShotStatsResponse | null, 
  teamName: string
): TeamShotStats | undefined {
  if (!data) return undefined;
  
  const normalizedSearch = teamName.toLowerCase().trim();
  
  return data.teams.find(t => {
    const normalizedTeam = t.team.toLowerCase();
    return normalizedTeam === normalizedSearch || 
           normalizedTeam.includes(normalizedSearch) ||
           normalizedSearch.includes(normalizedTeam);
  });
}
