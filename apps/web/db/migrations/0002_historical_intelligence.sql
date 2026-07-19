-- Historical football intelligence foundation.
-- Idempotent migration for serverless Postgres.

CREATE TABLE IF NOT EXISTS football_teams (
  team_key TEXT PRIMARY KEY,
  api_football_team_id TEXT UNIQUE,
  name TEXT NOT NULL,
  country TEXT,
  logo_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS football_matches (
  id BIGSERIAL PRIMARY KEY,
  fixture_id TEXT NOT NULL UNIQUE,
  competition_key TEXT,
  competition_name TEXT,
  season TEXT,
  round_name TEXT,
  status TEXT NOT NULL,
  kickoff_at TIMESTAMPTZ,
  venue TEXT,
  referee TEXT,
  home_team_key TEXT NOT NULL REFERENCES football_teams(team_key),
  away_team_key TEXT NOT NULL REFERENCES football_teams(team_key),
  home_score INTEGER,
  away_score INTEGER,
  source_key TEXT NOT NULL DEFAULT 'api-football' REFERENCES data_sources(source_key),
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS football_match_statistics (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES football_matches(id) ON DELETE CASCADE,
  team_key TEXT NOT NULL REFERENCES football_teams(team_key),
  team_side TEXT NOT NULL CHECK (team_side IN ('home', 'away')),
  period TEXT NOT NULL DEFAULT 'match',
  metric_key TEXT NOT NULL,
  value_numeric NUMERIC,
  value_text TEXT,
  source_key TEXT NOT NULL DEFAULT 'api-football' REFERENCES data_sources(source_key),
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, team_key, period, metric_key, source_key)
);

CREATE TABLE IF NOT EXISTS football_match_events (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES football_matches(id) ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL,
  team_key TEXT REFERENCES football_teams(team_key),
  minute INTEGER,
  extra_minute INTEGER,
  event_type TEXT NOT NULL,
  detail TEXT,
  player_name TEXT,
  assist_name TEXT,
  comments TEXT,
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  UNIQUE (match_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS football_match_lineups (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES football_matches(id) ON DELETE CASCADE,
  team_key TEXT NOT NULL REFERENCES football_teams(team_key),
  formation TEXT,
  coach_name TEXT,
  starters JSONB NOT NULL DEFAULT '[]'::JSONB,
  substitutes JSONB NOT NULL DEFAULT '[]'::JSONB,
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  UNIQUE (match_id, team_key)
);

CREATE TABLE IF NOT EXISTS football_team_indicators (
  id BIGSERIAL PRIMARY KEY,
  team_key TEXT NOT NULL REFERENCES football_teams(team_key) ON DELETE CASCADE,
  competition_key TEXT,
  season TEXT,
  venue_scope TEXT NOT NULL DEFAULT 'all' CHECK (venue_scope IN ('all', 'home', 'away')),
  sample_size INTEGER NOT NULL,
  window_size INTEGER NOT NULL,
  averages JSONB NOT NULL DEFAULT '{}'::JSONB,
  rates JSONB NOT NULL DEFAULT '{}'::JSONB,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_key, competition_key, season, venue_scope, window_size)
);

CREATE INDEX IF NOT EXISTS idx_football_matches_kickoff ON football_matches(kickoff_at DESC);
CREATE INDEX IF NOT EXISTS idx_football_matches_competition ON football_matches(competition_key, season, kickoff_at DESC);
CREATE INDEX IF NOT EXISTS idx_football_match_statistics_metric ON football_match_statistics(team_key, metric_key, match_id);
CREATE INDEX IF NOT EXISTS idx_football_team_indicators_lookup ON football_team_indicators(team_key, competition_key, season, venue_scope, window_size);
