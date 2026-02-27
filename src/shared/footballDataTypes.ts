/**
 * Types for Football-Data.co.uk CSV data
 * Source: https://www.football-data.co.uk/
 */

// Raw match data from CSV
export interface FootballDataMatch {
  // Match info
  div: string;          // League Division
  date: string;         // Match date (DD/MM/YYYY)
  time?: string;        // Kick-off time
  homeTeam: string;     // Home Team
  awayTeam: string;     // Away Team
  
  // Final score
  ftHomeGoals: number;  // Full Time Home Goals
  ftAwayGoals: number;  // Full Time Away Goals
  ftResult: 'H' | 'D' | 'A'; // Full Time Result (H=Home Win, D=Draw, A=Away Win)
  
  // Half time score
  htHomeGoals?: number; // Half Time Home Goals
  htAwayGoals?: number; // Half Time Away Goals
  htResult?: 'H' | 'D' | 'A'; // Half Time Result
  
  // Match stats (not all leagues have these)
  homeShots?: number;   // Home Team Shots
  awayShots?: number;   // Away Team Shots
  homeShotsOnTarget?: number;  // Home Team Shots on Target
  awayShotsOnTarget?: number;  // Away Team Shots on Target
  homeCorners: number;  // Home Team Corners
  awayCorners: number;  // Away Team Corners
  homeFouls?: number;   // Home Team Fouls
  awayFouls?: number;   // Away Team Fouls
  homeYellow?: number;  // Home Team Yellow Cards
  awayYellow?: number;  // Away Team Yellow Cards
  homeRed?: number;     // Home Team Red Cards
  awayRed?: number;     // Away Team Red Cards
}

// League configuration
export interface LeagueConfig {
  id: string;
  name: string;
  country: string;
  csvUrl: string;
  flag: string;
}

// Processed team statistics
export interface TeamCornerStats {
  team: string;
  league: string;
  leagueId: string;
  country: string;
  
  // General stats
  gamesPlayed: number;
  totalCornersFor: number;
  totalCornersAgainst: number;
  avgCornersFor: number;
  avgCornersAgainst: number;
  avgTotalCorners: number;
  
  // Home/Away breakdown
  homeGames: number;
  awayGames: number;
  homeCornersFor: number;
  homeCornersAgainst: number;
  awayCornersFor: number;
  awayCornersAgainst: number;
  avgCornersHome: number;
  avgCornersAway: number;
  
  // Over/Under percentages
  over85Pct: number;
  over95Pct: number;
  over105Pct: number;
  over115Pct: number;
  
  // Recent form (last N matches)
  recentMatches: {
    date: string;
    opponent: string;
    isHome: boolean;
    cornersFor: number;
    cornersAgainst: number;
    totalCorners: number;
    result: 'W' | 'D' | 'L';
  }[];
}

// Head to head statistics
export interface H2HStats {
  team1: string;
  team2: string;
  matches: {
    date: string;
    homeTeam: string;
    awayTeam: string;
    homeCorners: number;
    awayCorners: number;
    totalCorners: number;
    homeGoals: number;
    awayGoals: number;
  }[];
  avgTotalCorners: number;
  avgTeam1Corners: number;
  avgTeam2Corners: number;
}

// API response types
export interface LeagueStatsResponse {
  league: LeagueConfig;
  teams: TeamCornerStats[];
  lastUpdated: string;
  matchesAnalyzed: number;
}

// H2H response type
export interface H2HResponse {
  team1: string;
  team2: string;
  league: LeagueConfig;
  matches: {
    date: string;
    homeTeam: string;
    awayTeam: string;
    homeCorners: number;
    awayCorners: number;
    totalCorners: number;
    homeGoals: number;
    awayGoals: number;
    result: 'H' | 'D' | 'A';
  }[];
  stats: {
    totalMatches: number;
    avgTotalCorners: number;
    avgTeam1Corners: number;
    avgTeam2Corners: number;
    over85Pct: number;
    over95Pct: number;
    over105Pct: number;
    team1Wins: number;
    team2Wins: number;
    draws: number;
  };
}
