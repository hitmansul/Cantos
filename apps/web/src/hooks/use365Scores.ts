import { useState, useEffect } from 'react';

export type Scores365League =
  // Brasil
  | 'brasileirao_a'
  | 'brasileirao_b'
  | 'copa_do_brasil'
  | 'paulistao'
  | 'mineiro'
  | 'gaucho'
  | 'baiano'
  | 'carioca'
  // England
  | 'premier_league'
  | 'championship'
  | 'league_one'
  | 'league_two'
  | 'national_league'
  | 'national_league_n'
  // Spain
  | 'la_liga'
  | 'segunda_division'
  // Italy
  | 'serie_a'
  | 'serie_b_italy'
  // Germany
  | 'bundesliga'
  | 'bundesliga_2'
  | 'liga_3'
  // France
  | 'ligue_1'
  | 'ligue_2'
  // Other European
  | 'eredivisie'
  | 'primeira_liga'
  | 'liga_portugal_2'
  | 'scottish_prem'
  | 'scottish_champ'
  | 'scottish_league_one'
  | 'scottish_league_two'
  | 'belgian_pro'
  | 'austrian'
  | 'swiss_super'
  | 'turkish_super'
  | 'greek_super'
  | 'russian_premier'
  | 'ukrainian_premier'
  | 'danish_super'
  | 'swedish_allsvenskan'
  | 'norwegian_eliteserien'
  // UEFA
  | 'champions_league'
  | 'europa_league'
  | 'conference_league'
  | 'nations_league'
  // FIFA / Internacional
  | 'copa_do_mundo'
  | 'amistoso_internacional'
  | 'copa_america'
  | 'africa_cup'
  // South America
  | 'libertadores'
  | 'sudamericana'
  | 'argentina'
  | 'argentina_2'
  | 'colombia_liga'
  | 'chile_primera'
  | 'peru_liga'
  | 'ecuador_liga'
  | 'uruguay_primera'
  // North America
  | 'mls'
  | 'liga_mx'
  // Asia / Africa
  | 'j1_league'
  | 'k_league_1'
  | 'saudi_pro'
  | 'afc_champions'
  | 'caf_champions';

export interface TeamStanding {
  position: number;
  team: {
    id: number;
    name: string;
    shortName?: string;
    color?: string;
    imageVersion?: number;
  };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  form: number[];
  recentMatches: Array<{
    id: number;
    date: string;
    home: string;
    away: string;
    homeScore: number;
    awayScore: number;
    result: 'W' | 'D' | 'L';
  }>;
  nextMatch: {
    id: number;
    date: string;
    home: string;
    away: string;
  } | null;
}

export interface UpcomingMatch {
  id: number;
  startTime: string;
  round?: number;
  roundName?: string;
  homeTeam: {
    id: number;
    name: string;
    shortName?: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName?: string;
  };
}

export interface MatchResult {
  id: number;
  status: number;
  statusText: string;
  startTime: string;
  round?: number;
  roundName?: string;
  homeTeam: {
    id: number;
    name: string;
    shortName?: string;
    score: number;
    color?: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName?: string;
    score: number;
    color?: string;
  };
}

export const LEAGUE_CONFIG: Record<
  Scores365League,
  { name: string; country: string; flag: string }
> = {
  // Brasil
  brasileirao_a: { name: 'Brasileirão Série A', country: 'Brasil', flag: '🇧🇷' },
  brasileirao_b: { name: 'Brasileirão Série B', country: 'Brasil', flag: '🇧🇷' },
  copa_do_brasil: { name: 'Copa do Brasil', country: 'Brasil', flag: '🇧🇷' },
  paulistao: { name: 'Campeonato Paulista', country: 'Brasil', flag: '🇧🇷' },
  mineiro: { name: 'Campeonato Mineiro', country: 'Brasil', flag: '🇧🇷' },
  gaucho: { name: 'Campeonato Gaúcho', country: 'Brasil', flag: '🇧🇷' },
  baiano: { name: 'Campeonato Baiano', country: 'Brasil', flag: '🇧🇷' },
  carioca: { name: 'Campeonato Carioca', country: 'Brasil', flag: '🇧🇷' },

  // England
  premier_league: { name: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  championship: { name: 'Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  league_one: { name: 'League One', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  league_two: { name: 'League Two', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  national_league: { name: 'National League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  national_league_n: { name: 'National League N/S', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },

  // Spain
  la_liga: { name: 'La Liga', country: 'Espanha', flag: '🇪🇸' },
  segunda_division: { name: 'La Liga 2', country: 'Espanha', flag: '🇪🇸' },

  // Italy
  serie_a: { name: 'Serie A', country: 'Itália', flag: '🇮🇹' },
  serie_b_italy: { name: 'Serie B', country: 'Itália', flag: '🇮🇹' },

  // Germany
  bundesliga: { name: 'Bundesliga', country: 'Alemanha', flag: '🇩🇪' },
  bundesliga_2: { name: '2. Bundesliga', country: 'Alemanha', flag: '🇩🇪' },
  liga_3: { name: '3. Liga', country: 'Alemanha', flag: '🇩🇪' },

  // France
  ligue_1: { name: 'Ligue 1', country: 'França', flag: '🇫🇷' },
  ligue_2: { name: 'Ligue 2', country: 'França', flag: '🇫🇷' },

  // Other European
  eredivisie: { name: 'Eredivisie', country: 'Holanda', flag: '🇳🇱' },
  primeira_liga: { name: 'Primeira Liga', country: 'Portugal', flag: '🇵🇹' },
  liga_portugal_2: { name: 'Liga Portugal 2', country: 'Portugal', flag: '🇵🇹' },
  scottish_prem: { name: 'Scottish Premiership', country: 'Escócia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  scottish_champ: { name: 'Scottish Championship', country: 'Escócia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  scottish_league_one: { name: 'Scottish League One', country: 'Escócia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  scottish_league_two: { name: 'Scottish League Two', country: 'Escócia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  belgian_pro: { name: 'Jupiler Pro League', country: 'Bélgica', flag: '🇧🇪' },
  austrian: { name: 'Bundesliga', country: 'Áustria', flag: '🇦🇹' },
  swiss_super: { name: 'Super League', country: 'Suíça', flag: '🇨🇭' },
  turkish_super: { name: 'Süper Lig', country: 'Turquia', flag: '🇹🇷' },
  greek_super: { name: 'Super League', country: 'Grécia', flag: '🇬🇷' },
  russian_premier: { name: 'Premier Liga', country: 'Rússia', flag: '🇷🇺' },
  ukrainian_premier: { name: 'Premier Liga', country: 'Ucrânia', flag: '🇺🇦' },
  danish_super: { name: 'Superliga', country: 'Dinamarca', flag: '🇩🇰' },
  swedish_allsvenskan: { name: 'Allsvenskan', country: 'Suécia', flag: '🇸🇪' },
  norwegian_eliteserien: { name: 'Eliteserien', country: 'Noruega', flag: '🇳🇴' },

  // UEFA
  champions_league: { name: 'Champions League', country: 'UEFA', flag: '🏆' },
  europa_league: { name: 'Europa League', country: 'UEFA', flag: '🏆' },
  conference_league: { name: 'Conference League', country: 'UEFA', flag: '🏆' },
  nations_league: { name: 'Nations League', country: 'UEFA', flag: '🏳️' },

  // FIFA / Internacional
  copa_do_mundo: { name: '🏆 Copa do Mundo 2026', country: 'FIFA', flag: '🌍' },
  amistoso_internacional: { name: 'Amistoso Internacional', country: 'FIFA', flag: '🌍' },
  copa_america: { name: 'Copa América', country: 'CONMEBOL', flag: '🏆' },
  africa_cup: { name: 'Copa África das Nações', country: 'CAF', flag: '🌍' },

  // South America
  libertadores: { name: 'Copa Libertadores', country: 'CONMEBOL', flag: '🏆' },
  sudamericana: { name: 'Copa Sul-Americana', country: 'CONMEBOL', flag: '🏆' },
  argentina: { name: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷' },
  argentina_2: { name: 'Primera Nacional', country: 'Argentina', flag: '🇦🇷' },
  colombia_liga: { name: 'Liga BetPlay', country: 'Colômbia', flag: '🇨🇴' },
  chile_primera: { name: 'Primera División', country: 'Chile', flag: '🇨🇱' },
  peru_liga: { name: 'Liga 1', country: 'Peru', flag: '🇵🇪' },
  ecuador_liga: { name: 'Liga Pro', country: 'Equador', flag: '🇪🇨' },
  uruguay_primera: { name: 'Primera División', country: 'Uruguai', flag: '🇺🇾' },

  // North America
  mls: { name: 'MLS', country: 'EUA', flag: '🇺🇸' },
  liga_mx: { name: 'Liga MX', country: 'México', flag: '🇲🇽' },

  // Asia / Africa
  j1_league: { name: 'J1 League', country: 'Japão', flag: '🇯🇵' },
  k_league_1: { name: 'K League 1', country: 'Coreia do Sul', flag: '🇰🇷' },
  saudi_pro: { name: 'Saudi Pro League', country: 'Arábia Saudita', flag: '🇸🇦' },
  afc_champions: { name: 'AFC Champions League', country: 'AFC', flag: '🏆' },
  caf_champions: { name: 'CAF Champions League', country: 'CAF', flag: '🏆' },
};

export function use365Standings(league: Scores365League | null) {
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [groups, setGroups] = useState<Array<{ name: string; rows: TeamStanding[] }>>([]);
  const [idMismatch, setIdMismatch] = useState(false);
  const [mismatchMessage, setMismatchMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!league) {
      setStandings([]);
      setGroups([]);
      setIdMismatch(false);
      setMismatchMessage(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setIdMismatch(false);
      setMismatchMessage(null);
      try {
        const res = await fetch(`/api/365scores/standings/${league}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.idMismatch) {
          setIdMismatch(true);
          setMismatchMessage(data.message || 'ID da competição pode ter mudado na nova temporada.');
          setStandings([]);
          setGroups([]);
        } else {
          setStandings(data.standings || []);
          setGroups(data.groups || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching standings');
        setStandings([]);
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [league]);

  return { standings, groups, idMismatch, mismatchMessage, loading, error };
}

export function use365Upcoming(league: Scores365League | null) {
  const [matches, setMatches] = useState<UpcomingMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!league) {
      setMatches([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/365scores/upcoming/${league}`);
        if (!res.ok) throw new Error('Failed to fetch upcoming matches');
        const data = await res.json();
        setMatches(data.matches || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching upcoming matches');
        setMatches([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [league]);

  return { matches, loading, error };
}

export function use365Results(league: Scores365League | null) {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!league) {
      setMatches([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/365scores/results/${league}`);
        if (!res.ok) throw new Error('Failed to fetch results');
        const data = await res.json();
        setMatches(data.matches || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching results');
        setMatches([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [league]);

  return { matches, loading, error };
}
