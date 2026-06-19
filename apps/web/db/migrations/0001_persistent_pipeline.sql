-- Persistent data foundation for Cantos Estatisticas.
-- Target: serverless Postgres through Neon/Supabase/Vercel marketplace.
-- This migration is idempotent so it can be executed safely more than once.

CREATE TABLE IF NOT EXISTS data_sources (
  source_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL,
  base_url TEXT,
  notes TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitions (
  competition_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  season TEXT NOT NULL,
  country TEXT,
  type TEXT NOT NULL DEFAULT 'league',
  source_priority JSONB NOT NULL DEFAULT '[]'::JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS world_cup_teams (
  id BIGSERIAL PRIMARY KEY,
  competition_key TEXT NOT NULL REFERENCES competitions(competition_key) ON DELETE CASCADE,
  fifa_code TEXT,
  name TEXT NOT NULL,
  group_name TEXT,
  group_position INTEGER,
  points INTEGER,
  goal_difference INTEGER,
  source_key TEXT NOT NULL REFERENCES data_sources(source_key),
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (competition_key, fifa_code),
  UNIQUE (competition_key, name)
);

CREATE TABLE IF NOT EXISTS world_cup_players (
  id BIGSERIAL PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES world_cup_teams(id) ON DELETE CASCADE,
  fifa_player_id TEXT,
  shirt_number INTEGER,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  club TEXT,
  height_cm INTEGER,
  date_of_birth DATE,
  age INTEGER,
  source_key TEXT NOT NULL REFERENCES data_sources(source_key),
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, shirt_number, name)
);

CREATE TABLE IF NOT EXISTS world_cup_matches (
  id BIGSERIAL PRIMARY KEY,
  competition_key TEXT NOT NULL REFERENCES competitions(competition_key) ON DELETE CASCADE,
  fixture_key TEXT NOT NULL UNIQUE,
  fifa_match_id TEXT,
  scores365_event_id TEXT,
  api_football_fixture_id TEXT,
  home_team_id BIGINT REFERENCES world_cup_teams(id),
  away_team_id BIGINT REFERENCES world_cup_teams(id),
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  stage TEXT,
  group_name TEXT,
  round_name TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  kickoff_at TIMESTAMPTZ,
  venue TEXT,
  referee TEXT,
  home_score INTEGER,
  away_score INTEGER,
  source_key TEXT NOT NULL REFERENCES data_sources(source_key),
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS world_cup_standings (
  id BIGSERIAL PRIMARY KEY,
  competition_key TEXT NOT NULL REFERENCES competitions(competition_key) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES world_cup_teams(id) ON DELETE CASCADE,
  group_name TEXT,
  position INTEGER,
  played INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  drawn INTEGER NOT NULL DEFAULT 0,
  lost INTEGER NOT NULL DEFAULT 0,
  goals_for INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  goal_difference INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  live_points INTEGER,
  live_goal_difference INTEGER,
  source_key TEXT NOT NULL REFERENCES data_sources(source_key),
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (competition_key, team_id)
);

CREATE TABLE IF NOT EXISTS world_cup_match_statistics (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES world_cup_matches(id) ON DELETE CASCADE,
  team_id BIGINT REFERENCES world_cup_teams(id) ON DELETE CASCADE,
  period TEXT NOT NULL DEFAULT 'match',
  metric_key TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value_numeric NUMERIC,
  value_text TEXT,
  source_key TEXT NOT NULL REFERENCES data_sources(source_key),
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, team_id, period, metric_key, source_key)
);

CREATE TABLE IF NOT EXISTS world_cup_player_statistics (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT REFERENCES world_cup_matches(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES world_cup_players(id) ON DELETE CASCADE,
  period TEXT NOT NULL DEFAULT 'match',
  metric_key TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value_numeric NUMERIC,
  value_text TEXT,
  source_key TEXT NOT NULL REFERENCES data_sources(source_key),
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, player_id, period, metric_key, source_key)
);

CREATE TABLE IF NOT EXISTS live_events (
  id BIGSERIAL PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  competition_key TEXT,
  competition_name TEXT,
  source_key TEXT NOT NULL REFERENCES data_sources(source_key),
  scores365_event_id TEXT,
  api_football_fixture_id TEXT,
  fifa_match_id TEXT,
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  status TEXT,
  match_minute TEXT,
  kickoff_at TIMESTAMPTZ,
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS live_event_statistics (
  id BIGSERIAL PRIMARY KEY,
  live_event_id BIGINT NOT NULL REFERENCES live_events(id) ON DELETE CASCADE,
  team_side TEXT,
  team_name TEXT,
  period TEXT NOT NULL DEFAULT 'match',
  metric_key TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value_numeric NUMERIC,
  value_text TEXT,
  source_key TEXT NOT NULL REFERENCES data_sources(source_key),
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (live_event_id, team_side, period, metric_key, source_key)
);

CREATE TABLE IF NOT EXISTS live_stoppage_periods (
  id BIGSERIAL PRIMARY KEY,
  live_event_id BIGINT NOT NULL REFERENCES live_events(id) ON DELETE CASCADE,
  half INTEGER NOT NULL CHECK (half IN (1, 2)),
  stopped_at_minute TEXT,
  resumed_at_minute TEXT,
  reason TEXT,
  duration_seconds INTEGER,
  source_key TEXT NOT NULL REFERENCES data_sources(source_key),
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS live_added_time (
  id BIGSERIAL PRIMARY KEY,
  live_event_id BIGINT NOT NULL REFERENCES live_events(id) ON DELETE CASCADE,
  half INTEGER NOT NULL CHECK (half IN (1, 2)),
  total_stopped_seconds INTEGER,
  predicted_added_seconds INTEGER,
  actual_added_minutes INTEGER,
  calculation_method TEXT,
  source_key TEXT NOT NULL REFERENCES data_sources(source_key),
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (live_event_id, half, source_key)
);

CREATE TABLE IF NOT EXISTS bookmakers (
  bookmaker_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_key TEXT NOT NULL REFERENCES data_sources(source_key),
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS odds_events (
  id BIGSERIAL PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  competition_key TEXT,
  competition_name TEXT,
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  kickoff_at TIMESTAMPTZ,
  source_key TEXT NOT NULL REFERENCES data_sources(source_key),
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS odds_markets (
  id BIGSERIAL PRIMARY KEY,
  odds_event_id BIGINT NOT NULL REFERENCES odds_events(id) ON DELETE CASCADE,
  market_key TEXT NOT NULL,
  market_name TEXT NOT NULL,
  category TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'match',
  line NUMERIC,
  side TEXT,
  selection_label TEXT NOT NULL,
  source_key TEXT NOT NULL REFERENCES data_sources(source_key),
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (odds_event_id, market_key, period, line, side, selection_label, source_key)
);

CREATE TABLE IF NOT EXISTS odds_prices (
  id BIGSERIAL PRIMARY KEY,
  odds_market_id BIGINT NOT NULL REFERENCES odds_markets(id) ON DELETE CASCADE,
  bookmaker_key TEXT NOT NULL REFERENCES bookmakers(bookmaker_key),
  odd NUMERIC NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_key TEXT NOT NULL REFERENCES data_sources(source_key),
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  UNIQUE (odds_market_id, bookmaker_key, captured_at)
);

CREATE TABLE IF NOT EXISTS odds_alerts (
  id BIGSERIAL PRIMARY KEY,
  odds_market_id BIGINT NOT NULL REFERENCES odds_markets(id) ON DELETE CASCADE,
  best_bookmaker_key TEXT NOT NULL REFERENCES bookmakers(bookmaker_key),
  best_odd NUMERIC NOT NULL,
  second_best_odd NUMERIC,
  median_odd NUMERIC,
  edge_percent NUMERIC,
  confidence TEXT,
  source_key TEXT NOT NULL REFERENCES data_sources(source_key),
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_knowledge_documents (
  id BIGSERIAL PRIMARY KEY,
  namespace TEXT NOT NULL,
  knowledge_key TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  source_key TEXT NOT NULL REFERENCES data_sources(source_key),
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (namespace, knowledge_key)
);

CREATE TABLE IF NOT EXISTS ai_response_cache (
  question_hash TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_rankings (
  id BIGSERIAL PRIMARY KEY,
  ranking_key TEXT NOT NULL UNIQUE,
  competition_key TEXT,
  period TEXT,
  metric_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  source_key TEXT NOT NULL REFERENCES data_sources(source_key),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_world_cup_players_team ON world_cup_players(team_id);
CREATE INDEX IF NOT EXISTS idx_world_cup_matches_kickoff ON world_cup_matches(kickoff_at);
CREATE INDEX IF NOT EXISTS idx_live_events_status ON live_events(status, source_updated_at);
CREATE INDEX IF NOT EXISTS idx_live_event_statistics_event ON live_event_statistics(live_event_id);
CREATE INDEX IF NOT EXISTS idx_odds_events_kickoff ON odds_events(kickoff_at);
CREATE INDEX IF NOT EXISTS idx_odds_markets_category ON odds_markets(category, period, line);
CREATE INDEX IF NOT EXISTS idx_odds_prices_market_bookmaker ON odds_prices(odds_market_id, bookmaker_key);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_namespace ON ai_knowledge_documents(namespace);

INSERT INTO data_sources (source_key, name, priority, base_url, notes)
VALUES
  ('fifa', 'FIFA Football Data Platform', 1, 'https://fdp.fifa.org', 'Fonte principal da Copa do Mundo.'),
  ('365scores', '365Scores', 2, 'https://webws.365scores.com', 'Complemento para agenda, placar, tempo real e estatisticas ao vivo.'),
  ('api-football', 'API-Football', 3, 'https://v3.football.api-sports.io', 'Complemento para odds, arbitros, estatisticas e fixtures.'),
  ('local-static', 'Arquivos locais legados', 4, NULL, 'Compatibilidade temporaria ate a migracao completa para banco.')
ON CONFLICT (source_key) DO UPDATE SET
  name = EXCLUDED.name,
  priority = EXCLUDED.priority,
  base_url = EXCLUDED.base_url,
  notes = EXCLUDED.notes,
  updated_at = NOW();

INSERT INTO competitions (competition_key, name, season, country, type, source_priority, metadata)
VALUES (
  'world_cup_2026',
  'Copa do Mundo 2026',
  '2026',
  'FIFA',
  'cup',
  '["fifa", "365scores", "api-football"]'::JSONB,
  '{"status":"prepared_for_official_updates"}'::JSONB
)
ON CONFLICT (competition_key) DO UPDATE SET
  name = EXCLUDED.name,
  season = EXCLUDED.season,
  country = EXCLUDED.country,
  type = EXCLUDED.type,
  source_priority = EXCLUDED.source_priority,
  metadata = competitions.metadata || EXCLUDED.metadata,
  updated_at = NOW();
