export interface RefereeCardStats {
  name: string;
  matches: number;
  tendency: 'strict' | 'lenient' | 'moderate';
  avgCardsPerMatch: number;
  avgYellowPerMatch: number;
  avgRedPerMatch: number;
  cardsByState: {
    winning: { yellow: number; red: number; matches: number };
    drawing: { yellow: number; red: number; matches: number };
    losing: { yellow: number; red: number; matches: number };
  };
  halfDistribution: {
    firstHalf: number;
    secondHalf: number;
  };
  recentMatches: Array<{
    date: string;
    homeTeam: string;
    awayTeam: string;
    yellowCards: number;
    redCards: number;
  }>;
}

export interface RefereeStatsSummary {
  avgCardsPerMatch: number;
  avgCardsWinning: string;
  avgCardsDrawing: string;
  avgCardsLosing: string;
  secondHalfPct: number;
}

const brazilianReferees: RefereeCardStats[] = [
  {
    name: 'Anderson Daronco',
    matches: 22,
    tendency: 'moderate',
    avgCardsPerMatch: 4.2,
    avgYellowPerMatch: 3.9,
    avgRedPerMatch: 0.18,
    cardsByState: {
      winning: { yellow: 28, red: 2, matches: 10 },
      drawing: { yellow: 24, red: 1, matches: 8 },
      losing: { yellow: 34, red: 1, matches: 12 },
    },
    halfDistribution: { firstHalf: 35, secondHalf: 65 },
    recentMatches: [
      {
        date: '2025-10-20',
        homeTeam: 'Flamengo',
        awayTeam: 'Palmeiras',
        yellowCards: 5,
        redCards: 0,
      },
      {
        date: '2025-10-13',
        homeTeam: 'São Paulo',
        awayTeam: 'Grêmio',
        yellowCards: 3,
        redCards: 1,
      },
      {
        date: '2025-10-06',
        homeTeam: 'Corinthians',
        awayTeam: 'Internacional',
        yellowCards: 4,
        redCards: 0,
      },
      {
        date: '2025-09-29',
        homeTeam: 'Athletico-PR',
        awayTeam: 'Fluminense',
        yellowCards: 6,
        redCards: 0,
      },
      {
        date: '2025-09-22',
        homeTeam: 'Botafogo',
        awayTeam: 'Cruzeiro',
        yellowCards: 2,
        redCards: 0,
      },
    ],
  },
  {
    name: 'Wilton Pereira Sampaio',
    matches: 20,
    tendency: 'strict',
    avgCardsPerMatch: 5.1,
    avgYellowPerMatch: 4.7,
    avgRedPerMatch: 0.25,
    cardsByState: {
      winning: { yellow: 30, red: 3, matches: 9 },
      drawing: { yellow: 26, red: 2, matches: 7 },
      losing: { yellow: 38, red: 2, matches: 11 },
    },
    halfDistribution: { firstHalf: 30, secondHalf: 70 },
    recentMatches: [
      { date: '2025-10-19', homeTeam: 'Bahia', awayTeam: 'Vasco', yellowCards: 6, redCards: 1 },
      {
        date: '2025-10-12',
        homeTeam: 'Fluminense',
        awayTeam: 'Botafogo',
        yellowCards: 5,
        redCards: 0,
      },
      { date: '2025-10-05', homeTeam: 'Grêmio', awayTeam: 'Cruzeiro', yellowCards: 4, redCards: 1 },
      {
        date: '2025-09-28',
        homeTeam: 'Internacional',
        awayTeam: 'Fortaleza',
        yellowCards: 7,
        redCards: 0,
      },
      {
        date: '2025-09-21',
        homeTeam: 'Atlético-MG',
        awayTeam: 'São Paulo',
        yellowCards: 5,
        redCards: 0,
      },
    ],
  },
  {
    name: 'Raphael Claus',
    matches: 18,
    tendency: 'lenient',
    avgCardsPerMatch: 3.3,
    avgYellowPerMatch: 3.1,
    avgRedPerMatch: 0.11,
    cardsByState: {
      winning: { yellow: 18, red: 1, matches: 8 },
      drawing: { yellow: 16, red: 0, matches: 6 },
      losing: { yellow: 25, red: 1, matches: 9 },
    },
    halfDistribution: { firstHalf: 40, secondHalf: 60 },
    recentMatches: [
      {
        date: '2025-10-18',
        homeTeam: 'Palmeiras',
        awayTeam: 'Corinthians',
        yellowCards: 3,
        redCards: 0,
      },
      {
        date: '2025-10-11',
        homeTeam: 'Flamengo',
        awayTeam: 'São Paulo',
        yellowCards: 2,
        redCards: 0,
      },
      {
        date: '2025-10-04',
        homeTeam: 'Cruzeiro',
        awayTeam: 'Athletico-PR',
        yellowCards: 4,
        redCards: 1,
      },
      { date: '2025-09-27', homeTeam: 'Vasco', awayTeam: 'Bahia', yellowCards: 3, redCards: 0 },
      {
        date: '2025-09-20',
        homeTeam: 'Fortaleza',
        awayTeam: 'Grêmio',
        yellowCards: 4,
        redCards: 0,
      },
    ],
  },
  {
    name: 'Bruno Arleu de Araújo',
    matches: 19,
    tendency: 'moderate',
    avgCardsPerMatch: 4.0,
    avgYellowPerMatch: 3.7,
    avgRedPerMatch: 0.16,
    cardsByState: {
      winning: { yellow: 22, red: 1, matches: 9 },
      drawing: { yellow: 20, red: 1, matches: 7 },
      losing: { yellow: 28, red: 1, matches: 10 },
    },
    halfDistribution: { firstHalf: 38, secondHalf: 62 },
    recentMatches: [
      {
        date: '2025-10-17',
        homeTeam: 'Internacional',
        awayTeam: 'Palmeiras',
        yellowCards: 4,
        redCards: 0,
      },
      {
        date: '2025-10-10',
        homeTeam: 'Botafogo',
        awayTeam: 'Atlético-MG',
        yellowCards: 5,
        redCards: 1,
      },
      {
        date: '2025-10-03',
        homeTeam: 'São Paulo',
        awayTeam: 'Fluminense',
        yellowCards: 3,
        redCards: 0,
      },
      {
        date: '2025-09-26',
        homeTeam: 'Corinthians',
        awayTeam: 'Fortaleza',
        yellowCards: 4,
        redCards: 0,
      },
      { date: '2025-09-19', homeTeam: 'Cruzeiro', awayTeam: 'Vasco', yellowCards: 5, redCards: 0 },
    ],
  },
  {
    name: 'Marcelo de Lima Henrique',
    matches: 17,
    tendency: 'strict',
    avgCardsPerMatch: 5.4,
    avgYellowPerMatch: 5.0,
    avgRedPerMatch: 0.29,
    cardsByState: {
      winning: { yellow: 28, red: 3, matches: 8 },
      drawing: { yellow: 22, red: 1, matches: 6 },
      losing: { yellow: 35, red: 2, matches: 10 },
    },
    halfDistribution: { firstHalf: 28, secondHalf: 72 },
    recentMatches: [
      { date: '2025-10-16', homeTeam: 'Grêmio', awayTeam: 'Bahia', yellowCards: 7, redCards: 1 },
      {
        date: '2025-10-09',
        homeTeam: 'Athletico-PR',
        awayTeam: 'Vasco',
        yellowCards: 6,
        redCards: 0,
      },
      {
        date: '2025-10-02',
        homeTeam: 'Flamengo',
        awayTeam: 'Internacional',
        yellowCards: 5,
        redCards: 1,
      },
      {
        date: '2025-09-25',
        homeTeam: 'Fortaleza',
        awayTeam: 'Corinthians',
        yellowCards: 8,
        redCards: 0,
      },
      {
        date: '2025-09-18',
        homeTeam: 'Atlético-MG',
        awayTeam: 'Cruzeiro',
        yellowCards: 6,
        redCards: 1,
      },
    ],
  },
  {
    name: 'Rodrigo José Pereira de Lima',
    matches: 16,
    tendency: 'lenient',
    avgCardsPerMatch: 3.0,
    avgYellowPerMatch: 2.8,
    avgRedPerMatch: 0.09,
    cardsByState: {
      winning: { yellow: 14, red: 0, matches: 7 },
      drawing: { yellow: 12, red: 1, matches: 5 },
      losing: { yellow: 22, red: 0, matches: 9 },
    },
    halfDistribution: { firstHalf: 42, secondHalf: 58 },
    recentMatches: [
      {
        date: '2025-10-15',
        homeTeam: 'Palmeiras',
        awayTeam: 'Fluminense',
        yellowCards: 2,
        redCards: 0,
      },
      {
        date: '2025-10-08',
        homeTeam: 'São Paulo',
        awayTeam: 'Botafogo',
        yellowCards: 3,
        redCards: 0,
      },
      { date: '2025-10-01', homeTeam: 'Cruzeiro', awayTeam: 'Grêmio', yellowCards: 4, redCards: 0 },
      {
        date: '2025-09-24',
        homeTeam: 'Bahia',
        awayTeam: 'Atlético-MG',
        yellowCards: 2,
        redCards: 1,
      },
      { date: '2025-09-17', homeTeam: 'Vasco', awayTeam: 'Fortaleza', yellowCards: 3, redCards: 0 },
    ],
  },
  {
    name: 'Flávio Rodrigues de Souza',
    matches: 21,
    tendency: 'moderate',
    avgCardsPerMatch: 4.5,
    avgYellowPerMatch: 4.1,
    avgRedPerMatch: 0.19,
    cardsByState: {
      winning: { yellow: 27, red: 2, matches: 10 },
      drawing: { yellow: 24, red: 1, matches: 8 },
      losing: { yellow: 35, red: 1, matches: 11 },
    },
    halfDistribution: { firstHalf: 36, secondHalf: 64 },
    recentMatches: [
      {
        date: '2025-10-14',
        homeTeam: 'Corinthians',
        awayTeam: 'Bahia',
        yellowCards: 5,
        redCards: 0,
      },
      {
        date: '2025-10-07',
        homeTeam: 'Internacional',
        awayTeam: 'Cruzeiro',
        yellowCards: 4,
        redCards: 1,
      },
      {
        date: '2025-09-30',
        homeTeam: 'Flamengo',
        awayTeam: 'Athletico-PR',
        yellowCards: 6,
        redCards: 0,
      },
      {
        date: '2025-09-23',
        homeTeam: 'Grêmio',
        awayTeam: 'São Paulo',
        yellowCards: 3,
        redCards: 0,
      },
      {
        date: '2025-09-16',
        homeTeam: 'Atlético-MG',
        awayTeam: 'Botafogo',
        yellowCards: 5,
        redCards: 1,
      },
    ],
  },
];

export function findReferee(name: string): RefereeCardStats | null {
  if (!name) return null;
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  const normalized = normalize(name);
  return (
    brazilianReferees.find(
      (ref) => {
        const refereeName = normalize(ref.name);
        return refereeName.includes(normalized) || normalized.includes(refereeName);
      }
    ) ?? null
  );
}

export function getRefereeStatsSummary(referee: RefereeCardStats): RefereeStatsSummary {
  const { cardsByState, halfDistribution } = referee;

  const avgCardsWinning = (
    (cardsByState.winning.yellow + cardsByState.winning.red) /
    cardsByState.winning.matches
  ).toFixed(1);

  const avgCardsDrawing = (
    (cardsByState.drawing.yellow + cardsByState.drawing.red) /
    cardsByState.drawing.matches
  ).toFixed(1);

  const avgCardsLosing = (
    (cardsByState.losing.yellow + cardsByState.losing.red) /
    cardsByState.losing.matches
  ).toFixed(1);

  const secondHalfPct = halfDistribution?.secondHalf ?? 65;

  return {
    avgCardsPerMatch: referee.avgCardsPerMatch,
    avgCardsWinning,
    avgCardsDrawing,
    avgCardsLosing,
    secondHalfPct,
  };
}

export default brazilianReferees;
