'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  CornerUpRight,
  Calendar,
  TrendingUp,
  BarChart3,
  Info,
  ArrowLeft,
  Globe,
  Loader2,
  RefreshCw,
  Radio,
  Target,
  Zap,
  Trophy,
  CreditCard,
  Sparkles,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { TeamSelector } from '@/components/TeamSelector';
import { TeamStatsCard } from '@/components/TeamStatsCard';
import { TeamCardStatsCard } from '@/components/TeamCardStatsCard';
import { TeamShotStatsCard } from '@/components/TeamShotStatsCard';
import { HeadToHeadExpanded } from '@/components/HeadToHeadExpanded';
import { NextMatchCard } from '@/components/NextMatchCard';
import { LeagueSelector } from '@/components/LeagueSelector';

import { InternationalTeamStatsCard } from '@/components/InternationalTeamStatsCard';
import { InternationalH2HCard } from '@/components/InternationalH2HCard';
import LiveCornerStats from '@/components/LiveCornerStats';
import { MatchPrediction } from '@/components/MatchPrediction';
import { PredictionsTab } from '@/components/PredictionsTab';
import { CornerTrendsChart } from '@/components/CornerTrendsChart';
import { ValueAlerts } from '@/components/ValueAlerts';
import { FavoriteTeamAlerts } from '@/components/FavoriteTeams';
import {
  TeamFiltersPanel,
  applyFilters,
  DEFAULT_FILTERS,
  IntlTeamFiltersPanel,
  applyIntlFilters,
  DEFAULT_INTL_FILTERS,
  type TeamFilters,
  type IntlTeamFilters,
} from '@/components/TeamFilters';
import { DateFilterOption } from '@/components/DateFilter';
import { SofascoreFixtures } from '@/components/SofascoreFixtures';
import { SofascoreCornerStats } from '@/components/SofascoreCornerStats';
import { FootballDataCornerStats } from '@/components/FootballDataCornerStats';
import { TheSportsDBFixtures } from '@/components/TheSportsDBFixtures';
import { LiveMatches } from '@/components/LiveMatches';
import {
  Scores365Standings,
  Scores365UpcomingMatches,
  Scores365Results,
} from '@/components/Scores365Components';
import { useLeagueStats, useH2H } from '@/hooks/useCornerStats';
import { useCardStats } from '@/hooks/useCardStats';
import { CardStatsTable } from '@/components/CardStatsComponents';
import { ShotStatsTable } from '@/components/ShotStatsComponents';
import { useShotStats } from '@/hooks/useShotStats';
import { findBrazilianShotStats } from '@/data/teamShotStats';
// Shot stats ready: import { useShotStats } from "@/hooks/useShotStats";
// Shot stats ready: import { ShotStatsTable } from "@/components/ShotStatsComponents";
import type { LeagueConfig, TeamCornerStats } from '@/shared/footballDataTypes';
import {
  type DetailedTeamStats,
  teamStats,
  getHeadToHead,
  getNextMatchForTeam,
  findTeamByName,
} from '@/data/teamCornerStats';
import { findTeamCardStats } from '@/data/teamCardStats';
import type { SofascoreLeague } from '@/hooks/useSofascore';
import type { Scores365League } from '@/hooks/use365Scores';
import { useSofascoreHalftimeCorners, type SofascoreTournament } from '@/hooks/useSofascoreDirect';
import { GlobalCornerSearch } from '@/components/GlobalCornerSearch';
import { AIChat } from '@/components/AIChat';
import { WorldCupPage } from '@/components/WorldCupPage';
import { ContinentalPage } from '@/components/ContinentalPage';

type ViewMode =
  | 'brazilian'
  | 'international'
  | 'realtime'
  | 'search'
  | 'ai'
  | 'worldcup'
  | 'continental';

// Mapping from Football-Data league IDs to Sofascore league keys
const LEAGUE_TO_SOFASCORE: Partial<Record<string, SofascoreLeague>> = {
  // Brasil
  BR1: 'brasileirao_a',
  BR2: 'brasileirao_b',
  BRCUP: 'copa_do_brasil',
  // Inglaterra
  E0: 'premier_league',
  E1: 'championship',
  E2: 'league_one',
  E3: 'league_two',
  EC: 'national_league',
  // Espanha
  SP1: 'la_liga',
  SP2: 'segunda_division',
  // Itália
  I1: 'serie_a',
  I2: 'serie_b_italy',
  // Alemanha
  D1: 'bundesliga',
  D2: 'bundesliga_2',
  D3: 'liga_3',
  // França
  F1: 'ligue_1',
  F2: 'ligue_2',
  // Outros
  N1: 'eredivisie',
  P1: 'primeira_liga',
  P2: 'liga_portugal_2',
  B1: 'belgian_pro',
  T1: 'turkish_super',
  G1: 'greek_super',
  // Escócia
  SC0: 'scottish_prem',
  SC1: 'scottish_champ',
  SC2: 'scottish_league_one',
  SC3: 'scottish_league_two',
  // Mais ligas europeias
  AUT: 'austrian',
  SUI: 'swiss_super',
  RUS: 'russian_premier',
  UKR: 'ukrainian_premier',
  DEN: 'danish_super',
  SWE: 'swedish_allsvenskan',
  NOR: 'norwegian_eliteserien',
  // UEFA
  UCL: 'champions_league',
  UEL: 'europa_league',
  UECL: 'conference_league',
  conference_league: 'conference_league',
  // FIFA
  // América
  LIB: 'libertadores',
  SUL: 'sul_americana',
  ARG: 'argentina',
  ARG2: 'argentina_2',
  MEX: 'liga_mx',
  MLS: 'mls',
  libertadores: 'libertadores',
  sudamericana: 'sul_americana',
  argentina: 'argentina',
  argentina_2: 'argentina_2',
  mls: 'mls',
  liga_mx: 'liga_mx',
  // Ásia / África
  // Extra europeu
  liga_portugal_2: 'liga_portugal_2',
  austrian: 'austrian',
  swiss_super: 'swiss_super',
  russian_premier: 'russian_premier',
  ukrainian_premier: 'ukrainian_premier',
  danish_super: 'danish_super',
  swedish_allsvenskan: 'swedish_allsvenskan',
  norwegian_eliteserien: 'norwegian_eliteserien',
  liga_3: 'liga_3',
};

// Mapping from Football-Data league IDs to Sofascore tournament keys (for halftime stats)
const LEAGUE_TO_SOFASCORE_TOURNAMENT: Record<string, SofascoreTournament> = {
  // Inglaterra
  E0: 'premier_league',
  E1: 'championship',
  E2: 'league_one',
  E3: 'league_two',
  EC: 'national_league',
  // Espanha
  SP1: 'la_liga',
  SP2: 'segunda_division',
  // Itália
  I1: 'serie_a',
  I2: 'serie_b_italy',
  // Alemanha
  D1: 'bundesliga',
  D2: 'bundesliga_2',
  // França
  F1: 'ligue_1',
  F2: 'ligue_2',
  // Outros países
  N1: 'eredivisie',
  P1: 'primeira_liga',
  P2: 'liga_portugal_2',
  B1: 'belgian_pro',
  T1: 'turkish_super',
  G1: 'greek_super',
  // Escócia
  SC0: 'scottish_prem',
  SC1: 'scottish_champ',
  SC2: 'scottish_league_one',
  SC3: 'scottish_league_two',
  // Mais ligas
  AUT: 'austrian',
  SUI: 'swiss_super',
  RUS: 'russian_premier',
  UKR: 'ukrainian_premier',
  DEN: 'danish_super',
  SWE: 'swedish_allsvenskan',
  NOR: 'norwegian_eliteserien',
  // UEFA
  UCL: 'champions_league',
  UEL: 'europa_league',
  UECL: 'conference_league',
  // América
  LIB: 'libertadores',
  SUL: 'sul_americana',
  ARG: 'argentina',
  ARG2: 'argentina_2',
  MEX: 'liga_mx',
  MLS: 'mls',
};

// Mapping from Football-Data league IDs to 365Scores league keys
const LEAGUE_TO_365SCORES: Record<string, Scores365League> = {
  // Inglaterra
  E0: 'premier_league',
  E1: 'championship',
  E2: 'league_one',
  E3: 'league_two',
  EC: 'national_league',
  // Espanha
  SP1: 'la_liga',
  SP2: 'segunda_division',
  // Itália
  I1: 'serie_a',
  I2: 'serie_b_italy',
  // Alemanha
  D1: 'bundesliga',
  D2: 'bundesliga_2',
  D3: 'liga_3',
  liga_3: 'liga_3',
  // França
  F1: 'ligue_1',
  F2: 'ligue_2',
  // Outros
  N1: 'eredivisie',
  P1: 'primeira_liga',
  B1: 'belgian_pro',
  T1: 'turkish_super',
  G1: 'greek_super',
  // Escócia
  SC0: 'scottish_prem',
  SC1: 'scottish_champ',
  SC2: 'scottish_league_one',
  SC3: 'scottish_league_two',
  // UEFA
  UCL: 'champions_league',
  UEL: 'europa_league',
  conference_league: 'conference_league',
  nations_league: 'nations_league',
  // FIFA
  copa_do_mundo: 'copa_do_mundo',
  amistoso_internacional: 'amistoso_internacional',
  // CONMEBOL
  libertadores: 'libertadores',
  sudamericana: 'sudamericana',
  copa_america: 'copa_america',
  // América do Sul
  ARG: 'argentina',
  ARG2: 'argentina_2',
  argentina: 'argentina',
  argentina_2: 'argentina_2',
  colombia_liga: 'colombia_liga',
  chile_primera: 'chile_primera',
  peru_liga: 'peru_liga',
  ecuador_liga: 'ecuador_liga',
  uruguay_primera: 'uruguay_primera',
  // América do Norte
  MEX: 'liga_mx',
  MLS: 'mls',
  mls: 'mls',
  liga_mx: 'liga_mx',
  // CAF / AFC
  africa_cup: 'africa_cup',
  caf_champions: 'caf_champions',
  j1_league: 'j1_league',
  k_league_1: 'k_league_1',
  saudi_pro: 'saudi_pro',
  afc_champions: 'afc_champions',
  // Extra europeu
  liga_portugal_2: 'liga_portugal_2',
  austrian: 'austrian',
  swiss_super: 'swiss_super',
  russian_premier: 'russian_premier',
  ukrainian_premier: 'ukrainian_premier',
  danish_super: 'danish_super',
  swedish_allsvenskan: 'swedish_allsvenskan',
  norwegian_eliteserien: 'norwegian_eliteserien',
};

// Reverse mapping from Sofascore league keys to Football-Data league IDs
const SOFASCORE_TO_LEAGUE_ID: Partial<Record<SofascoreLeague, string>> = {
  // Brasil
  brasileirao_a: 'BR1',
  brasileirao_b: 'BR2',
  copa_do_brasil: 'BRCUP',
  // Inglaterra
  premier_league: 'E0',
  championship: 'E1',
  league_one: 'E2',
  league_two: 'E3',
  // Espanha
  la_liga: 'SP1',
  segunda_division: 'SP2',
  // Itália
  serie_a: 'I1',
  serie_b_italy: 'I2',
  // Alemanha
  bundesliga: 'D1',
  bundesliga_2: 'D2',
  // França
  ligue_1: 'F1',
  ligue_2: 'F2',
  // Outros
  eredivisie: 'N1',
  primeira_liga: 'P1',
  belgian_pro: 'B1',
  turkish_super: 'T1',
  greek_super: 'G1',
  // Escócia
  scottish_prem: 'SC0',
  scottish_champ: 'SC1',
  scottish_league_one: 'SC2',
  scottish_league_two: 'SC3',
  // UEFA
  champions_league: 'UCL',
  europa_league: 'UEL',
  // América
  libertadores: 'LIB',
  sul_americana: 'SUL',
  liga_mx: 'MEX',
  mls: 'MLS',
};

// League configs for navigation
const LEAGUE_CONFIGS: Record<
  string,
  { id: string; name: string; country: string; csvUrl: string; flag: string }
> = {
  // UEFA Competitions
  UCL: { id: 'UCL', name: 'Champions League', country: 'UEFA', csvUrl: '', flag: '🏆' },
  UEL: { id: 'UEL', name: 'Europa League', country: 'UEFA', csvUrl: '', flag: '🥈' },
  UECL: { id: 'UECL', name: 'Conference League', country: 'UEFA', csvUrl: '', flag: '🥉' },

  // Inglaterra (4 divisões)
  E0: {
    id: 'E0',
    name: 'Premier League',
    country: 'Inglaterra',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/E0.csv',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  },
  E1: {
    id: 'E1',
    name: 'Championship',
    country: 'Inglaterra',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/E1.csv',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  },
  E2: {
    id: 'E2',
    name: 'League One',
    country: 'Inglaterra',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/E2.csv',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  },
  E3: {
    id: 'E3',
    name: 'League Two',
    country: 'Inglaterra',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/E3.csv',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  },
  EC: {
    id: 'EC',
    name: 'National League',
    country: 'Inglaterra',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/EC.csv',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  },

  // Espanha (2 divisões)
  SP1: {
    id: 'SP1',
    name: 'La Liga',
    country: 'Espanha',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/SP1.csv',
    flag: '🇪🇸',
  },
  SP2: {
    id: 'SP2',
    name: 'Segunda División',
    country: 'Espanha',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/SP2.csv',
    flag: '🇪🇸',
  },

  // Itália (2 divisões)
  I1: {
    id: 'I1',
    name: 'Serie A',
    country: 'Itália',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/I1.csv',
    flag: '🇮🇹',
  },
  I2: {
    id: 'I2',
    name: 'Serie B',
    country: 'Itália',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/I2.csv',
    flag: '🇮🇹',
  },

  // Alemanha (3 divisões)
  D1: {
    id: 'D1',
    name: 'Bundesliga',
    country: 'Alemanha',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/D1.csv',
    flag: '🇩🇪',
  },
  D2: {
    id: 'D2',
    name: '2. Bundesliga',
    country: 'Alemanha',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/D2.csv',
    flag: '🇩🇪',
  },

  // França (2 divisões)
  F1: {
    id: 'F1',
    name: 'Ligue 1',
    country: 'França',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/F1.csv',
    flag: '🇫🇷',
  },
  F2: {
    id: 'F2',
    name: 'Ligue 2',
    country: 'França',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/F2.csv',
    flag: '🇫🇷',
  },

  // Holanda
  N1: {
    id: 'N1',
    name: 'Eredivisie',
    country: 'Holanda',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/N1.csv',
    flag: '🇳🇱',
  },

  // Portugal (2 divisões)
  P1: {
    id: 'P1',
    name: 'Primeira Liga',
    country: 'Portugal',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/P1.csv',
    flag: '🇵🇹',
  },
  P2: { id: 'P2', name: 'Liga Portugal 2', country: 'Portugal', csvUrl: '', flag: '🇵🇹' },

  // Bélgica
  B1: {
    id: 'B1',
    name: 'Jupiler Pro League',
    country: 'Bélgica',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/B1.csv',
    flag: '🇧🇪',
  },

  // Turquia
  T1: {
    id: 'T1',
    name: 'Süper Lig',
    country: 'Turquia',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/T1.csv',
    flag: '🇹🇷',
  },

  // Grécia
  G1: {
    id: 'G1',
    name: 'Super League',
    country: 'Grécia',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/G1.csv',
    flag: '🇬🇷',
  },

  // Escócia (4 divisões)
  SC0: {
    id: 'SC0',
    name: 'Premiership',
    country: 'Escócia',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/SC0.csv',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  },
  SC1: {
    id: 'SC1',
    name: 'Championship',
    country: 'Escócia',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/SC1.csv',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  },
  SC2: {
    id: 'SC2',
    name: 'League One',
    country: 'Escócia',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/SC2.csv',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  },
  SC3: {
    id: 'SC3',
    name: 'League Two',
    country: 'Escócia',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/SC3.csv',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  },

  // Áustria
  AUT: { id: 'AUT', name: 'Bundesliga', country: 'Áustria', csvUrl: '', flag: '🇦🇹' },

  // Suíça
  SUI: { id: 'SUI', name: 'Super League', country: 'Suíça', csvUrl: '', flag: '🇨🇭' },

  // Rússia
  RUS: { id: 'RUS', name: 'Premier Liga', country: 'Rússia', csvUrl: '', flag: '🇷🇺' },

  // Ucrânia
  UKR: { id: 'UKR', name: 'Premier Liga', country: 'Ucrânia', csvUrl: '', flag: '🇺🇦' },

  // Dinamarca
  DEN: { id: 'DEN', name: 'Superliga', country: 'Dinamarca', csvUrl: '', flag: '🇩🇰' },

  // Suécia
  SWE: { id: 'SWE', name: 'Allsvenskan', country: 'Suécia', csvUrl: '', flag: '🇸🇪' },

  // Noruega
  NOR: { id: 'NOR', name: 'Eliteserien', country: 'Noruega', csvUrl: '', flag: '🇳🇴' },

  // América do Sul
  LIB: { id: 'LIB', name: 'Copa Libertadores', country: 'CONMEBOL', csvUrl: '', flag: '🏆' },
  SUL: { id: 'SUL', name: 'Copa Sul-Americana', country: 'CONMEBOL', csvUrl: '', flag: '🥈' },
  ARG: { id: 'ARG', name: 'Liga Profesional', country: 'Argentina', csvUrl: '', flag: '🇦🇷' },
  ARG2: { id: 'ARG2', name: 'Primera Nacional', country: 'Argentina', csvUrl: '', flag: '🇦🇷' },

  // América do Norte
  MEX: { id: 'MEX', name: 'Liga MX', country: 'México', csvUrl: '', flag: '🇲🇽' },
  MLS: { id: 'MLS', name: 'MLS', country: 'EUA', csvUrl: '', flag: '🇺🇸' },
};

export default function HomePage() {
  const [viewMode, setViewMode] = useState<ViewMode>('brazilian');
  const [selectedTeam, setSelectedTeam] = useState<DetailedTeamStats | null>(null);
  const [compareTeam, setCompareTeam] = useState<DetailedTeamStats | null>(null);
  const [lastNGames, setLastNGames] = useState(5);

  // International league state
  const [selectedLeague, setSelectedLeague] = useState<LeagueConfig | null>(null);
  const [selectedIntlTeam, setSelectedIntlTeam] = useState<TeamCornerStats | null>(null);
  const [compareIntlTeam, setCompareIntlTeam] = useState<TeamCornerStats | null>(null);
  const [_intlTab, setIntlTab] = useState<'stats' | 'h2h'>('stats');
  const {
    stats: leagueStats,
    loading: leagueLoading,
    error: leagueError,
    fetchStats,
  } = useLeagueStats();
  const { h2h: intlH2H, loading: h2hLoading, fetchH2H, clearH2H } = useH2H();
  const {
    data: cardStats,
    isLoading: cardStatsLoading,
    refetch: refetchCardStats,
  } = useCardStats(selectedLeague?.id || null);
  const {
    data: shotStats,
    isLoading: shotStatsLoading,
    refetch: refetchShotStats,
  } = useShotStats(selectedLeague?.id || null);

  // Half-time corner stats for international leagues
  const {
    stats: halftimeStats,
    loading: halftimeLoading,
    fetchHalftimeCorners,
  } = useSofascoreHalftimeCorners();

  // Show standings modal/section
  const [showStandings, setShowStandings] = useState(false);

  // Tab control for programmatic switching
  const [brazilianTab, setBrazilianTab] = useState<string>('stats');
  const [previousBrazilianTab, setPreviousBrazilianTab] = useState<string>('stats');
  const [intlMainTab, setIntlMainTab] = useState<string>('stats');
  const [showIntlStandings, setShowIntlStandings] = useState(false);

  // Pending match selection (for navigation from Europa tab)
  const [pendingMatchTeams, setPendingMatchTeams] = useState<{ home: string; away: string } | null>(
    null
  );

  // Team filters
  const [teamFilters, setTeamFilters] = useState<TeamFilters>(DEFAULT_FILTERS);
  const filteredTeams = useMemo(() => applyFilters(teamStats, teamFilters), [teamFilters]);

  // International team filters
  const [intlFilters, setIntlFilters] = useState<IntlTeamFilters>(DEFAULT_INTL_FILTERS);

  // Date filter state for fixtures
  const [fixturesDateFilter, setFixturesDateFilter] = useState<DateFilterOption>('all');
  const filteredIntlTeams = useMemo(
    () => (leagueStats?.teams ? applyIntlFilters(leagueStats.teams, intlFilters) : []),
    [leagueStats?.teams, intlFilters]
  );

  // UEFA leagues that should use Sofascore only (not Football-Data.co.uk)
  const isNoCSVLeague = selectedLeague
    ? !LEAGUE_CONFIGS[selectedLeague.id]?.csvUrl ||
      LEAGUE_CONFIGS[selectedLeague.id]?.csvUrl === '' ||
      selectedLeague.id === 'UCL' ||
      selectedLeague.id === 'UEL' ||
      selectedLeague.id === 'UECL'
    : false;

  // Fetch league stats when league changes (only for non-UEFA leagues)
  useEffect(() => {
    if (selectedLeague && selectedLeague.id !== 'BR1' && !isNoCSVLeague) {
      fetchStats(selectedLeague.id);
      // Clear H2H when changing leagues
      clearH2H();
    }
  }, [selectedLeague, fetchStats, clearH2H, isNoCSVLeague]);

  // Fetch H2H when both international teams are selected
  useEffect(() => {
    if (selectedLeague && selectedIntlTeam && compareIntlTeam) {
      fetchH2H(selectedLeague.id, selectedIntlTeam.team, compareIntlTeam.team);
    } else {
      clearH2H();
    }
  }, [selectedLeague, selectedIntlTeam, compareIntlTeam, fetchH2H, clearH2H]);

  // Apply pending match selection when league stats load
  useEffect(() => {
    if (pendingMatchTeams && leagueStats && !leagueLoading) {
      const homeTeamData = leagueStats.teams.find(
        (t) =>
          t.team.toLowerCase().includes(pendingMatchTeams.home.toLowerCase()) ||
          pendingMatchTeams.home.toLowerCase().includes(t.team.toLowerCase())
      );
      const awayTeamData = leagueStats.teams.find(
        (t) =>
          t.team.toLowerCase().includes(pendingMatchTeams.away.toLowerCase()) ||
          pendingMatchTeams.away.toLowerCase().includes(t.team.toLowerCase())
      );
      if (homeTeamData) setSelectedIntlTeam(homeTeamData);
      if (awayTeamData) setCompareIntlTeam(awayTeamData);
      setIntlMainTab('compare');
      setPendingMatchTeams(null);
    }
  }, [pendingMatchTeams, leagueStats, leagueLoading]);

  // Get H2H data if both teams selected
  const h2hData = useMemo(() => {
    if (!selectedTeam || !compareTeam) return null;
    return getHeadToHead(selectedTeam.team, compareTeam.team);
  }, [selectedTeam, compareTeam]);

  // Get next match for selected team
  const nextMatch = useMemo(() => {
    if (!selectedTeam) return null;
    return getNextMatchForTeam(selectedTeam.team);
  }, [selectedTeam]);

  // Handle match selection from upcoming matches
  const handleMatchSelect = (homeTeam: string, awayTeam: string) => {
    const home = findTeamByName(homeTeam);
    const away = findTeamByName(awayTeam);
    if (home) setSelectedTeam(home);
    if (away) setCompareTeam(away);
  };

  // Handle match selection from Sofascore fixtures (Brasileirão)
  const handleSofascoreMatchSelect = (match: {
    homeTeam: { name: string };
    awayTeam: { name: string };
  }) => {
    const home = findTeamByName(match.homeTeam.name);
    const away = findTeamByName(match.awayTeam.name);
    if (home) setSelectedTeam(home);
    if (away) setCompareTeam(away);
    setPreviousBrazilianTab(brazilianTab);
    setBrazilianTab('compare');
  };

  // Helper function to create mock team stats (for UEFA leagues without Football-Data)
  const createMockTeamStats = (
    name: string,
    leagueConfig: { name: string; id: string; country: string }
  ): TeamCornerStats => ({
    team: name,
    league: leagueConfig.name,
    leagueId: leagueConfig.id,
    country: leagueConfig.country,
    gamesPlayed: 0,
    totalCornersFor: 0,
    totalCornersAgainst: 0,
    avgCornersFor: 0,
    avgCornersAgainst: 0,
    avgTotalCorners: 0,
    homeGames: 0,
    awayGames: 0,
    homeCornersFor: 0,
    homeCornersAgainst: 0,
    awayCornersFor: 0,
    awayCornersAgainst: 0,
    avgCornersHome: 0,
    avgCornersAway: 0,
    homeGamesWinning: 0,
    homeGamesDrawing: 0,
    homeGamesLosing: 0,
    avgCornersHomeWinning: 0,
    avgCornersHomeDrawing: 0,
    avgCornersHomeLosing: 0,
    awayGamesWinning: 0,
    awayGamesDrawing: 0,
    awayGamesLosing: 0,
    avgCornersAwayWinning: 0,
    avgCornersAwayDrawing: 0,
    avgCornersAwayLosing: 0,
    gamesWinning: 0,
    gamesDrawing: 0,
    gamesLosing: 0,
    avgCornersWinning: 0,
    avgCornersDrawing: 0,
    avgCornersLosing: 0,
    over85Pct: 0,
    over95Pct: 0,
    over105Pct: 0,
    over115Pct: 0,
    recentMatches: [],
  });

  // Handle match selection from international fixtures
  const handleIntlMatchSelect = (homeTeam: string, awayTeam: string) => {
    // For UEFA leagues without Football-Data stats, create mock team stats
    if (
      selectedLeague &&
      (selectedLeague.id === 'UCL' || selectedLeague.id === 'UEL' || !leagueStats)
    ) {
      setSelectedIntlTeam(createMockTeamStats(homeTeam, selectedLeague));
      setCompareIntlTeam(createMockTeamStats(awayTeam, selectedLeague));
      setIntlMainTab('compare');
      return;
    }

    if (leagueStats) {
      const homeTeamData = leagueStats.teams.find(
        (t) =>
          t.team.toLowerCase().includes(homeTeam.toLowerCase()) ||
          homeTeam.toLowerCase().includes(t.team.toLowerCase())
      );
      const awayTeamData = leagueStats.teams.find(
        (t) =>
          t.team.toLowerCase().includes(awayTeam.toLowerCase()) ||
          awayTeam.toLowerCase().includes(t.team.toLowerCase())
      );
      if (homeTeamData) setSelectedIntlTeam(homeTeamData);
      if (awayTeamData) setCompareIntlTeam(awayTeamData);
      setIntlMainTab('compare');
      setIntlTab('h2h');
    }
  };

  // Handle match selection from Europa tab (navigates to international mode)
  const handleEuropaMatchSelect = (
    match: { homeTeam: { name: string }; awayTeam: { name: string } },
    sofascoreLeague: SofascoreLeague
  ) => {
    const leagueId = SOFASCORE_TO_LEAGUE_ID[sofascoreLeague] || '';
    const leagueConfig = LEAGUE_CONFIGS[leagueId];

    if (leagueConfig) {
      // Switch to international mode with the correct league
      setViewMode('international');
      setSelectedLeague(leagueConfig);

      // Clear previous selections
      setSelectedIntlTeam(null);
      setCompareIntlTeam(null);

      // For UEFA leagues, we can set teams directly since they use Sofascore
      if (leagueId === 'UCL' || leagueId === 'UEL') {
        setSelectedIntlTeam(createMockTeamStats(match.homeTeam.name, leagueConfig));
        setCompareIntlTeam(createMockTeamStats(match.awayTeam.name, leagueConfig));
        setIntlMainTab('compare');
      } else {
        // For non-UEFA leagues, store pending and let useEffect apply when stats load
        setPendingMatchTeams({ home: match.homeTeam.name, away: match.awayTeam.name });
      }
    }
  };

  // Clear selection and go back to previous tab
  const handleGoBack = () => {
    setSelectedTeam(null);
    setCompareTeam(null);
    setBrazilianTab(previousBrazilianTab);
  };

  // Clear international team selection
  const handleIntlGoBack = () => {
    setSelectedIntlTeam(null);
    setCompareIntlTeam(null);
    setIntlTab('stats');
    clearH2H();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <CornerUpRight className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Cantos Estatísticas</h1>
                <p className="text-xs text-muted-foreground">Estatísticas de escanteios mundiais</p>
              </div>
            </div>
            <Badge
              variant="secondary"
              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            >
              <BarChart3 className="w-3 h-3 mr-1" />
              Temporada 2026
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* View Mode Selector */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={viewMode === 'brazilian' ? 'default' : 'outline'}
            onClick={() => setViewMode('brazilian')}
            className="flex-1 sm:flex-none"
          >
            <span className="mr-2">🇧🇷</span>
            Brasileirão
          </Button>
          <Button
            variant={viewMode === 'international' ? 'default' : 'outline'}
            onClick={() => setViewMode('international')}
            className="flex-1 sm:flex-none"
          >
            <Globe className="w-4 h-4 mr-2" />
            Ligas Internacionais
          </Button>
          <Button
            variant={viewMode === 'worldcup' ? 'default' : 'outline'}
            onClick={() => setViewMode('worldcup')}
            className={`flex-1 sm:flex-none ${viewMode === 'worldcup' ? 'bg-gradient-to-r from-emerald-700 to-green-700 hover:from-emerald-600 hover:to-green-600 text-white border-0' : ''}`}
          >
            <Trophy className="w-4 h-4 mr-2" />
            Copa do Mundo
          </Button>
          <Button
            variant={viewMode === 'continental' ? 'default' : 'outline'}
            onClick={() => setViewMode('continental')}
            className={`flex-1 sm:flex-none ${viewMode === 'continental' ? 'bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white border-0' : ''}`}
          >
            <Globe className="w-4 h-4 mr-2" />
            Continental
          </Button>
          <Button
            variant={viewMode === 'realtime' ? 'default' : 'outline'}
            onClick={() => setViewMode('realtime')}
            className={`flex-1 sm:flex-none ${viewMode === 'realtime' ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white border-0' : ''}`}
          >
            <Radio className="w-4 h-4 mr-2" />
            Tempo Real
          </Button>
          <Button
            variant={viewMode === 'search' ? 'default' : 'outline'}
            onClick={() => setViewMode('search')}
            className={`flex-1 sm:flex-none ${viewMode === 'search' ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0' : ''}`}
          >
            <Target className="w-4 h-4 mr-2" />
            Pesquisa Global
          </Button>
          <Button
            variant={viewMode === 'ai' ? 'default' : 'outline'}
            onClick={() => setViewMode('ai')}
            className={`flex-1 sm:flex-none ${viewMode === 'ai' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0' : ''}`}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            IA
          </Button>
        </div>

        {viewMode === 'realtime' ? (
          /* Real-time Mode - Sofascore + Corner-Stats.com */
          <div className="space-y-6">
            <Tabs defaultValue="aovivo" className="space-y-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="aovivo" className="gap-2">
                  <Radio className="w-4 h-4 text-red-500" />
                  <span className="hidden sm:inline">Ao Vivo</span>
                </TabsTrigger>
                <TabsTrigger value="brasil" className="gap-2">
                  <span>🇧🇷</span>
                  <span className="hidden sm:inline">Brasil</span>
                </TabsTrigger>
                <TabsTrigger value="europa" className="gap-2">
                  <Globe className="w-4 h-4" />
                  <span className="hidden sm:inline">Europa</span>
                </TabsTrigger>
                <TabsTrigger value="sofascore" className="gap-2">
                  <CornerUpRight className="w-4 h-4" />
                  <span className="hidden sm:inline">Escanteios</span>
                </TabsTrigger>
                <TabsTrigger value="cornerstats" className="gap-2">
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Corner-Stats</span>
                </TabsTrigger>
              </TabsList>

              {/* Ao Vivo Tab - Live Matches */}
              <TabsContent value="aovivo" className="space-y-4">
                <Card className="p-6">
                  <LiveMatches />
                </Card>
              </TabsContent>

              {/* Brasil Tab */}
              <TabsContent value="brasil" className="space-y-4">
                <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  <Card className="p-4">
                    <SofascoreFixtures
                      league="brasileirao_a"
                      onSelectMatch={handleSofascoreMatchSelect}
                      dateFilter={fixturesDateFilter}
                      onDateFilterChange={setFixturesDateFilter}
                      showDateFilter={true}
                    />
                  </Card>
                  <Card className="p-4">
                    <SofascoreFixtures
                      league="brasileirao_b"
                      onSelectMatch={handleSofascoreMatchSelect}
                      dateFilter={fixturesDateFilter}
                      onDateFilterChange={setFixturesDateFilter}
                      showDateFilter={false}
                    />
                  </Card>
                  <Card className="p-4 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-yellow-500/5">
                    <SofascoreFixtures
                      league="copa_do_brasil"
                      onSelectMatch={handleSofascoreMatchSelect}
                      dateFilter={fixturesDateFilter}
                      onDateFilterChange={setFixturesDateFilter}
                      showDateFilter={false}
                    />
                  </Card>
                </div>
                <Card className="p-4 bg-gradient-to-r from-green-500/5 to-emerald-500/5 border-green-500/20">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-green-400 mt-0.5" />
                    <div>
                      <p className="font-medium">Atualização automática</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Jogos em tempo real. Os dados são buscados automaticamente ao acessar esta
                        página. Clique no botão de atualizar em cada card para recarregar.
                      </p>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Europa Tab */}
              <TabsContent value="europa" className="space-y-4">
                {/* UEFA Competitions */}
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="text-xl">🏆</span>
                  Competições UEFA
                </h3>
                <div className="grid lg:grid-cols-2 gap-6">
                  <Card className="p-4 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-yellow-500/5">
                    <SofascoreFixtures
                      league="champions_league"
                      onSelectMatch={(m) => handleEuropaMatchSelect(m, 'champions_league')}
                      dateFilter={fixturesDateFilter}
                      onDateFilterChange={setFixturesDateFilter}
                      showDateFilter={true}
                    />
                  </Card>
                  <Card className="p-4 border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-amber-500/5">
                    <SofascoreFixtures
                      league="europa_league"
                      onSelectMatch={(m) => handleEuropaMatchSelect(m, 'europa_league')}
                      dateFilter={fixturesDateFilter}
                      onDateFilterChange={setFixturesDateFilter}
                      showDateFilter={false}
                    />
                  </Card>
                </div>

                {/* National Leagues */}
                <h3 className="text-lg font-semibold flex items-center gap-2 mt-6">
                  <Globe className="w-5 h-5 text-primary" />
                  Ligas Nacionais
                </h3>
                <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  <Card className="p-4">
                    <SofascoreFixtures
                      league="premier_league"
                      onSelectMatch={(m) => handleEuropaMatchSelect(m, 'premier_league')}
                      dateFilter={fixturesDateFilter}
                      onDateFilterChange={setFixturesDateFilter}
                      showDateFilter={false}
                    />
                  </Card>
                  <Card className="p-4">
                    <SofascoreFixtures
                      league="la_liga"
                      onSelectMatch={(m) => handleEuropaMatchSelect(m, 'la_liga')}
                      dateFilter={fixturesDateFilter}
                      onDateFilterChange={setFixturesDateFilter}
                      showDateFilter={false}
                    />
                  </Card>
                  <Card className="p-4">
                    <SofascoreFixtures
                      league="serie_a"
                      onSelectMatch={(m) => handleEuropaMatchSelect(m, 'serie_a')}
                      dateFilter={fixturesDateFilter}
                      onDateFilterChange={setFixturesDateFilter}
                      showDateFilter={false}
                    />
                  </Card>
                  <Card className="p-4">
                    <SofascoreFixtures
                      league="bundesliga"
                      onSelectMatch={(m) => handleEuropaMatchSelect(m, 'bundesliga')}
                      dateFilter={fixturesDateFilter}
                      onDateFilterChange={setFixturesDateFilter}
                      showDateFilter={false}
                    />
                  </Card>
                  <Card className="p-4">
                    <SofascoreFixtures
                      league="ligue_1"
                      onSelectMatch={(m) => handleEuropaMatchSelect(m, 'ligue_1')}
                      dateFilter={fixturesDateFilter}
                      onDateFilterChange={setFixturesDateFilter}
                      showDateFilter={false}
                    />
                  </Card>
                </div>
                <Card className="p-4 bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-blue-500/20">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div>
                      <p className="font-medium">Ligas Europeias em Tempo Real</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Champions League, Europa League, Premier League, La Liga, Serie A,
                        Bundesliga e Ligue 1 com dados atualizados automaticamente.
                      </p>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Sofascore Corner Stats Tab */}
              <TabsContent value="sofascore" className="space-y-4">
                <Card className="p-4 bg-gradient-to-r from-emerald-500/5 to-green-500/5 border-emerald-500/20">
                  <div className="flex items-start gap-3">
                    <CornerUpRight className="w-5 h-5 text-emerald-400 mt-0.5" />
                    <div>
                      <p className="font-medium">Estatísticas de Escanteios</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Média de escanteios a favor, contra e total por jogo.
                      </p>
                    </div>
                  </div>
                </Card>

                <div className="grid lg:grid-cols-2 gap-6">
                  <Card className="p-4">
                    <SofascoreCornerStats tournament="brasileirao_a" />
                  </Card>
                  <Card className="p-4">
                    <SofascoreCornerStats tournament="brasileirao_b" />
                  </Card>
                </div>

                <h3 className="text-lg font-semibold flex items-center gap-2 mt-6">
                  <Globe className="w-5 h-5 text-primary" />
                  Ligas Europeias
                </h3>

                <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  <Card className="p-4">
                    <SofascoreCornerStats tournament="premier_league" />
                  </Card>
                  <Card className="p-4">
                    <SofascoreCornerStats tournament="la_liga" />
                  </Card>
                  <Card className="p-4">
                    <SofascoreCornerStats tournament="serie_a" />
                  </Card>
                  <Card className="p-4">
                    <SofascoreCornerStats tournament="bundesliga" />
                  </Card>
                  <Card className="p-4">
                    <SofascoreCornerStats tournament="ligue_1" />
                  </Card>
                </div>

                <h3 className="text-lg font-semibold flex items-center gap-2 mt-6">
                  <span className="text-xl">🏆</span>
                  Competições UEFA
                </h3>

                <div className="grid lg:grid-cols-2 gap-6">
                  <Card className="p-4 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-yellow-500/5">
                    <SofascoreCornerStats tournament="champions_league" />
                  </Card>
                  <Card className="p-4 border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-amber-500/5">
                    <SofascoreCornerStats tournament="europa_league" />
                  </Card>
                </div>
              </TabsContent>

              {/* Corner-Stats.com Tab */}
              <TabsContent value="cornerstats" className="space-y-4">
                <LiveCornerStats />

                {/* Data Source Info */}
                <Card className="p-4 bg-gradient-to-r from-green-500/5 to-emerald-500/5 border-green-500/20">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-green-400 mt-0.5" />
                    <div>
                      <p className="font-medium">Dados em tempo real</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Estatísticas extraídas diretamente do{' '}
                        <a
                          href="https://www.corner-stats.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-400 hover:underline"
                        >
                          Corner-Stats.com
                        </a>
                        . Clique em "Buscar Dados" para obter estatísticas atualizadas do
                        Brasileirão e outras competições brasileiras.
                      </p>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : viewMode === 'brazilian' ? (
          <>
            {/* Standings Section (when enabled) */}
            {showStandings ? (
              <div className="space-y-4">
                <Button
                  variant="ghost"
                  onClick={() => setShowStandings(false)}
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para estatísticas
                </Button>

                <div className="flex items-center gap-3 mb-4">
                  <Trophy className="w-6 h-6 text-amber-400" />
                  <h2 className="text-xl font-bold">Classificação - Brasileirão</h2>
                </div>

                {/* League Tabs for Série A and B */}
                <Tabs defaultValue="serie_a" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="serie_a">Série A</TabsTrigger>
                    <TabsTrigger value="serie_b">Série B</TabsTrigger>
                    <TabsTrigger value="copa">Copa BR</TabsTrigger>
                  </TabsList>

                  <TabsContent value="serie_a" className="space-y-4">
                    <Scores365Standings league="brasileirao_a" />
                    <div className="grid lg:grid-cols-2 gap-6">
                      <Card className="p-4">
                        <Scores365UpcomingMatches league="brasileirao_a" />
                      </Card>
                      <Card className="p-4">
                        <Scores365Results league="brasileirao_a" />
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="serie_b" className="space-y-4">
                    <Scores365Standings league="brasileirao_b" />
                    <div className="grid lg:grid-cols-2 gap-6">
                      <Card className="p-4">
                        <Scores365UpcomingMatches league="brasileirao_b" />
                      </Card>
                      <Card className="p-4">
                        <Scores365Results league="brasileirao_b" />
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="copa" className="space-y-4">
                    <Scores365Standings league="copa_do_brasil" />
                    <div className="grid lg:grid-cols-2 gap-6">
                      <Card className="p-4">
                        <Scores365UpcomingMatches league="copa_do_brasil" />
                      </Card>
                      <Card className="p-4">
                        <Scores365Results league="copa_do_brasil" />
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <>
                {/* Brazilian Mode - Sofascore Stats Tabs */}
                <Tabs value={brazilianTab} onValueChange={setBrazilianTab} className="space-y-4">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="stats" className="gap-2">
                      <CornerUpRight className="w-4 h-4" />
                      <span className="hidden sm:inline">Estatísticas</span>
                    </TabsTrigger>
                    <TabsTrigger value="predictions" className="gap-2">
                      <Target className="w-4 h-4" />
                      <span className="hidden sm:inline">Previsões</span>
                    </TabsTrigger>
                    <TabsTrigger value="compare" className="gap-2">
                      <TrendingUp className="w-4 h-4" />
                      <span className="hidden sm:inline">Comparar</span>
                    </TabsTrigger>
                    <TabsTrigger value="value" className="gap-2">
                      <Zap className="w-4 h-4" />
                      <span className="hidden sm:inline">Alertas</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Stats Tab - Sofascore Live Data */}
                  <TabsContent value="stats" className="space-y-4">
                    {/* Team Filters */}
                    <TeamFiltersPanel
                      filters={teamFilters}
                      onFiltersChange={setTeamFilters}
                      teams={teamStats}
                    />

                    <Tabs defaultValue="serie_a" className="space-y-4">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="serie_a">🇧🇷 Série A</TabsTrigger>
                        <TabsTrigger value="serie_b">🇧🇷 Série B</TabsTrigger>
                        <TabsTrigger value="copa">🏆 Copa BR</TabsTrigger>
                      </TabsList>

                      {/* Ver Classificação Button - positioned right after league tabs */}
                      <Card
                        className="p-4 cursor-pointer hover:bg-accent/50 transition-colors border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-yellow-500/5"
                        onClick={() => setShowStandings(true)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Trophy className="w-6 h-6 text-amber-400" />
                            <div>
                              <p className="font-medium">Ver Classificação e Tabelas</p>
                              <p className="text-sm text-muted-foreground">
                                Tabela atualizada, próximos jogos e resultados recentes
                              </p>
                            </div>
                          </div>
                          <CornerUpRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </Card>

                      <TabsContent value="serie_a" className="space-y-4">
                        <Card className="p-4">
                          <SofascoreCornerStats
                            tournament="brasileirao_a"
                            filteredTeams={filteredTeams}
                            onTeamSelect={(team) => {
                              const foundTeam = findTeamByName(team.team);
                              if (foundTeam) {
                                if (!selectedTeam) {
                                  setSelectedTeam(foundTeam);
                                  setPreviousBrazilianTab(brazilianTab);
                                  setBrazilianTab('compare');
                                } else {
                                  setCompareTeam(foundTeam);
                                }
                              }
                            }}
                          />
                        </Card>

                        {/* Upcoming Matches with Referee Info */}
                        <Card className="p-4">
                          <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                            <Calendar className="w-5 h-5 text-primary" />
                            Próximos Jogos - Série A
                            <span title="Com estatísticas de árbitro">
                              <CreditCard className="w-4 h-4 text-yellow-500 ml-2" />
                            </span>
                          </h3>
                          <TheSportsDBFixtures
                            league="brasileirao_a"
                            onSelectMatch={(home, away) => {
                              const homeTeam = findTeamByName(home);
                              const awayTeam = findTeamByName(away);
                              if (homeTeam) setSelectedTeam(homeTeam);
                              if (awayTeam) setCompareTeam(awayTeam);
                              setPreviousBrazilianTab(brazilianTab);
                              setBrazilianTab('compare');
                            }}
                          />
                        </Card>
                      </TabsContent>

                      <TabsContent value="serie_b" className="space-y-4">
                        <Card className="p-4">
                          <SofascoreCornerStats
                            tournament="brasileirao_b"
                            onTeamSelect={(team) => {
                              const foundTeam = findTeamByName(team.team);
                              if (foundTeam) {
                                if (!selectedTeam) {
                                  setSelectedTeam(foundTeam);
                                  setPreviousBrazilianTab(brazilianTab);
                                  setBrazilianTab('compare');
                                } else {
                                  setCompareTeam(foundTeam);
                                }
                              }
                            }}
                          />
                        </Card>

                        {/* Upcoming Matches with Referee Info */}
                        <Card className="p-4">
                          <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                            <Calendar className="w-5 h-5 text-primary" />
                            Próximos Jogos - Série B
                            <span title="Com estatísticas de árbitro">
                              <CreditCard className="w-4 h-4 text-yellow-500 ml-2" />
                            </span>
                          </h3>
                          <TheSportsDBFixtures
                            league="brasileirao_b"
                            onSelectMatch={(home, away) => {
                              const homeTeam = findTeamByName(home);
                              const awayTeam = findTeamByName(away);
                              if (homeTeam) setSelectedTeam(homeTeam);
                              if (awayTeam) setCompareTeam(awayTeam);
                              setPreviousBrazilianTab(brazilianTab);
                              setBrazilianTab('compare');
                            }}
                          />
                        </Card>
                      </TabsContent>

                      <TabsContent value="copa" className="space-y-4">
                        <Card className="p-4">
                          <SofascoreCornerStats
                            tournament="copa_do_brasil"
                            onTeamSelect={(team) => {
                              const foundTeam = findTeamByName(team.team);
                              if (foundTeam) {
                                if (!selectedTeam) {
                                  setSelectedTeam(foundTeam);
                                  setPreviousBrazilianTab(brazilianTab);
                                  setBrazilianTab('compare');
                                } else {
                                  setCompareTeam(foundTeam);
                                }
                              }
                            }}
                          />
                        </Card>

                        <Card className="p-4">
                          <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                            <Calendar className="w-5 h-5 text-primary" />
                            Próximos Jogos - Copa do Brasil
                          </h3>
                          <TheSportsDBFixtures
                            league="copa_do_brasil"
                            onSelectMatch={(home, away) => {
                              const homeTeam = findTeamByName(home);
                              const awayTeam = findTeamByName(away);
                              if (homeTeam) setSelectedTeam(homeTeam);
                              if (awayTeam) setCompareTeam(awayTeam);
                              setPreviousBrazilianTab(brazilianTab);
                              setBrazilianTab('compare');
                            }}
                          />
                        </Card>
                      </TabsContent>

                    </Tabs>
                  </TabsContent>

                  {/* Predictions Tab */}
                  <TabsContent value="predictions" className="space-y-4">
                    <PredictionsTab
                      onSelectMatch={(home, away) => {
                        const homeTeam = findTeamByName(home);
                        const awayTeam = findTeamByName(away);
                        if (homeTeam) setSelectedTeam(homeTeam);
                        if (awayTeam) setCompareTeam(awayTeam);
                        setPreviousBrazilianTab(brazilianTab);
                        setBrazilianTab('compare');
                      }}
                    />
                  </TabsContent>

                  {/* Compare Tab - Team Selectors */}
                  <TabsContent value="compare" className="space-y-4">
                    {/* Team Selectors Card */}
                    <Card className="p-5">
                      <div className="grid md:grid-cols-2 gap-4">
                        <TeamSelector
                          selectedTeam={selectedTeam}
                          onSelect={setSelectedTeam}
                          label="Time principal"
                          placeholder="Buscar time..."
                        />
                        <TeamSelector
                          selectedTeam={compareTeam}
                          onSelect={setCompareTeam}
                          label="Comparar com (oponente)"
                          placeholder="Selecione para ver H2H..."
                        />
                      </div>

                      {/* Last N Games Filter */}
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-muted-foreground">
                            Média dos últimos jogos
                          </label>
                          <Badge variant="outline">{lastNGames} jogos</Badge>
                        </div>
                        <Slider
                          value={[lastNGames]}
                          onValueChange={([val]) => setLastNGames(val)}
                          min={1}
                          max={10}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    </Card>

                    {/* Main Content when team selected */}
                    {selectedTeam ? (
                      <div className="space-y-4">
                        {/* Back Button */}
                        <Button
                          variant="ghost"
                          onClick={handleGoBack}
                          className="gap-2 text-muted-foreground hover:text-foreground"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Voltar
                        </Button>

                        <Tabs defaultValue="stats" className="space-y-4">
                          <TabsList className="grid w-full grid-cols-6">
                            <TabsTrigger value="stats" className="gap-2">
                              <BarChart3 className="w-4 h-4" />
                              <span className="hidden sm:inline">Stats</span>
                            </TabsTrigger>
                            <TabsTrigger value="cards" className="gap-2">
                              <CreditCard className="w-4 h-4" />
                              <span className="hidden sm:inline">Cartões</span>
                            </TabsTrigger>
                            <TabsTrigger value="shots" className="gap-2">
                              <Target className="w-4 h-4" />
                              <span className="hidden sm:inline">Finalizações</span>
                            </TabsTrigger>
                            <TabsTrigger value="trends" className="gap-2">
                              <TrendingUp className="w-4 h-4" />
                              <span className="hidden sm:inline">Gráficos</span>
                            </TabsTrigger>
                            <TabsTrigger value="h2h" className="gap-2" disabled={!compareTeam}>
                              <Zap className="w-4 h-4" />
                              <span className="hidden sm:inline">H2H</span>
                            </TabsTrigger>
                            <TabsTrigger value="next" className="gap-2">
                              <Calendar className="w-4 h-4" />
                              <span className="hidden sm:inline">Próximos</span>
                            </TabsTrigger>
                          </TabsList>

                          {/* Stats Tab */}
                          <TabsContent value="stats" className="space-y-4">
                            <div className={compareTeam ? 'grid lg:grid-cols-2 gap-4' : ''}>
                              <TeamStatsCard team={selectedTeam} lastNGames={lastNGames} />
                              {compareTeam && (
                                <TeamStatsCard team={compareTeam} lastNGames={lastNGames} />
                              )}
                            </div>
                          </TabsContent>

                          {/* Cards Tab */}
                          <TabsContent value="cards" className="space-y-4">
                            {(() => {
                              const teamCardStats = findTeamCardStats(selectedTeam.team);
                              const compareCardStats = compareTeam
                                ? findTeamCardStats(compareTeam.team)
                                : null;

                              if (!teamCardStats) {
                                return (
                                  <Card className="p-8 text-center">
                                    <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-medium">
                                      Dados de cartões indisponíveis
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      Estatísticas de cartões para {selectedTeam.team} não estão
                                      disponíveis
                                    </p>
                                  </Card>
                                );
                              }

                              return (
                                <div
                                  className={compareCardStats ? 'grid lg:grid-cols-2 gap-4' : ''}
                                >
                                  <TeamCardStatsCard team={teamCardStats} lastNGames={lastNGames} />
                                  {compareCardStats && (
                                    <TeamCardStatsCard
                                      team={compareCardStats}
                                      lastNGames={lastNGames}
                                    />
                                  )}
                                </div>
                              );
                            })()}
                          </TabsContent>

                          {/* Shots Tab */}
                          <TabsContent value="shots" className="space-y-4">
                            {(() => {
                              const teamShotStats = findBrazilianShotStats(selectedTeam.team);
                              const compareShotStats = compareTeam
                                ? findBrazilianShotStats(compareTeam.team)
                                : null;

                              if (!teamShotStats) {
                                return (
                                  <Card className="p-8 text-center">
                                    <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-medium">
                                      Dados de finalizações indisponíveis
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      Estatísticas de finalizações para {selectedTeam.team} não
                                      estão disponíveis
                                    </p>
                                  </Card>
                                );
                              }

                              return (
                                <div
                                  className={compareShotStats ? 'grid lg:grid-cols-2 gap-4' : ''}
                                >
                                  <TeamShotStatsCard team={teamShotStats} lastNGames={lastNGames} />
                                  {compareShotStats && (
                                    <TeamShotStatsCard
                                      team={compareShotStats}
                                      lastNGames={lastNGames}
                                    />
                                  )}
                                </div>
                              );
                            })()}
                          </TabsContent>

                          {/* Trends Tab */}
                          <TabsContent value="trends" className="space-y-4">
                            <CornerTrendsChart
                              team={selectedTeam}
                              compareTeam={compareTeam || undefined}
                            />
                          </TabsContent>

                          {/* H2H Tab */}
                          <TabsContent value="h2h">
                            {h2hData ? (
                              <HeadToHeadExpanded h2h={h2hData} />
                            ) : compareTeam ? (
                              <Card className="p-8 text-center">
                                <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">Sem dados de confronto direto</p>
                                <p className="text-sm text-muted-foreground">
                                  Não encontramos histórico entre {selectedTeam.team} e{' '}
                                  {compareTeam.team}
                                </p>
                              </Card>
                            ) : (
                              <Card className="p-8 text-center">
                                <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">Selecione um oponente</p>
                                <p className="text-sm text-muted-foreground">
                                  Escolha um segundo time para ver o confronto direto
                                </p>
                              </Card>
                            )}
                          </TabsContent>

                          {/* Next Matches Tab */}
                          <TabsContent value="next" className="space-y-4">
                            {nextMatch ? (
                              <div className="space-y-6">
                                <h3 className="text-lg font-medium flex items-center gap-2">
                                  <Calendar className="w-5 h-5 text-primary" />
                                  Próximo jogo de {selectedTeam.team}
                                </h3>
                                <NextMatchCard
                                  match={nextMatch}
                                  onSelectMatch={handleMatchSelect}
                                />

                                {/* Detailed Prediction */}
                                <div className="pt-4 border-t border-border">
                                  <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                                    <Target className="w-5 h-5 text-primary" />
                                    Análise Detalhada
                                  </h3>
                                  <MatchPrediction match={nextMatch} />
                                </div>
                              </div>
                            ) : (
                              <Card className="p-8 text-center">
                                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">Sem jogos agendados</p>
                                <p className="text-sm text-muted-foreground">
                                  Não há jogos previstos para {selectedTeam.team}
                                </p>
                              </Card>
                            )}
                          </TabsContent>
                        </Tabs>

                        {/* Bottom Voltar button */}
                        <div className="pt-2 pb-4">
                          <Button
                            variant="outline"
                            onClick={handleGoBack}
                            className="gap-2 w-full sm:w-auto"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            Voltar para Estatísticas
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Card className="p-8 text-center">
                        <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">Selecione um time</p>
                        <p className="text-sm text-muted-foreground">
                          Escolha um time acima para ver estatísticas detalhadas e comparar
                        </p>
                      </Card>
                    )}
                  </TabsContent>

                  {/* Value Alerts Tab */}
                  <TabsContent value="value" className="space-y-6">
                    <FavoriteTeamAlerts
                      onTeamClick={(teamName) => {
                        const team = findTeamByName(teamName);
                        if (team) {
                          setSelectedTeam(team);
                          setBrazilianTab('stats');
                        }
                      }}
                    />
                    <ValueAlerts scope="brazil" />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </>
        ) : viewMode === 'international' ? (
          /* International Mode */
          <div className="space-y-6">
            {/* Standings View for International */}
            {showIntlStandings && selectedLeague ? (
              <div className="space-y-4">
                <Button
                  variant="ghost"
                  onClick={() => setShowIntlStandings(false)}
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para estatísticas
                </Button>

                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{selectedLeague.flag}</span>
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Trophy className="w-6 h-6 text-amber-400" />
                      Classificação - {selectedLeague.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">{selectedLeague.country}</p>
                  </div>
                </div>

                <Scores365Standings
                  league={LEAGUE_TO_365SCORES[selectedLeague.id] || 'premier_league'}
                />

                <div className="grid lg:grid-cols-2 gap-6">
                  <Card className="p-4">
                    <Scores365UpcomingMatches
                      league={LEAGUE_TO_365SCORES[selectedLeague.id] || 'premier_league'}
                      onMatchClick={(home, away) => {
                        if (leagueStats) {
                          const homeTeamData = leagueStats.teams.find(
                            (t) =>
                              t.team.toLowerCase().includes(home.toLowerCase()) ||
                              home.toLowerCase().includes(t.team.toLowerCase())
                          );
                          const awayTeamData = leagueStats.teams.find(
                            (t) =>
                              t.team.toLowerCase().includes(away.toLowerCase()) ||
                              away.toLowerCase().includes(t.team.toLowerCase())
                          );
                          if (homeTeamData) setSelectedIntlTeam(homeTeamData);
                          if (awayTeamData) setCompareIntlTeam(awayTeamData);
                          setShowIntlStandings(false);
                          setIntlTab('h2h');
                        }
                      }}
                    />
                  </Card>
                  <Card className="p-4">
                    <Scores365Results
                      league={LEAGUE_TO_365SCORES[selectedLeague.id] || 'premier_league'}
                    />
                  </Card>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="ligas" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="ligas" className="gap-2">
                    <Globe className="w-4 h-4" />
                    Ligas e Estatísticas
                  </TabsTrigger>
                  <TabsTrigger value="odds" className="gap-2">
                    <Zap className="w-4 h-4" />
                    Odds
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="odds" className="space-y-4">
                  <ValueAlerts scope="international" />
                </TabsContent>

                <TabsContent value="ligas" className="space-y-6">
                  {/* League Selector */}
                  <Card className="p-5">
                  <div className="space-y-4">
                    <label className="text-sm font-medium text-muted-foreground">
                      Selecione uma liga
                    </label>
                    <LeagueSelector
                      selectedLeague={selectedLeague}
                      onSelect={(league) => {
                        setSelectedLeague(league);
                        setShowIntlStandings(false);
                      }}
                    />
                  </div>
                </Card>

                {/* Ver Classificação Button */}
                {selectedLeague && (
                  <Card
                    className="p-4 cursor-pointer hover:bg-accent/50 transition-colors border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-yellow-500/5"
                    onClick={() => setShowIntlStandings(true)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Trophy className="w-6 h-6 text-amber-400" />
                        <div>
                          <p className="font-medium">Ver Classificação e Tabelas</p>
                          <p className="text-sm text-muted-foreground">
                            Tabela atualizada, próximos jogos e resultados recentes
                          </p>
                        </div>
                      </div>
                      <CornerUpRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </Card>
                )}

                {/* League Stats */}
                {selectedLeague && selectedLeague.id !== 'BR1' ? (
                  isNoCSVLeague ? (
                    /* Leagues without CSV - Use Sofascore Only */
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{selectedLeague.flag}</span>
                        <div>
                          <h2 className="text-lg font-medium">{selectedLeague.name}</h2>
                          <p className="text-sm text-muted-foreground">{selectedLeague.country}</p>
                        </div>
                      </div>

                      <Tabs
                        value={intlMainTab}
                        onValueChange={setIntlMainTab}
                        className="space-y-4"
                      >
                        <TabsList className="grid w-full grid-cols-5">
                          <TabsTrigger value="stats" className="gap-2">
                            <CornerUpRight className="w-4 h-4" />
                            <span className="hidden sm:inline">Escanteios</span>
                          </TabsTrigger>
                          <TabsTrigger value="cards" className="gap-2">
                            <CreditCard className="w-4 h-4" />
                            <span className="hidden sm:inline">Cartões</span>
                          </TabsTrigger>
                          <TabsTrigger value="shots" className="gap-2">
                            <Target className="w-4 h-4" />
                            <span className="hidden sm:inline">Finalizações</span>
                          </TabsTrigger>
                          <TabsTrigger value="compare" className="gap-2">
                            <TrendingUp className="w-4 h-4" />
                            <span className="hidden sm:inline">Comparar</span>
                          </TabsTrigger>
                          <TabsTrigger value="value" className="gap-2">
                            <Zap className="w-4 h-4" />
                            <span className="hidden sm:inline">Alertas</span>
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="stats" className="space-y-4">
                          {/* Advanced Filters */}
                          <IntlTeamFiltersPanel
                            filters={intlFilters}
                            onFiltersChange={setIntlFilters}
                            teams={leagueStats?.teams || []}
                          />

                          {/* Corner Stats from Football-Data.co.uk */}
                          <Card className="p-4">
                            <FootballDataCornerStats
                              teams={filteredIntlTeams}
                              leagueName={selectedLeague.name}
                              flag={selectedLeague.flag}
                              matchesAnalyzed={leagueStats?.matchesAnalyzed}
                              halftimeStats={halftimeStats?.teams}
                              halftimeLoading={halftimeLoading}
                              onLoadHalftime={() => {
                                const tournament =
                                  LEAGUE_TO_SOFASCORE_TOURNAMENT[selectedLeague.id];
                                if (tournament) fetchHalftimeCorners(tournament);
                              }}
                              onTeamSelect={(team) => {
                                if (!selectedIntlTeam) {
                                  setSelectedIntlTeam(team);
                                  setIntlMainTab('compare');
                                } else if (team.team !== selectedIntlTeam.team) {
                                  setCompareIntlTeam(team);
                                  setIntlMainTab('compare');
                                }
                              }}
                            />
                          </Card>

                          {/* Upcoming Matches */}
<Card className="p-4">
  <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
    <Calendar className="w-5 h-5 text-primary" />
    Próximos Jogos
  </h3>

  {(() => {
    const sofascoreLeague = LEAGUE_TO_SOFASCORE[selectedLeague.id];
    const scores365League = LEAGUE_TO_365SCORES[selectedLeague.id];

    if (sofascoreLeague) {
      return (
        <SofascoreFixtures
          league={sofascoreLeague}
          onSelectMatch={(match) =>
            handleIntlMatchSelect(match.homeTeam.name, match.awayTeam.name)
          }
        />
      );
    }

    if (scores365League) {
      return (
        <Scores365UpcomingMatches
          league={scores365League}
          onMatchClick={(home, away) => {
            handleIntlMatchSelect(home, away);
          }}
        />
      );
    }

    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p>Nenhum próximo jogo disponível para esta liga no momento.</p>
      </div>
    );
  })()}
</Card>
                        </TabsContent>

                        <TabsContent value="cards" className="space-y-4">
                          <Card className="p-4">
                            <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                              <CreditCard className="w-5 h-5 text-yellow-500" />
                              Estatísticas de Cartões
                            </h3>
                            {cardStatsLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                              </div>
                            ) : cardStats ? (
                              <CardStatsTable data={cardStats} />
                            ) : (
                              <div className="text-center py-8">
                                <p className="text-muted-foreground mb-4">
                                  Carregando estatísticas de cartões...
                                </p>
                                <Button
                                  onClick={() => refetchCardStats()}
                                  variant="outline"
                                  size="sm"
                                >
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Carregar dados
                                </Button>
                              </div>
                            )}
                          </Card>
                        </TabsContent>

                        <TabsContent value="shots" className="space-y-4">
                          <Card className="p-4">
                            <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                              <Target className="w-5 h-5 text-primary" />
                              Estatísticas de Finalizações
                            </h3>
                            {shotStatsLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                              </div>
                            ) : shotStats ? (
                              <ShotStatsTable data={shotStats} />
                            ) : (
                              <div className="text-center py-8">
                                <p className="text-muted-foreground mb-4">
                                  Carregando estatísticas de finalizações...
                                </p>
                                <Button
                                  onClick={() => refetchShotStats()}
                                  variant="outline"
                                  size="sm"
                                >
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Carregar dados
                                </Button>
                              </div>
                            )}
                          </Card>
                        </TabsContent>

                        <TabsContent value="compare" className="space-y-4">
                          <Card className="p-4">
                            <p className="text-center text-muted-foreground">
                              Clique em um próximo jogo na aba "Escanteios" para ver o confronto
                              direto
                            </p>
                          </Card>
                        </TabsContent>

                        <TabsContent value="value" className="space-y-6">
                          <FavoriteTeamAlerts
                            onTeamClick={(teamName) => {
                              const team = findTeamByName(teamName);
                              if (team) {
                                setSelectedTeam(team);
                                setViewMode('brazilian');
                                setBrazilianTab('stats');
                              }
                            }}
                          />
                          <ValueAlerts scope="international" />
                        </TabsContent>
                      </Tabs>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{selectedLeague.flag}</span>
                          <div>
                            <h2 className="text-lg font-medium">{selectedLeague.name}</h2>
                            <p className="text-sm text-muted-foreground">
                              {selectedLeague.country}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {leagueStats && (
                            <Badge variant="outline">
                              {leagueStats.matchesAnalyzed} jogos analisados
                            </Badge>
                          )}
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => fetchStats(selectedLeague.id)}
                            disabled={leagueLoading}
                          >
                            <RefreshCw
                              className={`w-4 h-4 ${leagueLoading ? 'animate-spin' : ''}`}
                            />
                          </Button>
                        </div>
                      </div>

                      {leagueLoading ? (
                        <Card className="p-12 text-center">
                          <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                          <p className="text-lg font-medium">Carregando estatísticas...</p>
                          <p className="text-sm text-muted-foreground">Buscando estatísticas...</p>
                        </Card>
                      ) : leagueError ? (
                        <Card className="p-8 text-center">
                          <Info className="w-12 h-12 text-destructive mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium">Erro ao carregar dados</p>
                          <p className="text-sm text-muted-foreground">{leagueError}</p>
                          <Button
                            variant="outline"
                            className="mt-4"
                            onClick={() => fetchStats(selectedLeague.id)}
                          >
                            Tentar novamente
                          </Button>
                        </Card>
                      ) : leagueStats ? (
                        <Tabs
                          value={intlMainTab}
                          onValueChange={setIntlMainTab}
                          className="space-y-4"
                        >
                          <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="stats" className="gap-2">
                              <CornerUpRight className="w-4 h-4" />
                              <span className="hidden sm:inline">Escanteios</span>
                            </TabsTrigger>
                            <TabsTrigger value="cards" className="gap-2">
                              <CreditCard className="w-4 h-4" />
                              <span className="hidden sm:inline">Cartões</span>
                            </TabsTrigger>
                            <TabsTrigger value="shots" className="gap-2">
                              <Target className="w-4 h-4" />
                              <span className="hidden sm:inline">Finalizações</span>
                            </TabsTrigger>
                            <TabsTrigger value="compare" className="gap-2">
                              <TrendingUp className="w-4 h-4" />
                              <span className="hidden sm:inline">Comparar</span>
                            </TabsTrigger>
                            <TabsTrigger value="value" className="gap-2">
                              <Zap className="w-4 h-4" />
                              <span className="hidden sm:inline">Alertas</span>
                            </TabsTrigger>
                          </TabsList>

                          {/* Stats Tab */}
                          <TabsContent value="stats" className="space-y-4">
                            {/* Advanced Filters */}
                            <IntlTeamFiltersPanel
                              filters={intlFilters}
                              onFiltersChange={setIntlFilters}
                              teams={leagueStats?.teams || []}
                            />

                            {/* Corner Stats */}
                            <Card className="p-4">
                              <FootballDataCornerStats
                                teams={filteredIntlTeams}
                                leagueName={selectedLeague.name}
                                flag={selectedLeague.flag}
                                matchesAnalyzed={leagueStats.matchesAnalyzed}
                                halftimeStats={halftimeStats?.teams}
                                halftimeLoading={halftimeLoading}
                                onLoadHalftime={() => {
                                  const tournament =
                                    LEAGUE_TO_SOFASCORE_TOURNAMENT[selectedLeague.id];
                                  if (tournament) fetchHalftimeCorners(tournament);
                                }}
                                onTeamSelect={(team) => {
                                  if (!selectedIntlTeam) {
                                    setSelectedIntlTeam(team);
                                    setIntlMainTab('compare');
                                  } else if (team.team !== selectedIntlTeam.team) {
                                    setCompareIntlTeam(team);
                                    setIntlMainTab('compare');
                                  }
                                }}
                              />
                            </Card>

                            {/* Upcoming Matches */}
                            {LEAGUE_TO_SOFASCORE[selectedLeague.id] && (
                              <Card className="p-4">
                                <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                                  <Calendar className="w-5 h-5 text-primary" />
                                  Próximos Jogos
                                </h3>
                                <SofascoreFixtures
                                  league={LEAGUE_TO_SOFASCORE[selectedLeague.id]}
                                  onSelectMatch={(match) =>
                                    handleIntlMatchSelect(match.homeTeam.name, match.awayTeam.name)
                                  }
                                />
                              </Card>
                            )}
                          </TabsContent>

                          {/* Cards Tab */}
                          <TabsContent value="cards" className="space-y-4">
                            <Card className="p-4">
                              <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                                <CreditCard className="w-5 h-5 text-yellow-500" />
                                Estatísticas de Cartões
                              </h3>
                              {cardStatsLoading ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                              ) : cardStats ? (
                                <CardStatsTable data={cardStats} />
                              ) : (
                                <div className="text-center py-8">
                                  <p className="text-muted-foreground mb-4">
                                    Carregando estatísticas de cartões...
                                  </p>
                                  <Button
                                    onClick={() => refetchCardStats()}
                                    variant="outline"
                                    size="sm"
                                  >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Carregar dados
                                  </Button>
                                </div>
                              )}
                            </Card>
                          </TabsContent>

                          {/* Shots Tab */}
                          <TabsContent value="shots" className="space-y-4">
                            <Card className="p-4">
                              <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                                <Target className="w-5 h-5 text-primary" />
                                Estatísticas de Finalizações
                              </h3>
                              {shotStatsLoading ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                              ) : shotStats ? (
                                <ShotStatsTable data={shotStats} />
                              ) : (
                                <div className="text-center py-8">
                                  <p className="text-muted-foreground mb-4">
                                    Carregando estatísticas de finalizações...
                                  </p>
                                  <Button
                                    onClick={() => refetchShotStats()}
                                    variant="outline"
                                    size="sm"
                                  >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Carregar dados
                                  </Button>
                                </div>
                              )}
                            </Card>
                          </TabsContent>

                          {/* Compare Tab */}
                          <TabsContent value="compare" className="space-y-4">
                            {selectedIntlTeam ? (
                              <>
                                <Button
                                  variant="ghost"
                                  onClick={handleIntlGoBack}
                                  className="gap-2 text-muted-foreground hover:text-foreground"
                                >
                                  <ArrowLeft className="w-4 h-4" />
                                  Limpar seleção
                                </Button>

                                {/* Team Selection Info */}
                                <Card className="p-4 bg-muted/30">
                                  <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-muted-foreground">
                                        Time selecionado:
                                      </span>
                                      <Badge variant="default">{selectedIntlTeam.team}</Badge>
                                    </div>
                                    {compareIntlTeam ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">
                                          Comparando com:
                                        </span>
                                        <Badge variant="secondary">{compareIntlTeam.team}</Badge>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setCompareIntlTeam(null)}
                                          className="h-6 px-2"
                                        >
                                          ×
                                        </Button>
                                      </div>
                                    ) : (
                                      <span className="text-sm text-muted-foreground italic">
                                        Clique em um próximo jogo ou na tabela de times para
                                        comparar
                                      </span>
                                    )}
                                  </div>
                                </Card>

                                {/* Team Stats Cards */}
                                <div className={compareIntlTeam ? 'grid lg:grid-cols-2 gap-4' : ''}>
                                  <InternationalTeamStatsCard team={selectedIntlTeam} />
                                  {compareIntlTeam && (
                                    <InternationalTeamStatsCard team={compareIntlTeam} />
                                  )}
                                </div>

                                {/* H2H Section */}
                                {compareIntlTeam && (
                                  <div className="space-y-4">
                                    <h3 className="text-lg font-medium flex items-center gap-2">
                                      <TrendingUp className="w-5 h-5 text-primary" />
                                      Confronto Direto
                                    </h3>
                                    {h2hLoading ? (
                                      <Card className="p-12 text-center">
                                        <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                                        <p className="text-lg font-medium">
                                          Carregando confronto direto...
                                        </p>
                                      </Card>
                                    ) : intlH2H ? (
                                      <InternationalH2HCard h2h={intlH2H} />
                                    ) : (
                                      <Card className="p-8 text-center">
                                        <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                        <p className="text-lg font-medium">
                                          Sem dados de confronto direto
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                          Não encontramos histórico entre {selectedIntlTeam.team} e{' '}
                                          {compareIntlTeam.team} nesta temporada
                                        </p>
                                      </Card>
                                    )}
                                  </div>
                                )}
                              </>
                            ) : (
                              <Card className="p-8 text-center">
                                <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">Selecione times para comparar</p>
                                <p className="text-sm text-muted-foreground">
                                  Clique em um próximo jogo na aba "Estatísticas" ou selecione times
                                  na tabela
                                </p>
                              </Card>
                            )}
                          </TabsContent>

                          {/* Value Alerts Tab */}
                          <TabsContent value="value" className="space-y-6">
                            <FavoriteTeamAlerts
                              onTeamClick={(teamName) => {
                                const team = findTeamByName(teamName);
                                if (team) {
                                  setSelectedTeam(team);
                                  setViewMode('brazilian');
                                  setBrazilianTab('stats');
                                }
                              }}
                            />
                            <ValueAlerts scope="international" />
                          </TabsContent>
                        </Tabs>
                      ) : null}
                    </div>
                  )
                ) : selectedLeague?.id === 'BR1' ? (
                  <Card className="p-8 text-center">
                    <span className="text-5xl mb-4 block">🇧🇷</span>
                    <p className="text-lg font-medium">Brasileirão Série A</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Use a aba "Brasileirão" para ver estatísticas detalhadas dos times brasileiros
                    </p>
                    <Button className="mt-4" onClick={() => setViewMode('brazilian')}>
                      Ir para Brasileirão
                    </Button>
                  </Card>
                ) : (
                  <Card className="p-8 text-center">
                    <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Selecione uma liga</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Escolha uma liga europeia para ver estatísticas detalhadas de escanteios
                    </p>
                  </Card>
                )}
                </TabsContent>
              </Tabs>
            )}

            {/* Data Info */}
            <Card className="p-4 bg-gradient-to-r from-blue-500/5 to-emerald-500/5 border-blue-500/20">
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-blue-400" />
                <p className="text-sm text-muted-foreground">Dados atualizados semanalmente.</p>
              </div>
            </Card>
          </div>
        ) : viewMode === 'search' ? (
          /* Search Mode */
          <GlobalCornerSearch />
        ) : viewMode === 'ai' ? (
          /* AI Mode */
          <AIChat />
        ) : viewMode === 'worldcup' ? (
          /* Copa do Mundo Mode */
          <WorldCupPage />
        ) : viewMode === 'continental' ? (
          /* Continental Competitions Mode */
          <ContinentalPage />
        ) : null}
      </main>
    </div>
  );
}
