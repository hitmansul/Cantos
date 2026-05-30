/**
 * Fetches and parses CSV data from football-data.co.uk
 * CSV columns include: Div, Date, HomeTeam, AwayTeam, FTHG, FTAG, FTR,
 * HC (Home Corners), AC (Away Corners), HY, AY, HR, AR, HS, AS, HST, AST, Referee
 */

export interface LeagueConfig {
  id: string;
  name: string;
  country: string;
  csvUrl: string;
  flag: string;
}

export const LEAGUES: Record<string, LeagueConfig> = {
  E0: {
    id: 'E0',
    name: 'Premier League',
    country: 'England',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/E0.csv',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  },
  E1: {
    id: 'E1',
    name: 'Championship',
    country: 'England',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/E1.csv',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  },
  E2: {
    id: 'E2',
    name: 'League One',
    country: 'England',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/E2.csv',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  },
  E3: {
    id: 'E3',
    name: 'League Two',
    country: 'England',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/E3.csv',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  },
  EC: {
    id: 'EC',
    name: 'National League',
    country: 'England',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/EC.csv',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  },
  SP1: {
    id: 'SP1',
    name: 'La Liga',
    country: 'Spain',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/SP1.csv',
    flag: '🇪🇸',
  },
  SP2: {
    id: 'SP2',
    name: 'Segunda División',
    country: 'Spain',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/SP2.csv',
    flag: '🇪🇸',
  },
  I1: {
    id: 'I1',
    name: 'Serie A',
    country: 'Italy',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/I1.csv',
    flag: '🇮🇹',
  },
  I2: {
    id: 'I2',
    name: 'Serie B',
    country: 'Italy',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/I2.csv',
    flag: '🇮🇹',
  },
  D1: {
    id: 'D1',
    name: 'Bundesliga',
    country: 'Germany',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/D1.csv',
    flag: '🇩🇪',
  },
  D2: {
    id: 'D2',
    name: '2. Bundesliga',
    country: 'Germany',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/D2.csv',
    flag: '🇩🇪',
  },
  F1: {
    id: 'F1',
    name: 'Ligue 1',
    country: 'France',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/F1.csv',
    flag: '🇫🇷',
  },
  F2: {
    id: 'F2',
    name: 'Ligue 2',
    country: 'France',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/F2.csv',
    flag: '🇫🇷',
  },
  N1: {
    id: 'N1',
    name: 'Eredivisie',
    country: 'Netherlands',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/N1.csv',
    flag: '🇳🇱',
  },
  P1: {
    id: 'P1',
    name: 'Primeira Liga',
    country: 'Portugal',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/P1.csv',
    flag: '🇵🇹',
  },
  B1: {
    id: 'B1',
    name: 'Jupiler Pro League',
    country: 'Belgium',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/B1.csv',
    flag: '🇧🇪',
  },
  T1: {
    id: 'T1',
    name: 'Süper Lig',
    country: 'Turkey',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/T1.csv',
    flag: '🇹🇷',
  },
  G1: {
    id: 'G1',
    name: 'Super League',
    country: 'Greece',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/G1.csv',
    flag: '🇬🇷',
  },
  SC0: {
    id: 'SC0',
    name: 'Premiership',
    country: 'Scotland',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/SC0.csv',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  },
  SC1: {
    id: 'SC1',
    name: 'Championship',
    country: 'Scotland',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/SC1.csv',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  },
  SC2: {
    id: 'SC2',
    name: 'League One',
    country: 'Scotland',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/SC2.csv',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  },
  SC3: {
    id: 'SC3',
    name: 'League Two',
    country: 'Scotland',
    csvUrl: 'https://www.football-data.co.uk/mmz4281/2526/SC3.csv',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  },
};

export function getLeagues(): LeagueConfig[] {
  return Object.values(LEAGUES);
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text
    .trim()
    .split('\n')
    .filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    if (values.length < 3 || !values[2]) continue; // skip empty rows

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

export interface TeamCornerStats {
  team: string;
  league: string;
  leagueId: string;
  country: string;
  gamesPlayed: number;
  totalCornersFor: number;
  totalCornersAgainst: number;
  avgCornersFor: number;
  avgCornersAgainst: number;
  avgTotalCorners: number;
  homeGames: number;
  awayGames: number;
  homeCornersFor: number;
  homeCornersAgainst: number;
  awayCornersFor: number;
  awayCornersAgainst: number;
  avgCornersHome: number;
  avgCornersAway: number;
  // By match state
  gamesWinning: number;
  gamesDrawing: number;
  gamesLosing: number;
  avgCornersWinning: number;
  avgCornersDrawing: number;
  avgCornersLosing: number;
  homeGamesWinning: number;
  homeGamesDrawing: number;
  homeGamesLosing: number;
  avgCornersHomeWinning: number;
  avgCornersHomeDrawing: number;
  avgCornersHomeLosing: number;
  awayGamesWinning: number;
  awayGamesDrawing: number;
  awayGamesLosing: number;
  avgCornersAwayWinning: number;
  avgCornersAwayDrawing: number;
  avgCornersAwayLosing: number;
  // Over percentages
  over85Pct: number;
  over95Pct: number;
  over105Pct: number;
  over115Pct: number;
  // Recent form
  recentMatches: Array<{
    date: string;
    opponent: string;
    isHome: boolean;
    cornersFor: number;
    cornersAgainst: number;
    result: string;
  }>;
}

export async function fetchLeagueStats(
  leagueId: string
): Promise<{ teams: TeamCornerStats[]; matchesAnalyzed: number } | null> {
  const league = LEAGUES[leagueId];
  if (!league || !league.csvUrl) return null;

  try {
    const response = await fetch(league.csvUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.ok) return null;

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    if (rows.length === 0) return null;

    // Aggregate stats per team
    const teamData: Record<
      string,
      {
        homeMatches: Array<{ hc: number; ac: number; ftr: string }>;
        awayMatches: Array<{ hc: number; ac: number; ftr: string }>;
      }
    > = {};

    for (const row of rows) {
      const homeTeam = row['HomeTeam'] || row['Home Team'];
      const awayTeam = row['AwayTeam'] || row['Away Team'];
      const hc = parseInt(row['HC'] || '0') || 0;
      const ac = parseInt(row['AC'] || '0') || 0;
      const ftr = row['FTR'] || '';

      if (!homeTeam || !awayTeam || (!hc && !ac)) continue;

      if (!teamData[homeTeam]) teamData[homeTeam] = { homeMatches: [], awayMatches: [] };
      if (!teamData[awayTeam]) teamData[awayTeam] = { homeMatches: [], awayMatches: [] };

      teamData[homeTeam].homeMatches.push({ hc, ac, ftr });
      teamData[awayTeam].awayMatches.push({
        hc: ac,
        ac: hc,
        ftr: ftr === 'H' ? 'A' : ftr === 'A' ? 'H' : 'D',
      });
    }

    const teams: TeamCornerStats[] = Object.entries(teamData)
      .map(([team, data]) => {
        const allMatches = [
          ...data.homeMatches.map((m) => ({ ...m, isHome: true })),
          ...data.awayMatches.map((m) => ({ ...m, isHome: false })),
        ];

        const gamesPlayed = allMatches.length;
        if (gamesPlayed === 0) return null;

        const totalCornersFor = allMatches.reduce((s, m) => s + m.hc, 0);
        const totalCornersAgainst = allMatches.reduce((s, m) => s + m.ac, 0);

        const homeGames = data.homeMatches.length;
        const awayGames = data.awayMatches.length;
        const homeCornersFor = data.homeMatches.reduce((s, m) => s + m.hc, 0);
        const homeCornersAgainst = data.homeMatches.reduce((s, m) => s + m.ac, 0);
        const awayCornersFor = data.awayMatches.reduce((s, m) => s + m.hc, 0);
        const awayCornersAgainst = data.awayMatches.reduce((s, m) => s + m.ac, 0);

        // By match state (from team's perspective)
        const winning = allMatches.filter(
          (m) => (m.ftr === 'H' && m.isHome) || (m.ftr === 'A' && !m.isHome)
        );
        const drawing = allMatches.filter((m) => m.ftr === 'D');
        const losing = allMatches.filter(
          (m) => (m.ftr === 'A' && m.isHome) || (m.ftr === 'H' && !m.isHome)
        );

        const homeWinning = data.homeMatches.filter((m) => m.ftr === 'H');
        const homeDrawing = data.homeMatches.filter((m) => m.ftr === 'D');
        const homeLosing = data.homeMatches.filter((m) => m.ftr === 'A');
        const awayWinning = data.awayMatches.filter((m) => m.ftr === 'H');
        const awayDrawing = data.awayMatches.filter((m) => m.ftr === 'D');
        const awayLosing = data.awayMatches.filter((m) => m.ftr === 'A');

        // Over percentages (total corners per match = for + against)
        const totalPerMatch = allMatches.map((m) => m.hc + m.ac);
        const over85Count = totalPerMatch.filter((t) => t > 8.5).length;
        const over95Count = totalPerMatch.filter((t) => t > 9.5).length;
        const over105Count = totalPerMatch.filter((t) => t > 10.5).length;
        const over115Count = totalPerMatch.filter((t) => t > 11.5).length;

        const avg = (arr: Array<{ hc: number }>) =>
          arr.length > 0
            ? Math.round((arr.reduce((s, m) => s + m.hc, 0) / arr.length) * 10) / 10
            : 0;

        return {
          team,
          league: league.name,
          leagueId: league.id,
          country: league.country,
          gamesPlayed,
          totalCornersFor,
          totalCornersAgainst,
          avgCornersFor: Math.round((totalCornersFor / gamesPlayed) * 10) / 10,
          avgCornersAgainst: Math.round((totalCornersAgainst / gamesPlayed) * 10) / 10,
          avgTotalCorners:
            Math.round(((totalCornersFor + totalCornersAgainst) / gamesPlayed) * 10) / 10,
          homeGames,
          awayGames,
          homeCornersFor,
          homeCornersAgainst,
          awayCornersFor,
          awayCornersAgainst,
          avgCornersHome: homeGames > 0 ? Math.round((homeCornersFor / homeGames) * 10) / 10 : 0,
          avgCornersAway: awayGames > 0 ? Math.round((awayCornersFor / awayGames) * 10) / 10 : 0,
          gamesWinning: winning.length,
          gamesDrawing: drawing.length,
          gamesLosing: losing.length,
          avgCornersWinning: avg(winning),
          avgCornersDrawing: avg(drawing),
          avgCornersLosing: avg(losing),
          homeGamesWinning: homeWinning.length,
          homeGamesDrawing: homeDrawing.length,
          homeGamesLosing: homeLosing.length,
          avgCornersHomeWinning: avg(homeWinning),
          avgCornersHomeDrawing: avg(homeDrawing),
          avgCornersHomeLosing: avg(homeLosing),
          awayGamesWinning: awayWinning.length,
          awayGamesDrawing: awayDrawing.length,
          awayGamesLosing: awayLosing.length,
          avgCornersAwayWinning: avg(awayWinning),
          avgCornersAwayDrawing: avg(awayDrawing),
          avgCornersAwayLosing: avg(awayLosing),
          over85Pct: gamesPlayed > 0 ? Math.round((over85Count / gamesPlayed) * 100) : 0,
          over95Pct: gamesPlayed > 0 ? Math.round((over95Count / gamesPlayed) * 100) : 0,
          over105Pct: gamesPlayed > 0 ? Math.round((over105Count / gamesPlayed) * 100) : 0,
          over115Pct: gamesPlayed > 0 ? Math.round((over115Count / gamesPlayed) * 100) : 0,
          recentMatches: [],
        } as TeamCornerStats;
      })
      .filter(Boolean) as TeamCornerStats[];

    teams.sort((a, b) => b.avgCornersFor - a.avgCornersFor);

    return { teams, matchesAnalyzed: rows.length };
  } catch (error) {
    console.error(`fetchLeagueStats error for ${leagueId}:`, error);
    return null;
  }
}

export async function fetchH2HStats(leagueId: string, team1: string, team2: string) {
  const league = LEAGUES[leagueId];
  if (!league || !league.csvUrl) return null;

  try {
    const response = await fetch(league.csvUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) return null;

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    const h2hRows = rows.filter((row) => {
      const ht = row['HomeTeam'] || row['Home Team'] || '';
      const at = row['AwayTeam'] || row['Away Team'] || '';
      return (
        (ht.toLowerCase().includes(team1.toLowerCase()) &&
          at.toLowerCase().includes(team2.toLowerCase())) ||
        (ht.toLowerCase().includes(team2.toLowerCase()) &&
          at.toLowerCase().includes(team1.toLowerCase()))
      );
    });

    if (h2hRows.length === 0)
      return { matches: [], totalCorners: 0, avgCorners: 0, team1Avg: 0, team2Avg: 0 };

    const matches = h2hRows.map((row) => {
      const ht = row['HomeTeam'] || row['Home Team'] || '';
      const at = row['AwayTeam'] || row['Away Team'] || '';
      const hc = parseInt(row['HC'] || '0') || 0;
      const ac = parseInt(row['AC'] || '0') || 0;
      const isTeam1Home = ht.toLowerCase().includes(team1.toLowerCase());

      return {
        date: row['Date'] || '',
        homeTeam: ht,
        awayTeam: at,
        homeCorners: hc,
        awayCorners: ac,
        totalCorners: hc + ac,
        team1Corners: isTeam1Home ? hc : ac,
        team2Corners: isTeam1Home ? ac : hc,
        result: row['FTR'] || '',
        homeScore: parseInt(row['FTHG'] || '0') || 0,
        awayScore: parseInt(row['FTAG'] || '0') || 0,
      };
    });

    const totalCorners = matches.reduce((s, m) => s + m.totalCorners, 0);
    const team1Total = matches.reduce((s, m) => s + m.team1Corners, 0);
    const team2Total = matches.reduce((s, m) => s + m.team2Corners, 0);

    return {
      team1,
      team2,
      matches,
      totalMatches: matches.length,
      totalCorners,
      avgCorners: matches.length > 0 ? Math.round((totalCorners / matches.length) * 10) / 10 : 0,
      team1Avg: matches.length > 0 ? Math.round((team1Total / matches.length) * 10) / 10 : 0,
      team2Avg: matches.length > 0 ? Math.round((team2Total / matches.length) * 10) / 10 : 0,
    };
  } catch (error) {
    console.error(`fetchH2HStats error:`, error);
    return null;
  }
}

export async function fetchCardStats(leagueId: string) {
  const league = LEAGUES[leagueId];
  if (!league || !league.csvUrl) return null;

  try {
    const response = await fetch(league.csvUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) return null;

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    const teamData: Record<
      string,
      {
        homeMatches: Array<{ hy: number; ay: number; hr: number; ar: number }>;
        awayMatches: Array<{ hy: number; ay: number; hr: number; ar: number }>;
      }
    > = {};

    for (const row of rows) {
      const homeTeam = row['HomeTeam'] || row['Home Team'];
      const awayTeam = row['AwayTeam'] || row['Away Team'];
      const hy = parseInt(row['HY'] || '0') || 0;
      const ay = parseInt(row['AY'] || '0') || 0;
      const hr = parseInt(row['HR'] || '0') || 0;
      const ar = parseInt(row['AR'] || '0') || 0;

      if (!homeTeam || !awayTeam) continue;

      if (!teamData[homeTeam]) teamData[homeTeam] = { homeMatches: [], awayMatches: [] };
      if (!teamData[awayTeam]) teamData[awayTeam] = { homeMatches: [], awayMatches: [] };

      teamData[homeTeam].homeMatches.push({ hy, ay, hr, ar });
      teamData[awayTeam].awayMatches.push({ hy: ay, ay: hy, hr: ar, ar: hr });
    }

    const teams = Object.entries(teamData)
      .map(([team, data]) => {
        const all = [...data.homeMatches, ...data.awayMatches];
        const gamesPlayed = all.length;
        if (gamesPlayed === 0) return null;

        const totalYellow = all.reduce((s, m) => s + m.hy, 0);
        const totalRed = all.reduce((s, m) => s + m.hr, 0);

        return {
          team,
          gamesPlayed,
          avgYellowPerMatch: Math.round((totalYellow / gamesPlayed) * 10) / 10,
          avgRedPerMatch: Math.round((totalRed / gamesPlayed) * 100) / 100,
          avgCardsPerMatch: Math.round(((totalYellow + totalRed) / gamesPlayed) * 10) / 10,
          totalYellow,
          totalRed,
        };
      })
      .filter(Boolean);

    return { teams, leagueId, leagueName: league.name };
  } catch (error) {
    console.error(`fetchCardStats error:`, error);
    return null;
  }
}

export async function fetchShotStats(leagueId: string) {
  const league = LEAGUES[leagueId];
  if (!league || !league.csvUrl) return null;

  try {
    const response = await fetch(league.csvUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) return null;

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    const teamData: Record<
      string,
      {
        homeMatches: Array<{ hs: number; as_: number; hst: number; ast: number }>;
        awayMatches: Array<{ hs: number; as_: number; hst: number; ast: number }>;
      }
    > = {};

    for (const row of rows) {
      const homeTeam = row['HomeTeam'] || row['Home Team'];
      const awayTeam = row['AwayTeam'] || row['Away Team'];
      const hs = parseInt(row['HS'] || '0') || 0;
      const as_ = parseInt(row['AS'] || '0') || 0;
      const hst = parseInt(row['HST'] || '0') || 0;
      const ast = parseInt(row['AST'] || '0') || 0;

      if (!homeTeam || !awayTeam) continue;

      if (!teamData[homeTeam]) teamData[homeTeam] = { homeMatches: [], awayMatches: [] };
      if (!teamData[awayTeam]) teamData[awayTeam] = { homeMatches: [], awayMatches: [] };

      teamData[homeTeam].homeMatches.push({ hs, as_, hst, ast });
      teamData[awayTeam].awayMatches.push({ hs: as_, as_: hs, hst: ast, ast: hst });
    }

    const teams = Object.entries(teamData)
      .map(([team, data]) => {
        const all = [...data.homeMatches, ...data.awayMatches];
        const gamesPlayed = all.length;
        if (gamesPlayed === 0) return null;

        const totalShots = all.reduce((s, m) => s + m.hs, 0);
        const totalShotsOnTarget = all.reduce((s, m) => s + m.hst, 0);

        return {
          team,
          gamesPlayed,
          avgShotsPerMatch: Math.round((totalShots / gamesPlayed) * 10) / 10,
          avgShotsOnTargetPerMatch: Math.round((totalShotsOnTarget / gamesPlayed) * 10) / 10,
          accuracyPct: totalShots > 0 ? Math.round((totalShotsOnTarget / totalShots) * 100) : 0,
          totalShots,
          totalShotsOnTarget,
        };
      })
      .filter(Boolean);

    return { teams, leagueId, leagueName: league.name };
  } catch (error) {
    console.error(`fetchShotStats error:`, error);
    return null;
  }
}
