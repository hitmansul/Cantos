/**
 * International fixtures data for GlobalCornerSearch
 * Upcoming matches for major leagues
 */

export interface InternationalMatch {
  homeTeam: string;
  awayTeam: string;
  date: string; // "YYYY-MM-DD" or "YYYY-MM-DD HH:MM"
}

export const internationalFixtures: Record<string, InternationalMatch[]> = {
  BR1: [
    { homeTeam: 'Athletico', awayTeam: 'Mirassol', date: '2026-05-30 16:00' },
    { homeTeam: 'Flamengo', awayTeam: 'Coritiba', date: '2026-05-30 16:00' },
    { homeTeam: 'Bahia', awayTeam: 'Botafogo', date: '2026-05-30 17:30' },
    { homeTeam: 'Gremio', awayTeam: 'Corinthians', date: '2026-05-30 17:30' },
    { homeTeam: 'Santos', awayTeam: 'Vitoria', date: '2026-05-30 20:00' },
  ],
  BR2: [
    { homeTeam: 'Atletico-GO', awayTeam: 'Goias', date: '2026-05-30 16:00' },
    { homeTeam: 'Avai', awayTeam: 'Criciuma', date: '2026-05-30 16:00' },
    { homeTeam: 'Athletic', awayTeam: 'Fortaleza', date: '2026-05-30 18:00' },
    { homeTeam: 'Sport', awayTeam: 'Nautico', date: '2026-05-30 20:30' },
  ],
  segunda_division: [
    { homeTeam: 'Ceuta', awayTeam: 'Albacete', date: '2026-05-30 11:15' },
    { homeTeam: 'Real Sociedad B U21', awayTeam: 'Cultural Leonesa', date: '2026-05-30 11:15' },
    { homeTeam: 'Granada', awayTeam: 'Sporting', date: '2026-05-30 16:00' },
  ],
  chile_primera: [
    { homeTeam: 'La Serena', awayTeam: 'Colo-Colo', date: '2026-05-30 16:00' },
    { homeTeam: 'Universidad de Chile', awayTeam: 'D. Concepcion', date: '2026-05-30 18:30' },
  ],
  bolivia_primera: [
    { homeTeam: 'ABB', awayTeam: 'Always Ready', date: '2026-05-30 16:00' },
    { homeTeam: 'Real Oruro', awayTeam: 'GV San Jose', date: '2026-05-30 18:15' },
    { homeTeam: 'Real Tomayapo', awayTeam: 'Independiente Petrolero', date: '2026-05-30 21:00' },
  ],
  china_csl: [
    { homeTeam: 'Henan', awayTeam: 'Zhejiang', date: '2026-05-30 08:00' },
    { homeTeam: 'Chengdu', awayTeam: 'Taishan', date: '2026-05-30 08:35' },
    { homeTeam: 'Tongliang Long', awayTeam: 'Guoan', date: '2026-05-30 09:00' },
  ],
  premier_league: [
    { homeTeam: 'Arsenal', awayTeam: 'Chelsea', date: '2026-05-17 16:00' },
    { homeTeam: 'Manchester City', awayTeam: 'Liverpool', date: '2026-05-17 13:30' },
    { homeTeam: 'Tottenham', awayTeam: 'Newcastle', date: '2026-05-18 15:00' },
    { homeTeam: 'Manchester United', awayTeam: 'Aston Villa', date: '2026-05-18 17:30' },
    { homeTeam: 'Brighton', awayTeam: 'West Ham', date: '2026-05-24 15:00' },
    { homeTeam: 'Everton', awayTeam: 'Fulham', date: '2026-05-24 15:00' },
  ],
  la_liga: [
    { homeTeam: 'Real Madrid', awayTeam: 'Barcelona', date: '2026-05-17 21:00' },
    { homeTeam: 'Atletico Madrid', awayTeam: 'Sevilla', date: '2026-05-18 19:00' },
    { homeTeam: 'Athletic Bilbao', awayTeam: 'Real Sociedad', date: '2026-05-18 21:00' },
    { homeTeam: 'Valencia', awayTeam: 'Villarreal', date: '2026-05-24 19:00' },
  ],
  serie_a: [
    { homeTeam: 'Inter', awayTeam: 'AC Milan', date: '2026-05-17 18:00' },
    { homeTeam: 'Juventus', awayTeam: 'Napoli', date: '2026-05-17 20:45' },
    { homeTeam: 'Roma', awayTeam: 'Lazio', date: '2026-05-18 20:45' },
    { homeTeam: 'Atalanta', awayTeam: 'Fiorentina', date: '2026-05-24 20:45' },
  ],
  bundesliga: [
    { homeTeam: 'Bayern Munchen', awayTeam: 'Borussia Dortmund', date: '2026-05-16 18:30' },
    { homeTeam: 'RB Leipzig', awayTeam: 'Bayer Leverkusen', date: '2026-05-16 15:30' },
    { homeTeam: 'Eintracht Frankfurt', awayTeam: 'Wolfsburg', date: '2026-05-23 15:30' },
    { homeTeam: 'Stuttgart', awayTeam: "Borussia M'gladbach", date: '2026-05-23 18:30' },
  ],
  ligue_1: [
    { homeTeam: 'Nice', awayTeam: 'Saint-Etienne', date: '2026-05-30 16:00' },
    { homeTeam: 'PSG', awayTeam: 'Olympique Marseille', date: '2026-05-17 20:45' },
    { homeTeam: 'Monaco', awayTeam: 'Lyon', date: '2026-05-17 17:05' },
    { homeTeam: 'Lille', awayTeam: 'Nice', date: '2026-05-18 17:05' },
    { homeTeam: 'Lens', awayTeam: 'Rennes', date: '2026-05-24 20:00' },
  ],
  champions_league: [
    { homeTeam: 'Real Madrid', awayTeam: 'Manchester City', date: '2026-05-27 21:00' },
    { homeTeam: 'Bayern Munchen', awayTeam: 'Inter', date: '2026-05-28 21:00' },
    { homeTeam: 'PSG', awayTeam: 'Arsenal', date: '2026-05-30 13:00' },
  ],
  europa_league: [
    { homeTeam: 'Manchester United', awayTeam: 'Roma', date: '2026-05-20 21:00' },
    { homeTeam: 'Tottenham', awayTeam: 'Lyon', date: '2026-05-21 21:00' },
  ],
};

/** Return a human-readable round label. */
export function getRoundName(league: string, round: number): string {
  if (!round || round === 0) return 'A definir';
  const cupLeagues = [
    'copa_do_brasil',
    'champions_league',
    'europa_league',
    'conference_league',
    'libertadores',
    'sul_americana',
  ];
  if (cupLeagues.includes(league)) {
    if (round === 1) return 'Primeira fase';
    if (round === 2) return 'Segunda fase';
    if (round === 3) return 'Terceira fase';
    if (round === 4) return 'Oitavas de final';
    if (round === 5) return 'Quartas de final';
    if (round === 6) return 'Semifinal';
    if (round === 7) return 'Final';
    return `Fase ${round}`;
  }
  return `Rodada ${round}`;
}
