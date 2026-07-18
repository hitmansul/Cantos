export type FootballDataSource =
  | '365scores'
  | 'api-football'
  | 'sofascore'
  | 'football-data'
  | 'thesportsdb'
  | 'official-cbf'
  | 'official-competition'
  | 'local-cache';

export type FootballDataCapability =
  | 'upcoming'
  | 'results'
  | 'standings'
  | 'live'
  | 'match-stats'
  | 'corners'
  | 'bracket'
  | 'referee'
  | 'stoppage-time';

export type CompetitionFamily =
  | 'brazil-league'
  | 'brazil-cup'
  | 'conmebol-cup'
  | 'top-european-league'
  | 'other-international-league'
  | 'uefa-cup'
  | 'international-cup';

export interface SourcePriorityRule {
  family: CompetitionFamily;
  capability: FootballDataCapability;
  sources: FootballDataSource[];
  minimumUsefulRecords?: number;
  mergeSources?: boolean;
  notes?: string;
}

const BRAZIL_LEAGUES = new Set([
  'brasileirao_a',
  'brasileirao_b',
  'brasileirao_c',
  'brasileirao_d',
  'paulistao',
  'carioca',
  'mineiro',
  'gaucho',
  'baiano',
]);

const BRAZIL_CUPS = new Set(['copa_do_brasil']);
const CONMEBOL_CUPS = new Set(['libertadores', 'sudamericana', 'copa_america']);
const UEFA_CUPS = new Set(['champions_league', 'europa_league', 'conference_league']);
const TOP_EUROPEAN_LEAGUES = new Set([
  'premier_league',
  'championship',
  'la_liga',
  'segunda_division',
  'serie_a',
  'serie_b_italy',
  'bundesliga',
  'bundesliga_2',
  'ligue_1',
  'ligue_2',
  'eredivisie',
  'primeira_liga',
]);

export function competitionFamily(competition: string): CompetitionFamily {
  if (BRAZIL_CUPS.has(competition)) return 'brazil-cup';
  if (BRAZIL_LEAGUES.has(competition)) return 'brazil-league';
  if (CONMEBOL_CUPS.has(competition)) return 'conmebol-cup';
  if (UEFA_CUPS.has(competition)) return 'uefa-cup';
  if (TOP_EUROPEAN_LEAGUES.has(competition)) return 'top-european-league';
  if (competition === 'copa_do_mundo' || competition === 'nations_league') return 'international-cup';
  return 'other-international-league';
}

const RULES: Record<CompetitionFamily, Record<FootballDataCapability, FootballDataSource[]>> = {
  'brazil-league': {
    upcoming: ['api-football', '365scores', 'sofascore', 'official-cbf', 'local-cache'],
    results: ['api-football', '365scores', 'sofascore', 'local-cache'],
    standings: ['api-football', '365scores', 'official-cbf', 'sofascore', 'local-cache'],
    live: ['365scores', 'api-football', 'sofascore'],
    'match-stats': ['api-football', '365scores', 'sofascore'],
    corners: ['api-football', '365scores', 'sofascore'],
    bracket: ['official-cbf', 'api-football', '365scores'],
    referee: ['api-football', '365scores', 'sofascore'],
    'stoppage-time': ['365scores', 'sofascore', 'api-football'],
  },
  'brazil-cup': {
    upcoming: ['api-football', '365scores', 'official-cbf', 'sofascore', 'local-cache'],
    results: ['api-football', '365scores', 'official-cbf', 'sofascore', 'local-cache'],
    standings: ['official-cbf', 'api-football', '365scores'],
    live: ['365scores', 'api-football', 'sofascore'],
    'match-stats': ['api-football', '365scores', 'sofascore'],
    corners: ['api-football', '365scores', 'sofascore'],
    bracket: ['official-cbf', 'api-football', '365scores', 'sofascore'],
    referee: ['official-cbf', 'api-football', '365scores'],
    'stoppage-time': ['365scores', 'sofascore', 'api-football'],
  },
  'conmebol-cup': {
    upcoming: ['365scores', 'api-football', 'sofascore', 'official-competition', 'local-cache'],
    results: ['365scores', 'api-football', 'sofascore', 'local-cache'],
    standings: ['365scores', 'api-football', 'sofascore'],
    live: ['365scores', 'api-football', 'sofascore'],
    'match-stats': ['365scores', 'api-football', 'sofascore'],
    corners: ['365scores', 'api-football', 'sofascore'],
    bracket: ['official-competition', '365scores', 'api-football', 'sofascore'],
    referee: ['api-football', '365scores', 'sofascore'],
    'stoppage-time': ['365scores', 'sofascore', 'api-football'],
  },
  'top-european-league': {
    upcoming: ['football-data', 'api-football', '365scores', 'sofascore', 'thesportsdb', 'local-cache'],
    results: ['football-data', 'api-football', '365scores', 'sofascore', 'local-cache'],
    standings: ['football-data', 'api-football', '365scores', 'sofascore'],
    live: ['365scores', 'api-football', 'sofascore'],
    'match-stats': ['api-football', '365scores', 'sofascore'],
    corners: ['api-football', '365scores', 'sofascore'],
    bracket: ['official-competition', 'api-football', '365scores'],
    referee: ['api-football', '365scores', 'sofascore'],
    'stoppage-time': ['365scores', 'sofascore', 'api-football'],
  },
  'other-international-league': {
    upcoming: ['365scores', 'api-football', 'sofascore', 'thesportsdb', 'local-cache'],
    results: ['365scores', 'api-football', 'sofascore', 'thesportsdb', 'local-cache'],
    standings: ['365scores', 'api-football', 'sofascore', 'thesportsdb'],
    live: ['365scores', 'api-football', 'sofascore'],
    'match-stats': ['api-football', '365scores', 'sofascore'],
    corners: ['api-football', '365scores', 'sofascore'],
    bracket: ['official-competition', '365scores', 'api-football'],
    referee: ['api-football', '365scores', 'sofascore'],
    'stoppage-time': ['365scores', 'sofascore', 'api-football'],
  },
  'uefa-cup': {
    upcoming: ['football-data', 'api-football', '365scores', 'sofascore', 'official-competition', 'local-cache'],
    results: ['football-data', 'api-football', '365scores', 'sofascore', 'local-cache'],
    standings: ['football-data', 'api-football', '365scores', 'sofascore'],
    live: ['365scores', 'api-football', 'sofascore'],
    'match-stats': ['api-football', '365scores', 'sofascore'],
    corners: ['api-football', '365scores', 'sofascore'],
    bracket: ['official-competition', 'api-football', '365scores', 'sofascore'],
    referee: ['api-football', '365scores', 'sofascore'],
    'stoppage-time': ['365scores', 'sofascore', 'api-football'],
  },
  'international-cup': {
    upcoming: ['api-football', '365scores', 'sofascore', 'official-competition', 'local-cache'],
    results: ['api-football', '365scores', 'sofascore', 'local-cache'],
    standings: ['api-football', '365scores', 'sofascore'],
    live: ['365scores', 'api-football', 'sofascore'],
    'match-stats': ['api-football', '365scores', 'sofascore'],
    corners: ['api-football', '365scores', 'sofascore'],
    bracket: ['official-competition', 'api-football', '365scores', 'sofascore'],
    referee: ['api-football', '365scores', 'sofascore'],
    'stoppage-time': ['365scores', 'sofascore', 'api-football'],
  },
};

export function getSourcePriority(
  competition: string,
  capability: FootballDataCapability
): SourcePriorityRule {
  const family = competitionFamily(competition);
  return {
    family,
    capability,
    sources: RULES[family][capability],
    minimumUsefulRecords: capability === 'upcoming' ? 1 : undefined,
    mergeSources: capability === 'match-stats' || capability === 'corners',
  };
}

export function shouldAcceptSourceResult(rule: SourcePriorityRule, recordCount: number): boolean {
  return recordCount >= (rule.minimumUsefulRecords ?? 1);
}
