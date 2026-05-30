export interface Bookmaker {
  id: string;
  name: string;
  slug: string;
  logo?: string;
}

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  status: "live" | "upcoming" | "finished";
  minute?: number;
  homeScore?: number;
  awayScore?: number;
  startTime: string;
}

export interface CornerOdd {
  marketId: string;
  marketName: string;
  handicap: number;
  period: string;
  outcome: string;
  odds: Record<string, number | null>;
}

export const bookmakers: Bookmaker[] = [
  { id: "1", name: "Bet365", slug: "bet365" },
  { id: "2", name: "Betano", slug: "betano" },
  { id: "3", name: "KTO", slug: "kto" },
  { id: "4", name: "Estrela Bet", slug: "estrelabet" },
  { id: "5", name: "Sportingbet", slug: "sportingbet" },
  { id: "6", name: "Betfair", slug: "betfair" },
];

export const mockMatches: Match[] = [
  {
    id: "1",
    homeTeam: "Flamengo",
    awayTeam: "Palmeiras",
    league: "Brasileirão Série A",
    status: "live",
    minute: 67,
    homeScore: 2,
    awayScore: 1,
    startTime: "2024-01-15T20:00:00Z",
  },
  {
    id: "2",
    homeTeam: "São Paulo",
    awayTeam: "Corinthians",
    league: "Brasileirão Série A",
    status: "live",
    minute: 34,
    homeScore: 0,
    awayScore: 0,
    startTime: "2024-01-15T20:00:00Z",
  },
  {
    id: "3",
    homeTeam: "Real Madrid",
    awayTeam: "Barcelona",
    league: "La Liga",
    status: "live",
    minute: 78,
    homeScore: 1,
    awayScore: 2,
    startTime: "2024-01-15T21:00:00Z",
  },
  {
    id: "4",
    homeTeam: "Manchester City",
    awayTeam: "Liverpool",
    league: "Premier League",
    status: "upcoming",
    startTime: "2024-01-16T17:30:00Z",
  },
  {
    id: "5",
    homeTeam: "Grêmio",
    awayTeam: "Internacional",
    league: "Brasileirão Série A",
    status: "live",
    minute: 12,
    homeScore: 0,
    awayScore: 1,
    startTime: "2024-01-15T19:00:00Z",
  },
];

export const mockCornerOdds: Record<string, CornerOdd[]> = {
  "1": [
    {
      marketId: "101",
      marketName: "Total de Escanteios",
      handicap: 9.5,
      period: "Tempo Completo",
      outcome: "Mais de 9.5",
      odds: { bet365: 1.85, betano: 1.90, kto: 1.87, estrelabet: 1.82, sportingbet: 1.88, betfair: 1.92 },
    },
    {
      marketId: "101",
      marketName: "Total de Escanteios",
      handicap: 9.5,
      period: "Tempo Completo",
      outcome: "Menos de 9.5",
      odds: { bet365: 1.95, betano: 1.90, kto: 1.93, estrelabet: 1.98, sportingbet: 1.92, betfair: 1.88 },
    },
    {
      marketId: "102",
      marketName: "Total de Escanteios",
      handicap: 10.5,
      period: "Tempo Completo",
      outcome: "Mais de 10.5",
      odds: { bet365: 2.10, betano: 2.15, kto: 2.12, estrelabet: 2.08, sportingbet: 2.14, betfair: 2.18 },
    },
    {
      marketId: "102",
      marketName: "Total de Escanteios",
      handicap: 10.5,
      period: "Tempo Completo",
      outcome: "Menos de 10.5",
      odds: { bet365: 1.72, betano: 1.68, kto: 1.70, estrelabet: 1.74, sportingbet: 1.69, betfair: 1.66 },
    },
    {
      marketId: "103",
      marketName: "Escanteios 1º Tempo",
      handicap: 4.5,
      period: "1º Tempo",
      outcome: "Mais de 4.5",
      odds: { bet365: 1.95, betano: 2.00, kto: 1.97, estrelabet: 1.92, sportingbet: 1.98, betfair: 2.02 },
    },
    {
      marketId: "103",
      marketName: "Escanteios 1º Tempo",
      handicap: 4.5,
      period: "1º Tempo",
      outcome: "Menos de 4.5",
      odds: { bet365: 1.85, betano: 1.80, kto: 1.83, estrelabet: 1.88, sportingbet: 1.82, betfair: 1.78 },
    },
    {
      marketId: "104",
      marketName: "Handicap de Escanteios",
      handicap: -1.5,
      period: "Tempo Completo",
      outcome: "Flamengo -1.5",
      odds: { bet365: 2.25, betano: 2.30, kto: 2.22, estrelabet: 2.28, sportingbet: 2.26, betfair: 2.32 },
    },
    {
      marketId: "104",
      marketName: "Handicap de Escanteios",
      handicap: -1.5,
      period: "Tempo Completo",
      outcome: "Palmeiras +1.5",
      odds: { bet365: 1.62, betano: 1.58, kto: 1.65, estrelabet: 1.60, sportingbet: 1.61, betfair: 1.56 },
    },
  ],
  "2": [
    {
      marketId: "201",
      marketName: "Total de Escanteios",
      handicap: 8.5,
      period: "Tempo Completo",
      outcome: "Mais de 8.5",
      odds: { bet365: 1.75, betano: 1.78, kto: 1.76, estrelabet: 1.73, sportingbet: 1.77, betfair: 1.80 },
    },
    {
      marketId: "201",
      marketName: "Total de Escanteios",
      handicap: 8.5,
      period: "Tempo Completo",
      outcome: "Menos de 8.5",
      odds: { bet365: 2.05, betano: 2.02, kto: 2.04, estrelabet: 2.08, sportingbet: 2.03, betfair: 2.00 },
    },
    {
      marketId: "202",
      marketName: "Escanteios 2º Tempo",
      handicap: 5.5,
      period: "2º Tempo",
      outcome: "Mais de 5.5",
      odds: { bet365: 2.20, betano: 2.25, kto: 2.18, estrelabet: 2.22, sportingbet: 2.24, betfair: 2.28 },
    },
    {
      marketId: "202",
      marketName: "Escanteios 2º Tempo",
      handicap: 5.5,
      period: "2º Tempo",
      outcome: "Menos de 5.5",
      odds: { bet365: 1.65, betano: 1.62, kto: 1.67, estrelabet: 1.63, sportingbet: 1.64, betfair: 1.60 },
    },
  ],
  "3": [
    {
      marketId: "301",
      marketName: "Total de Escanteios",
      handicap: 11.5,
      period: "Tempo Completo",
      outcome: "Mais de 11.5",
      odds: { bet365: 1.90, betano: 1.95, kto: 1.92, estrelabet: 1.88, sportingbet: 1.93, betfair: 1.97 },
    },
    {
      marketId: "301",
      marketName: "Total de Escanteios",
      handicap: 11.5,
      period: "Tempo Completo",
      outcome: "Menos de 11.5",
      odds: { bet365: 1.90, betano: 1.85, kto: 1.88, estrelabet: 1.92, sportingbet: 1.87, betfair: 1.83 },
    },
    {
      marketId: "302",
      marketName: "Primeiro Time a Escanteio",
      handicap: 0,
      period: "Tempo Completo",
      outcome: "Real Madrid",
      odds: { bet365: 1.55, betano: 1.58, kto: 1.53, estrelabet: 1.56, sportingbet: 1.57, betfair: 1.60 },
    },
    {
      marketId: "302",
      marketName: "Primeiro Time a Escanteio",
      handicap: 0,
      period: "Tempo Completo",
      outcome: "Barcelona",
      odds: { bet365: 2.45, betano: 2.40, kto: 2.50, estrelabet: 2.42, sportingbet: 2.43, betfair: 2.38 },
    },
  ],
  "5": [
    {
      marketId: "501",
      marketName: "Total de Escanteios",
      handicap: 10.5,
      period: "Tempo Completo",
      outcome: "Mais de 10.5",
      odds: { bet365: 2.00, betano: 2.05, kto: 2.02, estrelabet: 1.98, sportingbet: 2.03, betfair: 2.08 },
    },
    {
      marketId: "501",
      marketName: "Total de Escanteios",
      handicap: 10.5,
      period: "Tempo Completo",
      outcome: "Menos de 10.5",
      odds: { bet365: 1.80, betano: 1.75, kto: 1.78, estrelabet: 1.82, sportingbet: 1.77, betfair: 1.72 },
    },
  ],
};
