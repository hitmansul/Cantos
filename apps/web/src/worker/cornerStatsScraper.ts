// Type definitions for the corner stats scraper
// These types are used by the useCornerStatsScraper hook

export interface ScrapedTeamStats {
  team: string;
  avgCornersFor: number;
  avgCornersAgainst: number;
  avgTotalCorners: number;
  gamesPlayed: number;
  homeAvgFor?: number;
  homeAvgAgainst?: number;
  awayAvgFor?: number;
  awayAvgAgainst?: number;
  over85Pct?: number;
  over95Pct?: number;
  over105Pct?: number;
  over115Pct?: number;
  recentMatches?: Array<{
    date: string;
    opponent: string;
    isHome: boolean;
    cornersFor: number;
    cornersAgainst: number;
    result?: string;
  }>;
}

export interface ScrapedLeagueData {
  league: string;
  leagueName: string;
  teams: ScrapedTeamStats[];
  lastUpdated: string;
  source?: string;
  content?: string;
}

export type ScrapingLeagueKey = 'brasileirao_a' | 'brasileirao_b' | 'copa_do_brasil';

export const AVAILABLE_SCRAPING_LEAGUES: Record<ScrapingLeagueKey, { name: string; url: string }> =
  {
    brasileirao_a: {
      name: 'Brasileirão Série A',
      url: 'https://www.corner-stats.com/brazil/serie-a',
    },
    brasileirao_b: {
      name: 'Brasileirão Série B',
      url: 'https://www.corner-stats.com/brazil/serie-b',
    },
    copa_do_brasil: {
      name: 'Copa do Brasil',
      url: 'https://www.corner-stats.com/brazil/copa-do-brasil',
    },
  };
