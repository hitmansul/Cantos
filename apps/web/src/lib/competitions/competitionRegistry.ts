export type CompetitionKind = 'league' | 'cup' | 'international' | 'national-team';
export type DataCapability =
  | 'fixtures'
  | 'results'
  | 'standings'
  | 'statistics'
  | 'live'
  | 'lineups'
  | 'events'
  | 'referees';

export type DataProvider = 'api-football' | '365scores' | 'thesportsdb' | 'football-data' | 'official' | 'local';

export interface CompetitionDefinition {
  key: string;
  name: string;
  country?: string;
  kind: CompetitionKind;
  apiFootballLeagueId?: number;
  scores365CompetitionId?: number;
  theSportsDbLeagueId?: string;
  footballDataCode?: string;
  season?: number;
  aliases?: string[];
  providers: Partial<Record<DataCapability, DataProvider[]>>;
}

const API_FIRST: DataProvider[] = ['api-football', '365scores', 'thesportsdb', 'local'];
const LIVE_FIRST: DataProvider[] = ['api-football', '365scores'];

function standardProviders(kind: CompetitionKind): CompetitionDefinition['providers'] {
  return {
    fixtures: API_FIRST,
    results: ['api-football', '365scores', 'thesportsdb'],
    standings: kind === 'cup' ? ['api-football', 'official', '365scores'] : ['api-football', '365scores', 'football-data'],
    statistics: ['api-football', '365scores'],
    live: LIVE_FIRST,
    lineups: ['api-football', '365scores'],
    events: ['api-football', '365scores'],
    referees: ['api-football', '365scores', 'official'],
  };
}

/**
 * Registro de aliases usados pela interface. A cobertura não fica limitada a
 * esta lista: o catálogo dinâmico consulta /leagues da API-Football e expõe
 * todas as competições disponíveis no plano do usuário.
 */
export const COMPETITION_REGISTRY: Record<string, CompetitionDefinition> = {
  brasileirao_a: {
    key: 'brasileirao_a', name: 'Brasileirão Série A', country: 'Brazil', kind: 'league',
    apiFootballLeagueId: 71, aliases: ['Serie A', 'Série A', 'Brazil Serie A'], providers: standardProviders('league'),
  },
  brasileirao_b: {
    key: 'brasileirao_b', name: 'Brasileirão Série B', country: 'Brazil', kind: 'league',
    apiFootballLeagueId: 72, aliases: ['Serie B', 'Série B', 'Brazil Serie B'], providers: standardProviders('league'),
  },
  brasileirao_c: {
    key: 'brasileirao_c', name: 'Brasileirão Série C', country: 'Brazil', kind: 'league',
    apiFootballLeagueId: 75, aliases: ['Serie C', 'Série C', 'Brazil Serie C'], providers: standardProviders('league'),
  },
  brasileirao_d: {
    key: 'brasileirao_d', name: 'Brasileirão Série D', country: 'Brazil', kind: 'league',
    apiFootballLeagueId: 76, aliases: ['Serie D', 'Série D', 'Brazil Serie D'], providers: standardProviders('league'),
  },
  copa_do_brasil: {
    key: 'copa_do_brasil', name: 'Copa do Brasil', country: 'Brazil', kind: 'cup',
    apiFootballLeagueId: 73, aliases: ['Copa BR', 'Brazil Cup'], providers: standardProviders('cup'),
  },
  libertadores: {
    key: 'libertadores', name: 'CONMEBOL Libertadores', kind: 'international',
    apiFootballLeagueId: 13, aliases: ['Copa Libertadores'], providers: standardProviders('international'),
  },
  sul_americana: {
    key: 'sul_americana', name: 'CONMEBOL Sul-Americana', kind: 'international',
    apiFootballLeagueId: 11, aliases: ['Copa Sul-Americana', 'Sudamericana'], providers: standardProviders('international'),
  },
  premier_league: {
    key: 'premier_league', name: 'Premier League', country: 'England', kind: 'league',
    apiFootballLeagueId: 39, footballDataCode: 'PL', providers: standardProviders('league'),
  },
  la_liga: {
    key: 'la_liga', name: 'La Liga', country: 'Spain', kind: 'league',
    apiFootballLeagueId: 140, footballDataCode: 'PD', providers: standardProviders('league'),
  },
  serie_a_italia: {
    key: 'serie_a_italia', name: 'Serie A', country: 'Italy', kind: 'league',
    apiFootballLeagueId: 135, footballDataCode: 'SA', providers: standardProviders('league'),
  },
  bundesliga: {
    key: 'bundesliga', name: 'Bundesliga', country: 'Germany', kind: 'league',
    apiFootballLeagueId: 78, footballDataCode: 'BL1', providers: standardProviders('league'),
  },
  ligue_1: {
    key: 'ligue_1', name: 'Ligue 1', country: 'France', kind: 'league',
    apiFootballLeagueId: 61, footballDataCode: 'FL1', providers: standardProviders('league'),
  },
  champions_league: {
    key: 'champions_league', name: 'UEFA Champions League', kind: 'international',
    apiFootballLeagueId: 2, footballDataCode: 'CL', providers: standardProviders('international'),
  },
};

export function getCompetitionDefinition(key: string): CompetitionDefinition | null {
  return COMPETITION_REGISTRY[key] ?? null;
}

export function buildDynamicCompetition(input: {
  id: number;
  name: string;
  country?: string;
  type?: string;
  season?: number;
}): CompetitionDefinition {
  const normalized = `${input.country ?? 'world'}-${input.name}-${input.id}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const kind: CompetitionKind = /cup/i.test(input.type ?? '') ? 'cup' : 'league';
  return {
    key: normalized,
    name: input.name,
    country: input.country,
    kind,
    apiFootballLeagueId: input.id,
    season: input.season,
    providers: standardProviders(kind),
  };
}
