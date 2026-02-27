import Firecrawl from "@mendable/firecrawl-js";

// Corner-Stats.com URLs for Brazilian leagues
const CORNER_STATS_URLS = {
  brasileiraoA: "https://www.corner-stats.com/league/brazil-serie-a-2024",
  brasileiraoB: "https://www.corner-stats.com/league/brazil-serie-b-2024",
  copaBrasil: "https://www.corner-stats.com/league/brazil-copa-do-brasil-2024",
  paulistao: "https://www.corner-stats.com/league/brazil-paulista-a1-2024",
};

export interface ScrapedTeamStats {
  team: string;
  gamesPlayed: number;
  avgCornersFor: number;
  avgCornersAgainst: number;
  avgCornersTotal: number;
  over85Pct: number;
  over95Pct: number;
  over105Pct: number;
  homeAvgFor: number;
  homeAvgAgainst: number;
  awayAvgFor: number;
  awayAvgAgainst: number;
}

export interface ScrapedLeagueData {
  league: string;
  leagueId: string;
  season: string;
  teams: ScrapedTeamStats[];
  avgCornersPerMatch: number;
  lastUpdated: string;
}

// Initialize Firecrawl client
function getFirecrawl(apiKey: string) {
  return new Firecrawl({ apiKey });
}

// Scrape team statistics from Corner-Stats.com
export async function scrapeCornerStats(
  apiKey: string,
  leagueKey: keyof typeof CORNER_STATS_URLS = "brasileiraoA"
): Promise<ScrapedLeagueData | null> {
  const url = CORNER_STATS_URLS[leagueKey];
  
  if (!url) {
    console.error(`Unknown league: ${leagueKey}`);
    return null;
  }

  try {
    const firecrawl = getFirecrawl(apiKey);
    
    const result = await firecrawl.scrape(url, {
      formats: [
        {
          type: "json",
          schema: {
            type: "object",
            properties: {
              leagueName: { type: "string" },
              season: { type: "string" },
              avgCornersPerMatch: { type: "number" },
              teams: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    team: { type: "string" },
                    gamesPlayed: { type: "number" },
                    avgCornersFor: { type: "number" },
                    avgCornersAgainst: { type: "number" },
                    avgCornersTotal: { type: "number" },
                    over85Pct: { type: "number" },
                    over95Pct: { type: "number" },
                    over105Pct: { type: "number" },
                    homeAvgFor: { type: "number" },
                    homeAvgAgainst: { type: "number" },
                    awayAvgFor: { type: "number" },
                    awayAvgAgainst: { type: "number" },
                  },
                },
              },
            },
          },
          prompt: `Extract corner statistics from this football league page. For each team, get:
- Team name
- Games played
- Average corners for (won by team)
- Average corners against (conceded by team)
- Average total corners per match
- Percentage of matches with over 8.5 corners
- Percentage of matches with over 9.5 corners  
- Percentage of matches with over 10.5 corners
- Home average corners for and against
- Away average corners for and against
Also extract the league name, season, and overall average corners per match.`,
        },
      ],
      waitFor: 3000, // Wait for dynamic content
      onlyMainContent: true,
    });

    if (!result.json) {
      console.error("No JSON data extracted");
      return null;
    }

    const data = result.json as any;
    
    return {
      league: data.leagueName || getLeagueName(leagueKey),
      leagueId: leagueKey,
      season: data.season || "2024",
      teams: (data.teams || []).map((t: any) => ({
        team: t.team || "",
        gamesPlayed: t.gamesPlayed || 0,
        avgCornersFor: t.avgCornersFor || 0,
        avgCornersAgainst: t.avgCornersAgainst || 0,
        avgCornersTotal: t.avgCornersTotal || 0,
        over85Pct: t.over85Pct || 0,
        over95Pct: t.over95Pct || 0,
        over105Pct: t.over105Pct || 0,
        homeAvgFor: t.homeAvgFor || 0,
        homeAvgAgainst: t.homeAvgAgainst || 0,
        awayAvgFor: t.awayAvgFor || 0,
        awayAvgAgainst: t.awayAvgAgainst || 0,
      })),
      avgCornersPerMatch: data.avgCornersPerMatch || 0,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error scraping Corner-Stats:", error);
    return null;
  }
}

// Scrape a specific team's detailed page
export async function scrapeTeamDetails(
  apiKey: string,
  teamSlug: string
): Promise<any | null> {
  const url = `https://www.corner-stats.com/team/${teamSlug}`;
  
  try {
    const firecrawl = getFirecrawl(apiKey);
    
    const result = await firecrawl.scrape(url, {
      formats: [
        {
          type: "json",
          schema: {
            type: "object",
            properties: {
              teamName: { type: "string" },
              league: { type: "string" },
              overallStats: {
                type: "object",
                properties: {
                  gamesPlayed: { type: "number" },
                  avgCornersFor: { type: "number" },
                  avgCornersAgainst: { type: "number" },
                  avgCornersTotal: { type: "number" },
                },
              },
              homeStats: {
                type: "object",
                properties: {
                  gamesPlayed: { type: "number" },
                  avgCornersFor: { type: "number" },
                  avgCornersAgainst: { type: "number" },
                },
              },
              awayStats: {
                type: "object",
                properties: {
                  gamesPlayed: { type: "number" },
                  avgCornersFor: { type: "number" },
                  avgCornersAgainst: { type: "number" },
                },
              },
              overUnderStats: {
                type: "object",
                properties: {
                  over75Pct: { type: "number" },
                  over85Pct: { type: "number" },
                  over95Pct: { type: "number" },
                  over105Pct: { type: "number" },
                  over115Pct: { type: "number" },
                },
              },
              recentMatches: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    date: { type: "string" },
                    homeTeam: { type: "string" },
                    awayTeam: { type: "string" },
                    homeCorners: { type: "number" },
                    awayCorners: { type: "number" },
                    totalCorners: { type: "number" },
                  },
                },
              },
              firstHalfStats: {
                type: "object",
                properties: {
                  avgCornersFor: { type: "number" },
                  avgCornersAgainst: { type: "number" },
                },
              },
              secondHalfStats: {
                type: "object",
                properties: {
                  avgCornersFor: { type: "number" },
                  avgCornersAgainst: { type: "number" },
                },
              },
            },
          },
          prompt: `Extract detailed corner statistics for this football team. Include:
- Team name and league
- Overall corner stats (games, avg for/against/total)
- Home and away corner stats separately
- Over/under percentages for different thresholds (7.5, 8.5, 9.5, 10.5, 11.5)
- Recent matches with corner counts
- First half and second half corner averages`,
        },
      ],
      waitFor: 3000,
      onlyMainContent: true,
    });

    if (!result.json) {
      return null;
    }

    return {
      ...result.json,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error scraping team details:", error);
    return null;
  }
}

// Scrape upcoming matches with corner predictions
export async function scrapeUpcomingMatches(
  apiKey: string,
  leagueKey: keyof typeof CORNER_STATS_URLS = "brasileiraoA"
): Promise<any[] | null> {
  // Corner-Stats has predictions on specific match pages
  const baseUrl = CORNER_STATS_URLS[leagueKey];
  
  try {
    const firecrawl = getFirecrawl(apiKey);
    
    // First, get the league page to find upcoming matches
    const result = await firecrawl.scrape(baseUrl, {
      formats: [
        {
          type: "json",
          schema: {
            type: "object",
            properties: {
              upcomingMatches: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    date: { type: "string" },
                    time: { type: "string" },
                    homeTeam: { type: "string" },
                    awayTeam: { type: "string" },
                    predictedCorners: { type: "number" },
                    over85Prediction: { type: "string" },
                    over95Prediction: { type: "string" },
                    over105Prediction: { type: "string" },
                  },
                },
              },
            },
          },
          prompt: `Extract upcoming match predictions from this page. For each upcoming match, get:
- Date and time
- Home and away team names
- Predicted total corners
- Over/under predictions (8.5, 9.5, 10.5) with percentages or recommendations`,
        },
      ],
      waitFor: 3000,
      onlyMainContent: true,
    });

    if (!result.json) {
      return null;
    }

    const data = result.json as any;
    return data.upcomingMatches || [];
  } catch (error) {
    console.error("Error scraping upcoming matches:", error);
    return null;
  }
}

function getLeagueName(key: string): string {
  const names: Record<string, string> = {
    brasileiraoA: "Brasileirão Série A",
    brasileiraoB: "Brasileirão Série B",
    copaBrasil: "Copa do Brasil",
    paulistao: "Campeonato Paulista",
  };
  return names[key] || key;
}

// Get available leagues for scraping
export function getAvailableScrapingLeagues() {
  return Object.entries(CORNER_STATS_URLS).map(([key, url]) => ({
    id: key,
    name: getLeagueName(key),
    url,
  }));
}
