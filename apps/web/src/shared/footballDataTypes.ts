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
  
  // Stats by match state (winning/drawing/losing)
  // Home games by match state
  homeGamesWinning: number;
  homeGamesDrawing: number;
  homeGamesLosing: number;
  avgCornersHomeWinning: number;
  avgCornersHomeDrawing: number;
  avgCornersHomeLosing: number;
  
  // Away games by match state
  awayGamesWinning: number;
  awayGamesDrawing: number;
  awayGamesLosing: number;
  avgCornersAwayWinning: number;
  avgCornersAwayDrawing: number;
  avgCornersAwayLosing: number;
  
  // Overall by match state
  gamesWinning: number;
  gamesDrawing: number;
  gamesLosing: number;
  avgCornersWinning: number;
  avgCornersDrawing: number;
  avgCornersLosing: number;
  
  // Half-time corner stats (from Sofascore)
  avgCorners1stHalf?: number;
  avgCorners2ndHalf?: number;
  avgCornersFor1stHalf?: number;
  avgCornersFor2ndHalf?: number;
  avgCornersAgainst1stHalf?: number;
  avgCornersAgainst2ndHalf?: number;
  
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
    // Card stats
    homeYellow?: number;
    awayYellow?: number;
    homeRed?: number;
    awayRed?: number;
    referee?: string;
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

// Team card statistics
export interface TeamCardStats {
  team: string;
  league: string;
  leagueId: string;
  
  // General stats
  gamesPlayed: number;
  totalYellowCards: number;
  totalRedCards: number;
  avgYellowPerMatch: number;
  avgRedPerMatch: number;
  avgCardsPerMatch: number;
  
  // Home/Away breakdown
  homeGames: number;
  awayGames: number;
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
  avgYellowHome: number;
  avgYellowAway: number;
  
  // Cards by match state
  cardsWinning: { yellow: number; red: number; matches: number };
  cardsDrawing: { yellow: number; red: number; matches: number };
  cardsLosing: { yellow: number; red: number; matches: number };
  avgCardsWinning: number;
  avgCardsDrawing: number;
  avgCardsLosing: number;
  
  // Recent matches with cards
  recentMatches: {
    date: string;
    opponent: string;
    isHome: boolean;
    yellowCards: number;
    redCards: number;
    totalCards: number;
    result: 'W' | 'D' | 'L';
    referee?: string;
  }[];
}

// Referee statistics from matches
export interface RefereeStats {
  name: string;
  league: string;
  matches: number;
  totalYellowCards: number;
  totalRedCards: number;
  avgYellowPerMatch: number;
  avgRedPerMatch: number;
  avgCardsPerMatch: number;
  recentMatches: {
    date: string;
    homeTeam: string;
    awayTeam: string;
    yellowCards: number;
    redCards: number;
  }[];
}

// Card statistics response
export interface CardStatsResponse {
  league: LeagueConfig;
  teams: TeamCardStats[];
  referees: RefereeStats[];
  lastUpdated: string;
  matchesAnalyzed: number;
}

// Shot statistics per team
export interface TeamShotStats {
  team: string;
  league: string;
  leagueId: string;
  
  // General stats
  gamesPlayed: number;
  totalShots: number;
  totalShotsAgainst: number;
  totalShotsOnTarget: number;
  totalShotsOnTargetAgainst: number;
  
  // Averages
  avgShots: number;
  avgShotsAgainst: number;
  avgShotsOnTarget: number;
  avgShotsOnTargetAgainst: number;
  avgTotalShots: number;
  avgTotalShotsOnTarget: number;
  
  // Home/Away breakdown
  homeGames: number;
  awayGames: number;
  avgShotsHome: number;
  avgShotsAway: number;
  avgShotsOnTargetHome: number;
  avgShotsOnTargetAway: number;
  
  // Accuracy
  shotAccuracy: number;  // % of shots on target
  shotAccuracyHome: number;
  shotAccuracyAway: number;
  
  // Recent form
  recentMatches: {
    date: string;
    opponent: string;
    isHome: boolean;
    shots: number;
    shotsAgainst: number;
    shotsOnTarget: number;
    shotsOnTargetAgainst: number;
    result: 'W' | 'D' | 'L';
  }[];
}

// Shot statistics response
export interface ShotStatsResponse {
  league: LeagueConfig;
  teams: TeamShotStats[];
  lastUpdated: string;
  matchesAnalyzed: number;
}
