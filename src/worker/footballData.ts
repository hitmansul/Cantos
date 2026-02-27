/**
 * Football-Data.co.uk integration
 * Fetches and parses CSV data for corner statistics
 */

import type { 
  FootballDataMatch, 
  LeagueConfig, 
  TeamCornerStats, 
  LeagueStatsResponse,
  H2HResponse
} from "../shared/footballDataTypes";

// Available leagues with corner statistics
// Note: Football-Data.co.uk does NOT have UEFA Champions League or Europa League data
// Only domestic league competitions are available
export const LEAGUES: LeagueConfig[] = [
  // England
  { id: "E0", name: "Premier League", country: "Inglaterra", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/E0.csv", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "E1", name: "Championship", country: "Inglaterra", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/E1.csv", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "E2", name: "League One", country: "Inglaterra", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/E2.csv", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "E3", name: "League Two", country: "Inglaterra", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/E3.csv", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  
  // Spain
  { id: "SP1", name: "La Liga", country: "Espanha", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/SP1.csv", flag: "🇪🇸" },
  { id: "SP2", name: "Segunda División", country: "Espanha", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/SP2.csv", flag: "🇪🇸" },
  
  // Italy
  { id: "I1", name: "Serie A", country: "Itália", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/I1.csv", flag: "🇮🇹" },
  { id: "I2", name: "Serie B", country: "Itália", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/I2.csv", flag: "🇮🇹" },
  
  // Germany
  { id: "D1", name: "Bundesliga", country: "Alemanha", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/D1.csv", flag: "🇩🇪" },
  { id: "D2", name: "2. Bundesliga", country: "Alemanha", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/D2.csv", flag: "🇩🇪" },
  
  // France
  { id: "F1", name: "Ligue 1", country: "França", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/F1.csv", flag: "🇫🇷" },
  { id: "F2", name: "Ligue 2", country: "França", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/F2.csv", flag: "🇫🇷" },
  
  // Netherlands
  { id: "N1", name: "Eredivisie", country: "Holanda", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/N1.csv", flag: "🇳🇱" },
  
  // Belgium
  { id: "B1", name: "Jupiler Pro League", country: "Bélgica", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/B1.csv", flag: "🇧🇪" },
  
  // Portugal
  { id: "P1", name: "Primeira Liga", country: "Portugal", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/P1.csv", flag: "🇵🇹" },
  
  // Turkey
  { id: "T1", name: "Süper Lig", country: "Turquia", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/T1.csv", flag: "🇹🇷" },
  
  // Greece
  { id: "G1", name: "Super League", country: "Grécia", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/G1.csv", flag: "🇬🇷" },
  
  // Scotland (all divisions have corner data)
  { id: "SC0", name: "Premiership", country: "Escócia", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/SC0.csv", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { id: "SC1", name: "Championship", country: "Escócia", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/SC1.csv", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { id: "SC2", name: "League One", country: "Escócia", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/SC2.csv", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { id: "SC3", name: "League Two", country: "Escócia", csvUrl: "https://www.football-data.co.uk/mmz4281/2425/SC3.csv", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  
  // Note: Extra leagues (ARG, MEX, USA, JPN, CHN) removed - they don't have corner statistics
];

// Brazilian league (mock data - Corner-Stats integration placeholder)
export const BRAZILIAN_LEAGUE: LeagueConfig = {
  id: "BR1",
  name: "Brasileirão Série A",
  country: "Brasil",
  csvUrl: "", // Will use local data
  flag: "🇧🇷"
};

/**
 * Parse CSV text into match objects
 */
function parseCSV(csvText: string): FootballDataMatch[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const matches: FootballDataMatch[] = [];
  
  // Find column indices
  const cols = {
    div: headers.indexOf('Div'),
    date: headers.indexOf('Date'),
    time: headers.indexOf('Time'),
    homeTeam: headers.indexOf('HomeTeam'),
    awayTeam: headers.indexOf('AwayTeam'),
    ftHomeGoals: headers.indexOf('FTHG'),
    ftAwayGoals: headers.indexOf('FTAG'),
    ftResult: headers.indexOf('FTR'),
    htHomeGoals: headers.indexOf('HTHG'),
    htAwayGoals: headers.indexOf('HTAG'),
    htResult: headers.indexOf('HTR'),
    homeShots: headers.indexOf('HS'),
    awayShots: headers.indexOf('AS'),
    homeShotsOnTarget: headers.indexOf('HST'),
    awayShotsOnTarget: headers.indexOf('AST'),
    homeCorners: headers.indexOf('HC'),
    awayCorners: headers.indexOf('AC'),
    homeFouls: headers.indexOf('HF'),
    awayFouls: headers.indexOf('AF'),
    homeYellow: headers.indexOf('HY'),
    awayYellow: headers.indexOf('AY'),
    homeRed: headers.indexOf('HR'),
    awayRed: headers.indexOf('AR'),
  };
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 10) continue;
    
    const homeCorners = parseInt(values[cols.homeCorners]) || 0;
    const awayCorners = parseInt(values[cols.awayCorners]) || 0;
    
    // Skip matches without corner data
    if (cols.homeCorners === -1 || (homeCorners === 0 && awayCorners === 0)) {
      continue;
    }
    
    matches.push({
      div: values[cols.div] || '',
      date: values[cols.date] || '',
      time: cols.time >= 0 ? values[cols.time] : undefined,
      homeTeam: values[cols.homeTeam] || '',
      awayTeam: values[cols.awayTeam] || '',
      ftHomeGoals: parseInt(values[cols.ftHomeGoals]) || 0,
      ftAwayGoals: parseInt(values[cols.ftAwayGoals]) || 0,
      ftResult: (values[cols.ftResult] || 'D') as 'H' | 'D' | 'A',
      htHomeGoals: cols.htHomeGoals >= 0 ? parseInt(values[cols.htHomeGoals]) || 0 : undefined,
      htAwayGoals: cols.htAwayGoals >= 0 ? parseInt(values[cols.htAwayGoals]) || 0 : undefined,
      htResult: cols.htResult >= 0 ? (values[cols.htResult] as 'H' | 'D' | 'A') : undefined,
      homeShots: cols.homeShots >= 0 ? parseInt(values[cols.homeShots]) || 0 : undefined,
      awayShots: cols.awayShots >= 0 ? parseInt(values[cols.awayShots]) || 0 : undefined,
      homeShotsOnTarget: cols.homeShotsOnTarget >= 0 ? parseInt(values[cols.homeShotsOnTarget]) || 0 : undefined,
      awayShotsOnTarget: cols.awayShotsOnTarget >= 0 ? parseInt(values[cols.awayShotsOnTarget]) || 0 : undefined,
      homeCorners,
      awayCorners,
      homeFouls: cols.homeFouls >= 0 ? parseInt(values[cols.homeFouls]) || 0 : undefined,
      awayFouls: cols.awayFouls >= 0 ? parseInt(values[cols.awayFouls]) || 0 : undefined,
      homeYellow: cols.homeYellow >= 0 ? parseInt(values[cols.homeYellow]) || 0 : undefined,
      awayYellow: cols.awayYellow >= 0 ? parseInt(values[cols.awayYellow]) || 0 : undefined,
      homeRed: cols.homeRed >= 0 ? parseInt(values[cols.homeRed]) || 0 : undefined,
      awayRed: cols.awayRed >= 0 ? parseInt(values[cols.awayRed]) || 0 : undefined,
    });
  }
  
  return matches;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  
  return values;
}

/**
 * Calculate team statistics from match data
 */
function calculateTeamStats(
  matches: FootballDataMatch[], 
  league: LeagueConfig
): TeamCornerStats[] {
  const teamData: Map<string, {
    homeMatches: FootballDataMatch[];
    awayMatches: FootballDataMatch[];
  }> = new Map();
  
  // Group matches by team
  for (const match of matches) {
    if (!teamData.has(match.homeTeam)) {
      teamData.set(match.homeTeam, { homeMatches: [], awayMatches: [] });
    }
    if (!teamData.has(match.awayTeam)) {
      teamData.set(match.awayTeam, { homeMatches: [], awayMatches: [] });
    }
    
    teamData.get(match.homeTeam)!.homeMatches.push(match);
    teamData.get(match.awayTeam)!.awayMatches.push(match);
  }
  
  // Calculate stats for each team
  const stats: TeamCornerStats[] = [];
  
  for (const [team, data] of teamData) {
    const allMatches = [...data.homeMatches, ...data.awayMatches];
    if (allMatches.length === 0) continue;
    
    // Sort by date (most recent first)
    allMatches.sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Calculate totals
    let totalCornersFor = 0;
    let totalCornersAgainst = 0;
    let homeCornersFor = 0;
    let homeCornersAgainst = 0;
    let awayCornersFor = 0;
    let awayCornersAgainst = 0;
    
    // Over/under counters
    let over85 = 0, over95 = 0, over105 = 0, over115 = 0;
    
    // Process home matches
    for (const match of data.homeMatches) {
      totalCornersFor += match.homeCorners;
      totalCornersAgainst += match.awayCorners;
      homeCornersFor += match.homeCorners;
      homeCornersAgainst += match.awayCorners;
      
      const total = match.homeCorners + match.awayCorners;
      if (total > 8.5) over85++;
      if (total > 9.5) over95++;
      if (total > 10.5) over105++;
      if (total > 11.5) over115++;
    }
    
    // Process away matches
    for (const match of data.awayMatches) {
      totalCornersFor += match.awayCorners;
      totalCornersAgainst += match.homeCorners;
      awayCornersFor += match.awayCorners;
      awayCornersAgainst += match.homeCorners;
      
      const total = match.homeCorners + match.awayCorners;
      if (total > 8.5) over85++;
      if (total > 9.5) over95++;
      if (total > 10.5) over105++;
      if (total > 11.5) over115++;
    }
    
    const gamesPlayed = allMatches.length;
    const homeGames = data.homeMatches.length;
    const awayGames = data.awayMatches.length;
    
    // Build recent matches list
    const recentMatches = allMatches.slice(0, 10).map(match => {
      const isHome = match.homeTeam === team;
      const cornersFor = isHome ? match.homeCorners : match.awayCorners;
      const cornersAgainst = isHome ? match.awayCorners : match.homeCorners;
      const goalsFor = isHome ? match.ftHomeGoals : match.ftAwayGoals;
      const goalsAgainst = isHome ? match.ftAwayGoals : match.ftHomeGoals;
      
      let result: 'W' | 'D' | 'L' = 'D';
      if (goalsFor > goalsAgainst) result = 'W';
      else if (goalsFor < goalsAgainst) result = 'L';
      
      return {
        date: match.date,
        opponent: isHome ? match.awayTeam : match.homeTeam,
        isHome,
        cornersFor,
        cornersAgainst,
        totalCorners: match.homeCorners + match.awayCorners,
        result,
      };
    });
    
    stats.push({
      team,
      league: league.name,
      leagueId: league.id,
      country: league.country,
      gamesPlayed,
      totalCornersFor,
      totalCornersAgainst,
      avgCornersFor: round(totalCornersFor / gamesPlayed),
      avgCornersAgainst: round(totalCornersAgainst / gamesPlayed),
      avgTotalCorners: round((totalCornersFor + totalCornersAgainst) / gamesPlayed),
      homeGames,
      awayGames,
      homeCornersFor,
      homeCornersAgainst,
      awayCornersFor,
      awayCornersAgainst,
      avgCornersHome: homeGames > 0 ? round(homeCornersFor / homeGames) : 0,
      avgCornersAway: awayGames > 0 ? round(awayCornersFor / awayGames) : 0,
      over85Pct: round((over85 / gamesPlayed) * 100),
      over95Pct: round((over95 / gamesPlayed) * 100),
      over105Pct: round((over105 / gamesPlayed) * 100),
      over115Pct: round((over115 / gamesPlayed) * 100),
      recentMatches,
    });
  }
  
  // Sort by average corners for (descending)
  stats.sort((a, b) => b.avgCornersFor - a.avgCornersFor);
  
  return stats;
}

/**
 * Parse date string (DD/MM/YYYY) to Date object
 */
function parseDate(dateStr: string): Date {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const year = parseInt(parts[2]);
    // Handle 2-digit years
    const fullYear = year < 100 ? 2000 + year : year;
    return new Date(fullYear, month, day);
  }
  return new Date(dateStr);
}

/**
 * Round to 1 decimal place
 */
function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Fetch and process league data
 */
export async function fetchLeagueStats(leagueId: string): Promise<LeagueStatsResponse | null> {
  const league = LEAGUES.find(l => l.id === leagueId);
  if (!league) return null;
  
  try {
    const response = await fetch(league.csvUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status}`);
    }
    
    const csvText = await response.text();
    const matches = parseCSV(csvText);
    const teams = calculateTeamStats(matches, league);
    
    return {
      league,
      teams,
      lastUpdated: new Date().toISOString(),
      matchesAnalyzed: matches.length,
    };
  } catch (error) {
    console.error(`Error fetching league ${leagueId}:`, error);
    return null;
  }
}

/**
 * Get all available leagues
 */
export function getLeagues(): LeagueConfig[] {
  return [BRAZILIAN_LEAGUE, ...LEAGUES];
}

/**
 * Fetch head-to-head statistics between two teams
 */
export async function fetchH2HStats(
  leagueId: string, 
  team1: string, 
  team2: string
): Promise<H2HResponse | null> {
  const league = LEAGUES.find(l => l.id === leagueId);
  if (!league) return null;
  
  try {
    const response = await fetch(league.csvUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status}`);
    }
    
    const csvText = await response.text();
    const allMatches = parseCSVForH2H(csvText);
    
    // Find matches between the two teams
    const h2hMatches = allMatches.filter(m => 
      (m.homeTeam.toLowerCase() === team1.toLowerCase() && m.awayTeam.toLowerCase() === team2.toLowerCase()) ||
      (m.homeTeam.toLowerCase() === team2.toLowerCase() && m.awayTeam.toLowerCase() === team1.toLowerCase())
    );
    
    if (h2hMatches.length === 0) {
      return {
        team1,
        team2,
        league,
        matches: [],
        stats: {
          totalMatches: 0,
          avgTotalCorners: 0,
          avgTeam1Corners: 0,
          avgTeam2Corners: 0,
          over85Pct: 0,
          over95Pct: 0,
          over105Pct: 0,
          team1Wins: 0,
          team2Wins: 0,
          draws: 0,
        }
      };
    }
    
    // Sort by date (most recent first)
    h2hMatches.sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Calculate statistics
    let team1Corners = 0;
    let team2Corners = 0;
    let over85 = 0, over95 = 0, over105 = 0;
    let team1Wins = 0, team2Wins = 0, draws = 0;
    
    const formattedMatches = h2hMatches.map(m => {
      const totalCorners = m.homeCorners + m.awayCorners;
      const isTeam1Home = m.homeTeam.toLowerCase() === team1.toLowerCase();
      
      // Track corners for each team
      if (isTeam1Home) {
        team1Corners += m.homeCorners;
        team2Corners += m.awayCorners;
      } else {
        team1Corners += m.awayCorners;
        team2Corners += m.homeCorners;
      }
      
      // Track over/under
      if (totalCorners > 8.5) over85++;
      if (totalCorners > 9.5) over95++;
      if (totalCorners > 10.5) over105++;
      
      // Track wins
      if (m.ftResult === 'D') {
        draws++;
      } else if ((m.ftResult === 'H' && isTeam1Home) || (m.ftResult === 'A' && !isTeam1Home)) {
        team1Wins++;
      } else {
        team2Wins++;
      }
      
      return {
        date: m.date,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        homeCorners: m.homeCorners,
        awayCorners: m.awayCorners,
        totalCorners,
        homeGoals: m.ftHomeGoals,
        awayGoals: m.ftAwayGoals,
        result: m.ftResult,
      };
    });
    
    const totalMatches = h2hMatches.length;
    const totalCorners = h2hMatches.reduce((sum, m) => sum + m.homeCorners + m.awayCorners, 0);
    
    return {
      team1,
      team2,
      league,
      matches: formattedMatches,
      stats: {
        totalMatches,
        avgTotalCorners: round(totalCorners / totalMatches),
        avgTeam1Corners: round(team1Corners / totalMatches),
        avgTeam2Corners: round(team2Corners / totalMatches),
        over85Pct: round((over85 / totalMatches) * 100),
        over95Pct: round((over95 / totalMatches) * 100),
        over105Pct: round((over105 / totalMatches) * 100),
        team1Wins,
        team2Wins,
        draws,
      }
    };
  } catch (error) {
    console.error(`Error fetching H2H for ${team1} vs ${team2}:`, error);
    return null;
  }
}

/**
 * Parse CSV for H2H (returns FootballDataMatch array)
 */
function parseCSVForH2H(csvText: string): FootballDataMatch[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const matches: FootballDataMatch[] = [];
  
  const cols = {
    div: headers.indexOf('Div'),
    date: headers.indexOf('Date'),
    homeTeam: headers.indexOf('HomeTeam'),
    awayTeam: headers.indexOf('AwayTeam'),
    ftHomeGoals: headers.indexOf('FTHG'),
    ftAwayGoals: headers.indexOf('FTAG'),
    ftResult: headers.indexOf('FTR'),
    homeCorners: headers.indexOf('HC'),
    awayCorners: headers.indexOf('AC'),
  };
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLineForH2H(lines[i]);
    if (values.length < 10) continue;
    
    const homeCorners = parseInt(values[cols.homeCorners]) || 0;
    const awayCorners = parseInt(values[cols.awayCorners]) || 0;
    
    if (cols.homeCorners === -1) continue;
    
    matches.push({
      div: values[cols.div] || '',
      date: values[cols.date] || '',
      homeTeam: values[cols.homeTeam] || '',
      awayTeam: values[cols.awayTeam] || '',
      ftHomeGoals: parseInt(values[cols.ftHomeGoals]) || 0,
      ftAwayGoals: parseInt(values[cols.ftAwayGoals]) || 0,
      ftResult: (values[cols.ftResult] || 'D') as 'H' | 'D' | 'A',
      homeCorners,
      awayCorners,
    });
  }
  
  return matches;
}

function parseCSVLineForH2H(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  
  return values;
}
