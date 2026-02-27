import { useState, useEffect, useCallback } from "react";

// Tipos baseados na resposta da API do Sofascore
export interface SofascoreTeam {
  id: number;
  name: string;
  shortName: string;
  slug: string;
}

export interface SofascoreMatch {
  id: number;
  tournament: {
    name: string;
    slug: string;
  };
  season: {
    name: string;
    year: string;
  };
  roundInfo?: {
    round: number;
    name?: string;
  };
  status: {
    code: number;
    description: string;
    type: string;
  };
  homeTeam: SofascoreTeam;
  awayTeam: SofascoreTeam;
  homeScore?: {
    current?: number;
    display?: number;
  };
  awayScore?: {
    current?: number;
    display?: number;
  };
  startTimestamp: number;
}

export interface SofascoreFixturesResponse {
  events: SofascoreMatch[];
  hasNextPage: boolean;
}

export interface SofascoreTeamStats {
  statistics: {
    corners?: number;
    cornersAgainst?: number;
    matches?: number;
    [key: string]: any;
  };
}

// Hook para buscar próximos jogos
export function useSofascoreFixtures(league: "brasileirao_a" | "brasileirao_b" = "brasileirao_a") {
  const [fixtures, setFixtures] = useState<SofascoreMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFixtures = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sofascore/fixtures/${league}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch fixtures");
      }

      // A API retorna { events: [...] }
      const events = data.events || [];
      setFixtures(events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  }, [league]);

  useEffect(() => {
    fetchFixtures();
  }, [fetchFixtures]);

  return { fixtures, loading, error, refetch: fetchFixtures };
}

// Hook para buscar estatísticas de um time
export function useSofascoreTeamStats(teamId: number | null) {
  const [stats, setStats] = useState<SofascoreTeamStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!teamId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sofascore/team/${teamId}/stats`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch team stats");
      }

      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

// Hook para buscar estatísticas de uma partida
export function useSofascoreMatchStats(matchId: number | null) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!matchId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sofascore/match/${matchId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch match stats");
      }

      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

// Hook para buscar tabela de classificação
export function useSofascoreStandings(league: "brasileirao_a" | "brasileirao_b" = "brasileirao_a") {
  const [standings, setStandings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStandings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sofascore/standings/${league}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch standings");
      }

      setStandings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStandings(null);
    } finally {
      setLoading(false);
    }
  }, [league]);

  useEffect(() => {
    fetchStandings();
  }, [fetchStandings]);

  return { standings, loading, error, refetch: fetchStandings };
}

// Função helper para formatar timestamp do Sofascore
// O timestamp é em UTC, precisamos converter para horário de Brasília
export function formatSofascoreDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Função helper para agrupar jogos por rodada
export function groupMatchesByRound(matches: SofascoreMatch[]): Map<number, SofascoreMatch[]> {
  const grouped = new Map<number, SofascoreMatch[]>();
  
  for (const match of matches) {
    const round = match.roundInfo?.round || 0;
    if (!grouped.has(round)) {
      grouped.set(round, []);
    }
    grouped.get(round)!.push(match);
  }
  
  return grouped;
}
