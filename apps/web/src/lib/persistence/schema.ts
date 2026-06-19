export const PERSISTENT_SCHEMA_VERSION = '0001_persistent_pipeline';

export const PERSISTENT_TABLES = {
  sources: 'data_sources',
  competitions: 'competitions',
  worldCupTeams: 'world_cup_teams',
  worldCupPlayers: 'world_cup_players',
  worldCupMatches: 'world_cup_matches',
  worldCupStandings: 'world_cup_standings',
  worldCupMatchStatistics: 'world_cup_match_statistics',
  worldCupPlayerStatistics: 'world_cup_player_statistics',
  liveEvents: 'live_events',
  liveEventStatistics: 'live_event_statistics',
  liveStoppagePeriods: 'live_stoppage_periods',
  liveAddedTime: 'live_added_time',
  bookmakers: 'bookmakers',
  oddsEvents: 'odds_events',
  oddsMarkets: 'odds_markets',
  oddsPrices: 'odds_prices',
  oddsAlerts: 'odds_alerts',
  aiKnowledgeDocuments: 'ai_knowledge_documents',
  aiResponseCache: 'ai_response_cache',
  aiRankings: 'ai_rankings',
} as const;

export type PersistentTableName = (typeof PERSISTENT_TABLES)[keyof typeof PERSISTENT_TABLES];

export const WORLD_CUP_DATA_CONTRACT = {
  primarySource: 'fifa',
  fallbackSources: ['365scores', 'api-football'],
  requiredEntities: [
    'selecoes',
    'jogadores',
    'partidas',
    'classificacao',
    'grupos',
    'estatisticas_de_partidas',
    'estatisticas_de_jogadores',
    'escanteios',
    'cartoes',
  ],
} as const;
