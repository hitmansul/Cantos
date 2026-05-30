import { useState, useEffect, useCallback } from 'react';

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

// Tipos de liga disponíveis
export type SofascoreLeague =
  | 'brasileirao_a'
  | 'brasileirao_b'
  | 'copa_do_brasil'
  | 'premier_league'
  | 'championship'
  | 'league_one'
  | 'league_two'
  | 'national_league'
  | 'la_liga'
  | 'segunda_division'
  | 'serie_a'
  | 'serie_b_italy'
  | 'bundesliga'
  | 'bundesliga_2'
  | 'liga_3'
  | 'ligue_1'
  | 'ligue_2'
  | 'eredivisie'
  | 'primeira_liga'
  | 'liga_portugal_2'
  | 'belgian_pro'
  | 'turkish_super'
  | 'greek_super'
  | 'scottish_prem'
  | 'scottish_champ'
  | 'scottish_league_one'
  | 'scottish_league_two'
  | 'champions_league'
  | 'europa_league'
  | 'conference_league'
  | 'libertadores'
  | 'sul_americana'
  | 'liga_mx'
  | 'mls'
  | 'argentina'
  | 'argentina_2'
  | 'austrian'
  | 'swiss_super'
  | 'russian_premier'
  | 'ukrainian_premier'
  | 'danish_super'
  | 'swedish_allsvenskan'
  | 'norwegian_eliteserien'
  | 'paulistao'
  | 'carioca'
  | 'mineiro'
  | 'gaucho';

// Configuração das ligas para exibição
export const LEAGUE_CONFIG: Record<
  SofascoreLeague,
  {
    name: string;
    country: string;
    flag: string;
    tournamentId: number;
    seasonId: number;
  }
> = {
  // Brasil
  brasileirao_a: {
    name: 'Brasileirão Série A',
    country: 'Brasil',
    flag: '🇧🇷',
    tournamentId: 325,
    seasonId: 58766,
  },
  brasileirao_b: {
    name: 'Brasileirão Série B',
    country: 'Brasil',
    flag: '🇧🇷',
    tournamentId: 390,
    seasonId: 58767,
  },
  copa_do_brasil: {
    name: 'Copa do Brasil',
    country: 'Brasil',
    flag: '🇧🇷',
    tournamentId: 339,
    seasonId: 58770,
  },
  paulistao: {
    name: 'Campeonato Paulista',
    country: 'Brasil',
    flag: '🇧🇷',
    tournamentId: 384,
    seasonId: 58773,
  },
  carioca: {
    name: 'Campeonato Carioca',
    country: 'Brasil',
    flag: '🇧🇷',
    tournamentId: 385,
    seasonId: 58774,
  },
  mineiro: {
    name: 'Campeonato Mineiro',
    country: 'Brasil',
    flag: '🇧🇷',
    tournamentId: 386,
    seasonId: 58775,
  },
  gaucho: {
    name: 'Campeonato Gaúcho',
    country: 'Brasil',
    flag: '🇧🇷',
    tournamentId: 387,
    seasonId: 58776,
  },

  // Inglaterra
  premier_league: {
    name: 'Premier League',
    country: 'Inglaterra',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    tournamentId: 17,
    seasonId: 61627,
  },
  championship: {
    name: 'Championship',
    country: 'Inglaterra',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    tournamentId: 18,
    seasonId: 61628,
  },
  league_one: {
    name: 'League One',
    country: 'Inglaterra',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    tournamentId: 19,
    seasonId: 61631,
  },
  league_two: {
    name: 'League Two',
    country: 'Inglaterra',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    tournamentId: 20,
    seasonId: 61630,
  },
  national_league: {
    name: 'National League',
    country: 'Inglaterra',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    tournamentId: 24,
    seasonId: 61660,
  },

  // Espanha
  la_liga: { name: 'La Liga', country: 'Espanha', flag: '🇪🇸', tournamentId: 8, seasonId: 61643 },
  segunda_division: {
    name: 'Segunda División',
    country: 'Espanha',
    flag: '🇪🇸',
    tournamentId: 54,
    seasonId: 61647,
  },

  // Itália
  serie_a: { name: 'Serie A', country: 'Itália', flag: '🇮🇹', tournamentId: 23, seasonId: 61639 },
  serie_b_italy: {
    name: 'Serie B',
    country: 'Itália',
    flag: '🇮🇹',
    tournamentId: 53,
    seasonId: 61641,
  },

  // Alemanha
  bundesliga: {
    name: 'Bundesliga',
    country: 'Alemanha',
    flag: '🇩🇪',
    tournamentId: 35,
    seasonId: 63653,
  },
  bundesliga_2: {
    name: '2. Bundesliga',
    country: 'Alemanha',
    flag: '🇩🇪',
    tournamentId: 44,
    seasonId: 63655,
  },
  liga_3: { name: '3. Liga', country: 'Alemanha', flag: '🇩🇪', tournamentId: 491, seasonId: 63656 },

  // França
  ligue_1: { name: 'Ligue 1', country: 'França', flag: '🇫🇷', tournamentId: 34, seasonId: 61632 },
  ligue_2: { name: 'Ligue 2', country: 'França', flag: '🇫🇷', tournamentId: 182, seasonId: 61633 },

  // Outros países europeus
  eredivisie: {
    name: 'Eredivisie',
    country: 'Holanda',
    flag: '🇳🇱',
    tournamentId: 37,
    seasonId: 61629,
  },
  primeira_liga: {
    name: 'Primeira Liga',
    country: 'Portugal',
    flag: '🇵🇹',
    tournamentId: 238,
    seasonId: 61648,
  },
  liga_portugal_2: {
    name: 'Liga Portugal 2',
    country: 'Portugal',
    flag: '🇵🇹',
    tournamentId: 239,
    seasonId: 61652,
  },
  belgian_pro: {
    name: 'Jupiler Pro League',
    country: 'Bélgica',
    flag: '🇧🇪',
    tournamentId: 144,
    seasonId: 63736,
  },
  turkish_super: {
    name: 'Süper Lig',
    country: 'Turquia',
    flag: '🇹🇷',
    tournamentId: 52,
    seasonId: 62819,
  },
  greek_super: {
    name: 'Super League',
    country: 'Grécia',
    flag: '🇬🇷',
    tournamentId: 310,
    seasonId: 63737,
  },
  austrian: {
    name: 'Bundesliga',
    country: 'Áustria',
    flag: '🇦🇹',
    tournamentId: 45,
    seasonId: 61653,
  },
  swiss_super: {
    name: 'Super League',
    country: 'Suíça',
    flag: '🇨🇭',
    tournamentId: 215,
    seasonId: 61654,
  },
  russian_premier: {
    name: 'Premier Liga',
    country: 'Rússia',
    flag: '🇷🇺',
    tournamentId: 203,
    seasonId: 61655,
  },
  ukrainian_premier: {
    name: 'Premier Liga',
    country: 'Ucrânia',
    flag: '🇺🇦',
    tournamentId: 218,
    seasonId: 61656,
  },
  danish_super: {
    name: 'Superliga',
    country: 'Dinamarca',
    flag: '🇩🇰',
    tournamentId: 271,
    seasonId: 61657,
  },
  swedish_allsvenskan: {
    name: 'Allsvenskan',
    country: 'Suécia',
    flag: '🇸🇪',
    tournamentId: 40,
    seasonId: 61658,
  },
  norwegian_eliteserien: {
    name: 'Eliteserien',
    country: 'Noruega',
    flag: '🇳🇴',
    tournamentId: 42,
    seasonId: 61659,
  },

  // Escócia
  scottish_prem: {
    name: 'Premiership',
    country: 'Escócia',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    tournamentId: 36,
    seasonId: 61634,
  },
  scottish_champ: {
    name: 'Championship',
    country: 'Escócia',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    tournamentId: 67,
    seasonId: 61635,
  },
  scottish_league_one: {
    name: 'League One',
    country: 'Escócia',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    tournamentId: 68,
    seasonId: 61636,
  },
  scottish_league_two: {
    name: 'League Two',
    country: 'Escócia',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    tournamentId: 69,
    seasonId: 61637,
  },

  // UEFA
  champions_league: {
    name: 'Champions League',
    country: 'UEFA',
    flag: '🏆',
    tournamentId: 7,
    seasonId: 61644,
  },
  europa_league: {
    name: 'Europa League',
    country: 'UEFA',
    flag: '🥈',
    tournamentId: 679,
    seasonId: 61645,
  },
  conference_league: {
    name: 'Conference League',
    country: 'UEFA',
    flag: '🥉',
    tournamentId: 17015,
    seasonId: 61646,
  },

  // América do Sul
  libertadores: {
    name: 'Libertadores',
    country: 'CONMEBOL',
    flag: '🏆',
    tournamentId: 384,
    seasonId: 58771,
  },
  sul_americana: {
    name: 'Sul-Americana',
    country: 'CONMEBOL',
    flag: '🥈',
    tournamentId: 480,
    seasonId: 58772,
  },
  argentina: {
    name: 'Liga Profesional',
    country: 'Argentina',
    flag: '🇦🇷',
    tournamentId: 155,
    seasonId: 61650,
  },
  argentina_2: {
    name: 'Primera Nacional',
    country: 'Argentina',
    flag: '🇦🇷',
    tournamentId: 156,
    seasonId: 61651,
  },

  // América do Norte
  liga_mx: { name: 'Liga MX', country: 'México', flag: '🇲🇽', tournamentId: 352, seasonId: 62820 },
  mls: { name: 'MLS', country: 'EUA', flag: '🇺🇸', tournamentId: 242, seasonId: 62821 },
};

// Hook para buscar próximos jogos via API direta do Sofascore
export function useSofascoreFixtures(league: SofascoreLeague = 'brasileirao_a') {
  const [fixtures, setFixtures] = useState<SofascoreMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFixtures = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const leagueInfo = LEAGUE_CONFIG[league];
      const response = await fetch(
        `/api/sofascore-direct/tournament/${leagueInfo.tournamentId}/matches?seasonId=${leagueInfo.seasonId}`
      );
      const data = (await response.json()) as { events?: SofascoreMatch[]; message?: string };

      // Direct API returns { events: [...] } or { events: [], message: "..." }
      const events = data.events || [];

      if (events.length === 0 && data.message) {
        // API unavailable but not an error - just no data
        setFixtures([]);
      } else {
        setFixtures(events);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
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

// Função helper para formatar timestamp do Sofascore
// O timestamp é em UTC, precisamos converter para horário de Brasília
export function formatSofascoreDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Formata data com dia relativo (Hoje, Amanhã, etc.)
export function formatRelativeDate(timestamp: number): {
  date: string;
  time: string;
  relative: string;
  isToday: boolean;
  isTomorrow: boolean;
  dayOfWeek: string;
  fullDate: string;
} {
  const matchDate = new Date(timestamp * 1000);
  const now = new Date();

  // Usar timezone de Brasília
  const options: Intl.DateTimeFormatOptions = { timeZone: 'America/Sao_Paulo' };

  const matchDay = new Date(matchDate.toLocaleString('en-US', options)).setHours(0, 0, 0, 0);
  const today = new Date(now.toLocaleString('en-US', options)).setHours(0, 0, 0, 0);
  const tomorrow = today + 24 * 60 * 60 * 1000;
  const dayAfterTomorrow = tomorrow + 24 * 60 * 60 * 1000;

  const isToday = matchDay === today;
  const isTomorrow = matchDay === tomorrow;
  const isThisWeek = matchDay < dayAfterTomorrow + 5 * 24 * 60 * 60 * 1000;

  const time = matchDate.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });

  const dayOfWeek = matchDate.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
  });

  const date = matchDate.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  });

  const fullDate = matchDate.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

  let relative: string;
  if (isToday) {
    relative = 'Hoje';
  } else if (isTomorrow) {
    relative = 'Amanhã';
  } else if (isThisWeek) {
    relative = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
  } else {
    relative = fullDate;
  }

  return { date, time, relative, isToday, isTomorrow, dayOfWeek, fullDate };
}

// Agrupa partidas por data (dia)
export function groupMatchesByDate(matches: SofascoreMatch[]): Map<string, SofascoreMatch[]> {
  const grouped = new Map<string, SofascoreMatch[]>();

  for (const match of matches) {
    const dateKey = new Date(match.startTimestamp * 1000).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(match);
  }

  return grouped;
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

// Hook para buscar resultados recentes via Sofascore
export function useSofascoreResults(league: SofascoreLeague = 'brasileirao_a') {
  const [results, setResults] = useState<SofascoreMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const leagueInfo = LEAGUE_CONFIG[league];
      const response = await fetch(
        `/api/sofascore-direct/tournament/${leagueInfo.tournamentId}/results?seasonId=${leagueInfo.seasonId}`
      );
      const data = (await response.json()) as { events?: SofascoreMatch[] };
      setResults(data.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [league]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  return { results, loading, error, refetch: fetchResults };
}
