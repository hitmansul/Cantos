import { useState, useCallback } from 'react';

// Team corner statistics from Sofascore
export interface SofascoreTeamCorners {
  team: string;
  teamId: number;
  matches: number;
  corners: number;
  cornersAgainst: number;
  avgCorners: number;
  avgCornersAgainst: number;
  avgTotalCorners: number;
}

// Single team corner stats response
export interface SofascoreTeamStats {
  teamId: number;
  tournamentId: number;
  seasonId: number;
  matches: number;
  corners: number;
  cornersAgainst: number;
  avgCorners: number;
  avgCornersAgainst: number;
  avgTotalCorners: number;
  shots: number;
  shotsOnTarget: number;
  possession: number;
  goalsScored: number;
  goalsConceded: number;
}

// Tournament corner stats response
export interface SofascoreTournamentCorners {
  tournamentId: number;
  seasonId: number;
  teams: SofascoreTeamCorners[];
  lastUpdated: string;
}

// Match statistics
export interface SofascoreMatchStats {
  matchId: number;
  homeCorners: number;
  awayCorners: number;
  totalCorners: number;
  // Half-time corner stats
  homeCorners1stHalf: number;
  awayCorners1stHalf: number;
  totalCorners1stHalf: number;
  homeCorners2ndHalf: number;
  awayCorners2ndHalf: number;
  totalCorners2ndHalf: number;
}

// Half-time corner stats for a team
export interface SofascoreHalftimeTeamStats {
  team: string;
  teamId: number;
  matches: number;
  avgCorners1stHalf: number;
  avgCornersAgainst1stHalf: number;
  avgCorners2ndHalf: number;
  avgCornersAgainst2ndHalf: number;
  avgTotal1stHalf: number;
  avgTotal2ndHalf: number;
  avgTotalCorners: number;
}

// Half-time tournament stats response
export interface SofascoreHalftimeResponse {
  tournamentId: number;
  seasonId: number;
  teams: SofascoreHalftimeTeamStats[];
  matchesAnalyzed: number;
  lastUpdated: string;
}

// Tournament configs with season IDs
// Brasileirão: Temporada 2026 (atual)
// European leagues: 2025/26 season (current)
export const SOFASCORE_TOURNAMENTS = {
  // Brasil
  brasileirao_a: {
    id: 325,
    seasonId: 58766,
    name: 'Brasileirão Série A',
    flag: '🇧🇷',
    season: '2026',
  },
  brasileirao_b: {
    id: 390,
    seasonId: 58767,
    name: 'Brasileirão Série B',
    flag: '🇧🇷',
    season: '2026',
  },
  copa_do_brasil: { id: 339, seasonId: 58770, name: 'Copa do Brasil', flag: '🇧🇷', season: '2026' },

  // Inglaterra
  premier_league: {
    id: 17,
    seasonId: 61627,
    name: 'Premier League',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    season: '2025/26',
  },
  championship: { id: 18, seasonId: 61628, name: 'Championship', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', season: '2025/26' },
  league_one: { id: 19, seasonId: 61631, name: 'League One', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', season: '2025/26' },
  league_two: { id: 20, seasonId: 61630, name: 'League Two', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', season: '2025/26' },

  // Espanha
  la_liga: { id: 8, seasonId: 61643, name: 'La Liga', flag: '🇪🇸', season: '2025/26' },
  segunda_division: {
    id: 54,
    seasonId: 61647,
    name: 'Segunda División',
    flag: '🇪🇸',
    season: '2025/26',
  },

  // Itália
  serie_a: { id: 23, seasonId: 61639, name: 'Serie A', flag: '🇮🇹', season: '2025/26' },
  serie_b_italy: { id: 53, seasonId: 61641, name: 'Serie B', flag: '🇮🇹', season: '2025/26' },

  // Alemanha
  bundesliga: { id: 35, seasonId: 63653, name: 'Bundesliga', flag: '🇩🇪', season: '2025/26' },
  bundesliga_2: { id: 44, seasonId: 63655, name: '2. Bundesliga', flag: '🇩🇪', season: '2025/26' },

  // França
  ligue_1: { id: 34, seasonId: 61632, name: 'Ligue 1', flag: '🇫🇷', season: '2025/26' },
  ligue_2: { id: 182, seasonId: 61633, name: 'Ligue 2', flag: '🇫🇷', season: '2025/26' },

  // Outros países europeus
  eredivisie: { id: 37, seasonId: 61629, name: 'Eredivisie', flag: '🇳🇱', season: '2025/26' },
  primeira_liga: { id: 238, seasonId: 61648, name: 'Primeira Liga', flag: '🇵🇹', season: '2025/26' },
  belgian_pro: {
    id: 144,
    seasonId: 61640,
    name: 'Jupiler Pro League',
    flag: '🇧🇪',
    season: '2025/26',
  },
  turkish_super: { id: 52, seasonId: 61636, name: 'Süper Lig', flag: '🇹🇷', season: '2025/26' },
  greek_super: {
    id: 310,
    seasonId: 61649,
    name: 'Super League Greece',
    flag: '🇬🇷',
    season: '2025/26',
  },

  // Escócia
  scottish_prem: {
    id: 36,
    seasonId: 61634,
    name: 'Scottish Premiership',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    season: '2025/26',
  },
  scottish_champ: {
    id: 67,
    seasonId: 61635,
    name: 'Scottish Championship',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    season: '2025/26',
  },
  scottish_league_one: {
    id: 68,
    seasonId: 61636,
    name: 'Scottish League One',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    season: '2025/26',
  },
  scottish_league_two: {
    id: 69,
    seasonId: 61637,
    name: 'Scottish League Two',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    season: '2025/26',
  },

  // UEFA
  champions_league: {
    id: 7,
    seasonId: 61644,
    name: 'Champions League',
    flag: '🏆',
    season: '2025/26',
  },
  europa_league: { id: 679, seasonId: 61645, name: 'Europa League', flag: '🥈', season: '2025/26' },

  // América
  libertadores: { id: 384, seasonId: 58771, name: 'Copa Libertadores', flag: '🏆', season: '2026' },
  sul_americana: {
    id: 480,
    seasonId: 58772,
    name: 'Copa Sul-Americana',
    flag: '🥈',
    season: '2026',
  },
  liga_mx: { id: 352, seasonId: 62820, name: 'Liga MX', flag: '🇲🇽', season: '2025/26' },
  mls: { id: 242, seasonId: 62821, name: 'MLS', flag: '🇺🇸', season: '2026' },
  argentina: { id: 155, seasonId: 61650, name: 'Liga Profesional', flag: '🇦🇷', season: '2026' },
  argentina_2: { id: 156, seasonId: 61651, name: 'Primera Nacional', flag: '🇦🇷', season: '2026' },

  // Mais ligas europeias
  liga_3: { id: 491, seasonId: 63656, name: '3. Liga', flag: '🇩🇪', season: '2025/26' },
  liga_portugal_2: {
    id: 239,
    seasonId: 61652,
    name: 'Liga Portugal 2',
    flag: '🇵🇹',
    season: '2025/26',
  },
  conference_league: {
    id: 17015,
    seasonId: 61646,
    name: 'Conference League',
    flag: '🥉',
    season: '2025/26',
  },
  austrian: {
    id: 45,
    seasonId: 61653,
    name: 'Bundesliga Österreich',
    flag: '🇦🇹',
    season: '2025/26',
  },
  swiss_super: { id: 215, seasonId: 61654, name: 'Super League', flag: '🇨🇭', season: '2025/26' },
  russian_premier: {
    id: 203,
    seasonId: 61655,
    name: 'Premier Liga',
    flag: '🇷🇺',
    season: '2025/26',
  },
  ukrainian_premier: {
    id: 218,
    seasonId: 61656,
    name: 'Premier Liga',
    flag: '🇺🇦',
    season: '2025/26',
  },
  danish_super: { id: 271, seasonId: 61657, name: 'Superliga', flag: '🇩🇰', season: '2025/26' },
  swedish_allsvenskan: { id: 40, seasonId: 61658, name: 'Allsvenskan', flag: '🇸🇪', season: '2025' },
  norwegian_eliteserien: {
    id: 42,
    seasonId: 61659,
    name: 'Eliteserien',
    flag: '🇳🇴',
    season: '2025',
  },
  national_league: {
    id: 24,
    seasonId: 61660,
    name: 'National League',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    season: '2025/26',
  },

  // Brasil - Estaduais (SofaScore IDs — correct unique tournament IDs)
  paulistao: { id: 553, seasonId: 58773, name: 'Campeonato Paulista', flag: '🇧🇷', season: '2026' },
  carioca: { id: 390, seasonId: 58774, name: 'Campeonato Carioca', flag: '🇧🇷', season: '2026' },
  mineiro: { id: 386, seasonId: 58775, name: 'Campeonato Mineiro', flag: '🇧🇷', season: '2026' },
  gaucho: { id: 387, seasonId: 58776, name: 'Campeonato Gaúcho', flag: '🇧🇷', season: '2026' },
} as const;

export type SofascoreTournament = keyof typeof SOFASCORE_TOURNAMENTS;

// Hook to fetch tournament corner stats
export function useSofascoreCorners() {
  const [stats, setStats] = useState<SofascoreTournamentCorners | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCorners = useCallback(async (tournament: SofascoreTournament) => {
    const config = SOFASCORE_TOURNAMENTS[tournament];
    if (!config) {
      setError('Invalid tournament');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/sofascore-direct/tournament/${config.id}/corners?seasonId=${config.seasonId}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch corner stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setStats(null);
    setError(null);
  }, []);

  return { stats, loading, error, fetchCorners, clear };
}

// Hook to fetch single team corner stats
export function useSofascoreTeamStats() {
  const [stats, setStats] = useState<SofascoreTeamStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamStats = useCallback(async (teamId: number, tournament: SofascoreTournament) => {
    const config = SOFASCORE_TOURNAMENTS[tournament];
    if (!config) {
      setError('Invalid tournament');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/sofascore-direct/team/${teamId}/corners?tournamentId=${config.id}&seasonId=${config.seasonId}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch team stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading, error, fetchTeamStats };
}

// Hook to fetch match corner stats
export function useSofascoreMatchStats() {
  const [stats, setStats] = useState<SofascoreMatchStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMatchStats = useCallback(async (matchId: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sofascore-direct/match/${matchId}/statistics`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch match stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading, error, fetchMatchStats };
}

// Hook to fetch half-time corner stats for a tournament
export function useSofascoreHalftimeCorners() {
  const [stats, setStats] = useState<SofascoreHalftimeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHalftimeCorners = useCallback(async (tournament: SofascoreTournament) => {
    const config = SOFASCORE_TOURNAMENTS[tournament];
    if (!config) {
      setError('Invalid tournament');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/sofascore-direct/tournament/${config.id}/halftime-corners?seasonId=${config.seasonId}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch half-time corner stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setStats(null);
    setError(null);
  }, []);

  return { stats, loading, error, fetchHalftimeCorners, clear };
}
