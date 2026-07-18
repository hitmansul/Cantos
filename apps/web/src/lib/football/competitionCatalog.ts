export type CompetitionKey =
  | 'brasileirao_a'
  | 'brasileirao_b'
  | 'brasileirao_c'
  | 'brasileirao_d'
  | 'copa_do_brasil';

export interface CompetitionCatalogEntry {
  key: CompetitionKey;
  name: string;
  country: string;
  flag: string;
  apiFootballLeagueId: number;
  season: number;
  supportsUpcoming: boolean;
  supportsStandings: boolean;
  supportsMatchStats: boolean;
  supportsCorners: boolean;
}

export const BRAZIL_COMPETITIONS: Record<CompetitionKey, CompetitionCatalogEntry> = {
  brasileirao_a: {
    key: 'brasileirao_a',
    name: 'Brasileirão Série A',
    country: 'Brasil',
    flag: '🇧🇷',
    apiFootballLeagueId: 71,
    season: 2026,
    supportsUpcoming: true,
    supportsStandings: true,
    supportsMatchStats: true,
    supportsCorners: true,
  },
  brasileirao_b: {
    key: 'brasileirao_b',
    name: 'Brasileirão Série B',
    country: 'Brasil',
    flag: '🇧🇷',
    apiFootballLeagueId: 72,
    season: 2026,
    supportsUpcoming: true,
    supportsStandings: true,
    supportsMatchStats: true,
    supportsCorners: true,
  },
  brasileirao_c: {
    key: 'brasileirao_c',
    name: 'Brasileirão Série C',
    country: 'Brasil',
    flag: '🇧🇷',
    apiFootballLeagueId: 75,
    season: 2026,
    supportsUpcoming: true,
    supportsStandings: true,
    supportsMatchStats: true,
    supportsCorners: true,
  },
  brasileirao_d: {
    key: 'brasileirao_d',
    name: 'Brasileirão Série D',
    country: 'Brasil',
    flag: '🇧🇷',
    apiFootballLeagueId: 76,
    season: 2026,
    supportsUpcoming: true,
    supportsStandings: true,
    supportsMatchStats: true,
    supportsCorners: true,
  },
  copa_do_brasil: {
    key: 'copa_do_brasil',
    name: 'Copa do Brasil',
    country: 'Brasil',
    flag: '🇧🇷',
    apiFootballLeagueId: 73,
    season: 2026,
    supportsUpcoming: true,
    supportsStandings: false,
    supportsMatchStats: true,
    supportsCorners: true,
  },
};

export function getBrazilCompetition(key: string): CompetitionCatalogEntry | null {
  return BRAZIL_COMPETITIONS[key as CompetitionKey] ?? null;
}
