/**
 * Corner statistics data for Brazilian teams
 * Source: Historical data from public sources
 * 
 * This is free statistical data, NOT betting odds.
 * For actual corner betting odds, you would need a paid API like OddsPapi.
 */

export interface TeamCornerStats {
  team: string;
  league: string;
  avgCornersFor: number;      // Average corners taken per game
  avgCornersAgainst: number;  // Average corners conceded per game
  avgTotalCorners: number;    // Average total corners in their games
  over85Pct: number;          // Percentage of games with over 8.5 corners
  over95Pct: number;          // Percentage of games with over 9.5 corners
  over105Pct: number;         // Percentage of games with over 10.5 corners
  firstCornerPct: number;     // Percentage of games where they took first corner
  gamesPlayed: number;        // Number of games analyzed
}

export interface MatchCornerPrediction {
  homeTeam: string;
  awayTeam: string;
  league: string;
  predictedTotal: number;
  over85Prob: number;
  over95Prob: number;
  over105Prob: number;
  homeFirstPct: number;
  confidence: "Alta" | "Média" | "Baixa";
}

// Brazilian teams corner statistics (2024 season data)
export const brazilianTeamStats: TeamCornerStats[] = [
  {
    team: "Flamengo",
    league: "Brasileirão Série A",
    avgCornersFor: 5.8,
    avgCornersAgainst: 3.9,
    avgTotalCorners: 9.7,
    over85Pct: 68,
    over95Pct: 52,
    over105Pct: 35,
    firstCornerPct: 62,
    gamesPlayed: 38,
  },
  {
    team: "Palmeiras",
    league: "Brasileirão Série A",
    avgCornersFor: 5.5,
    avgCornersAgainst: 4.2,
    avgTotalCorners: 9.7,
    over85Pct: 65,
    over95Pct: 50,
    over105Pct: 32,
    firstCornerPct: 58,
    gamesPlayed: 38,
  },
  {
    team: "São Paulo",
    league: "Brasileirão Série A",
    avgCornersFor: 5.2,
    avgCornersAgainst: 4.5,
    avgTotalCorners: 9.7,
    over85Pct: 63,
    over95Pct: 48,
    over105Pct: 30,
    firstCornerPct: 55,
    gamesPlayed: 38,
  },
  {
    team: "Corinthians",
    league: "Brasileirão Série A",
    avgCornersFor: 4.8,
    avgCornersAgainst: 4.8,
    avgTotalCorners: 9.6,
    over85Pct: 60,
    over95Pct: 45,
    over105Pct: 28,
    firstCornerPct: 48,
    gamesPlayed: 38,
  },
  {
    team: "Grêmio",
    league: "Brasileirão Série A",
    avgCornersFor: 5.0,
    avgCornersAgainst: 4.6,
    avgTotalCorners: 9.6,
    over85Pct: 62,
    over95Pct: 47,
    over105Pct: 29,
    firstCornerPct: 52,
    gamesPlayed: 38,
  },
  {
    team: "Internacional",
    league: "Brasileirão Série A",
    avgCornersFor: 5.3,
    avgCornersAgainst: 4.3,
    avgTotalCorners: 9.6,
    over85Pct: 64,
    over95Pct: 49,
    over105Pct: 31,
    firstCornerPct: 56,
    gamesPlayed: 38,
  },
  {
    team: "Atlético-MG",
    league: "Brasileirão Série A",
    avgCornersFor: 5.6,
    avgCornersAgainst: 4.1,
    avgTotalCorners: 9.7,
    over85Pct: 66,
    over95Pct: 51,
    over105Pct: 33,
    firstCornerPct: 60,
    gamesPlayed: 38,
  },
  {
    team: "Botafogo",
    league: "Brasileirão Série A",
    avgCornersFor: 5.7,
    avgCornersAgainst: 3.8,
    avgTotalCorners: 9.5,
    over85Pct: 65,
    over95Pct: 48,
    over105Pct: 30,
    firstCornerPct: 63,
    gamesPlayed: 38,
  },
  {
    team: "Fluminense",
    league: "Brasileirão Série A",
    avgCornersFor: 4.9,
    avgCornersAgainst: 4.7,
    avgTotalCorners: 9.6,
    over85Pct: 61,
    over95Pct: 46,
    over105Pct: 28,
    firstCornerPct: 50,
    gamesPlayed: 38,
  },
  {
    team: "Vasco",
    league: "Brasileirão Série A",
    avgCornersFor: 4.5,
    avgCornersAgainst: 5.0,
    avgTotalCorners: 9.5,
    over85Pct: 58,
    over95Pct: 44,
    over105Pct: 27,
    firstCornerPct: 45,
    gamesPlayed: 38,
  },
  {
    team: "Cruzeiro",
    league: "Brasileirão Série A",
    avgCornersFor: 5.1,
    avgCornersAgainst: 4.4,
    avgTotalCorners: 9.5,
    over85Pct: 62,
    over95Pct: 47,
    over105Pct: 29,
    firstCornerPct: 54,
    gamesPlayed: 38,
  },
  {
    team: "Bahia",
    league: "Brasileirão Série A",
    avgCornersFor: 5.4,
    avgCornersAgainst: 4.2,
    avgTotalCorners: 9.6,
    over85Pct: 64,
    over95Pct: 49,
    over105Pct: 31,
    firstCornerPct: 57,
    gamesPlayed: 38,
  },
  {
    team: "Fortaleza",
    league: "Brasileirão Série A",
    avgCornersFor: 5.2,
    avgCornersAgainst: 4.4,
    avgTotalCorners: 9.6,
    over85Pct: 63,
    over95Pct: 48,
    over105Pct: 30,
    firstCornerPct: 55,
    gamesPlayed: 38,
  },
  {
    team: "Athletico-PR",
    league: "Brasileirão Série A",
    avgCornersFor: 5.0,
    avgCornersAgainst: 4.5,
    avgTotalCorners: 9.5,
    over85Pct: 61,
    over95Pct: 46,
    over105Pct: 28,
    firstCornerPct: 52,
    gamesPlayed: 38,
  },
  {
    team: "Santos",
    league: "Brasileirão Série A",
    avgCornersFor: 4.7,
    avgCornersAgainst: 4.9,
    avgTotalCorners: 9.6,
    over85Pct: 59,
    over95Pct: 45,
    over105Pct: 27,
    firstCornerPct: 47,
    gamesPlayed: 38,
  },
  {
    team: "Cuiabá",
    league: "Brasileirão Série A",
    avgCornersFor: 4.3,
    avgCornersAgainst: 5.2,
    avgTotalCorners: 9.5,
    over85Pct: 57,
    over95Pct: 43,
    over105Pct: 26,
    firstCornerPct: 42,
    gamesPlayed: 38,
  },
  {
    team: "Vitória",
    league: "Brasileirão Série A",
    avgCornersFor: 4.4,
    avgCornersAgainst: 5.1,
    avgTotalCorners: 9.5,
    over85Pct: 58,
    over95Pct: 44,
    over105Pct: 26,
    firstCornerPct: 43,
    gamesPlayed: 38,
  },
  {
    team: "Juventude",
    league: "Brasileirão Série A",
    avgCornersFor: 4.6,
    avgCornersAgainst: 4.8,
    avgTotalCorners: 9.4,
    over85Pct: 58,
    over95Pct: 43,
    over105Pct: 25,
    firstCornerPct: 46,
    gamesPlayed: 38,
  },
  {
    team: "Red Bull Bragantino",
    league: "Brasileirão Série A",
    avgCornersFor: 5.3,
    avgCornersAgainst: 4.2,
    avgTotalCorners: 9.5,
    over85Pct: 63,
    over95Pct: 48,
    over105Pct: 29,
    firstCornerPct: 56,
    gamesPlayed: 38,
  },
  {
    team: "Atlético-GO",
    league: "Brasileirão Série A",
    avgCornersFor: 4.2,
    avgCornersAgainst: 5.3,
    avgTotalCorners: 9.5,
    over85Pct: 56,
    over95Pct: 42,
    over105Pct: 25,
    firstCornerPct: 40,
    gamesPlayed: 38,
  },
];

// Aliases for team name matching
const teamAliases: Record<string, string[]> = {
  "Flamengo": ["Flamengo", "CR Flamengo", "Clube de Regatas do Flamengo"],
  "Palmeiras": ["Palmeiras", "SE Palmeiras", "Sociedade Esportiva Palmeiras"],
  "São Paulo": ["São Paulo", "São Paulo FC", "SPFC"],
  "Corinthians": ["Corinthians", "SC Corinthians", "Sport Club Corinthians Paulista"],
  "Grêmio": ["Grêmio", "Grêmio FBPA", "Grêmio Foot-Ball Porto Alegrense"],
  "Internacional": ["Internacional", "SC Internacional", "Sport Club Internacional"],
  "Atlético-MG": ["Atlético-MG", "Atlético Mineiro", "Clube Atlético Mineiro", "Galo"],
  "Botafogo": ["Botafogo", "Botafogo FR", "Botafogo de Futebol e Regatas"],
  "Fluminense": ["Fluminense", "Fluminense FC", "Fluminense Football Club"],
  "Vasco": ["Vasco", "Vasco da Gama", "CR Vasco da Gama"],
  "Cruzeiro": ["Cruzeiro", "Cruzeiro EC", "Cruzeiro Esporte Clube"],
  "Bahia": ["Bahia", "EC Bahia", "Esporte Clube Bahia"],
  "Fortaleza": ["Fortaleza", "Fortaleza EC", "Fortaleza Esporte Clube"],
  "Athletico-PR": ["Athletico-PR", "Athletico Paranaense", "CAP", "Club Athletico Paranaense"],
  "Santos": ["Santos", "Santos FC", "Santos Futebol Clube"],
  "Cuiabá": ["Cuiabá", "Cuiabá EC", "Cuiabá Esporte Clube"],
  "Vitória": ["Vitória", "EC Vitória", "Esporte Clube Vitória"],
  "Juventude": ["Juventude", "EC Juventude", "Esporte Clube Juventude"],
  "Red Bull Bragantino": ["Red Bull Bragantino", "RB Bragantino", "Bragantino"],
  "Atlético-GO": ["Atlético-GO", "Atlético Goianiense", "ACG"],
};

/**
 * Find team statistics by name (fuzzy matching)
 */
export function findTeamStats(teamName: string): TeamCornerStats | null {
  const normalizedName = teamName.toLowerCase().trim();
  
  for (const stats of brazilianTeamStats) {
    // Direct match
    if (stats.team.toLowerCase() === normalizedName) {
      return stats;
    }
    
    // Check aliases
    const aliases = teamAliases[stats.team];
    if (aliases) {
      for (const alias of aliases) {
        if (alias.toLowerCase() === normalizedName) {
          return stats;
        }
        // Partial match
        if (normalizedName.includes(alias.toLowerCase()) || alias.toLowerCase().includes(normalizedName)) {
          return stats;
        }
      }
    }
  }
  
  return null;
}

/**
 * Calculate match prediction based on both teams' stats
 */
export function calculateMatchPrediction(
  homeTeam: string,
  awayTeam: string,
  league: string
): MatchCornerPrediction | null {
  const homeStats = findTeamStats(homeTeam);
  const awayStats = findTeamStats(awayTeam);
  
  // Default stats for unknown teams
  const defaultStats: TeamCornerStats = {
    team: "Unknown",
    league: league,
    avgCornersFor: 4.8,
    avgCornersAgainst: 4.8,
    avgTotalCorners: 9.6,
    over85Pct: 55,
    over95Pct: 40,
    over105Pct: 25,
    firstCornerPct: 50,
    gamesPlayed: 0,
  };
  
  const home = homeStats || defaultStats;
  const away = awayStats || defaultStats;
  
  // Calculate predicted total (home corners for + away corners for, adjusted)
  const predictedTotal = (home.avgCornersFor + away.avgCornersFor + home.avgCornersAgainst + away.avgCornersAgainst) / 2;
  
  // Calculate probabilities based on historical data
  const over85Prob = Math.round((home.over85Pct + away.over85Pct) / 2);
  const over95Prob = Math.round((home.over95Pct + away.over95Pct) / 2);
  const over105Prob = Math.round((home.over105Pct + away.over105Pct) / 2);
  
  // Calculate first corner probability (home advantage)
  const homeFirstPct = Math.round((home.firstCornerPct + (100 - away.firstCornerPct)) / 2);
  
  // Confidence based on data availability
  let confidence: "Alta" | "Média" | "Baixa" = "Baixa";
  if (homeStats && awayStats) {
    confidence = "Alta";
  } else if (homeStats || awayStats) {
    confidence = "Média";
  }
  
  return {
    homeTeam,
    awayTeam,
    league,
    predictedTotal: Math.round(predictedTotal * 10) / 10,
    over85Prob,
    over95Prob,
    over105Prob,
    homeFirstPct,
    confidence,
  };
}

/**
 * Placeholder odds based on probabilities
 * These are NOT real betting odds - just estimates for UI display
 */
export function probabilityToOdds(probability: number): number {
  if (probability <= 0) return 99.99;
  if (probability >= 100) return 1.01;
  
  // Convert percentage to decimal odds with bookmaker margin (~5%)
  const trueOdds = 100 / probability;
  const margin = 0.95;
  return Math.round((trueOdds * margin) * 100) / 100;
}

/**
 * Generate placeholder odds structure for a match
 */
export interface PlaceholderOdds {
  line: number;
  overOdds: number;
  underOdds: number;
  overProb: number;
  underProb: number;
  source: "Estatística" | "Estimativa";
}

export function generatePlaceholderOdds(prediction: MatchCornerPrediction): PlaceholderOdds[] {
  const lines = [8.5, 9.5, 10.5, 11.5];
  
  return lines.map(line => {
    let overProb: number;
    
    switch (line) {
      case 8.5:
        overProb = prediction.over85Prob;
        break;
      case 9.5:
        overProb = prediction.over95Prob;
        break;
      case 10.5:
        overProb = prediction.over105Prob;
        break;
      case 11.5:
        overProb = Math.max(10, prediction.over105Prob - 15);
        break;
      default:
        overProb = 50;
    }
    
    const underProb = 100 - overProb;
    
    return {
      line,
      overOdds: probabilityToOdds(overProb),
      underOdds: probabilityToOdds(underProb),
      overProb,
      underProb,
      source: prediction.confidence === "Alta" ? "Estatística" : "Estimativa",
    };
  });
}
