-- IA Cantos decision warehouse.
-- Stores every model decision, market offer and verified outcome for audit,
-- backtesting, calibration and future model promotion.
-- Idempotent and compatible with Neon/Postgres.

CREATE TABLE IF NOT EXISTS ai_model_versions (
  model_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'experimental'
    CHECK (status IN ('experimental', 'challenger', 'production', 'retired')),
  parameters JSONB NOT NULL DEFAULT '{}'::JSONB,
  notes TEXT,
  promoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_prediction_runs (
  id BIGSERIAL PRIMARY KEY,
  prediction_key TEXT NOT NULL UNIQUE,
  model_key TEXT NOT NULL REFERENCES ai_model_versions(model_key),
  fixture_key TEXT,
  competition_key TEXT,
  competition_name TEXT,
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  kickoff_at TIMESTAMPTZ,
  expected_home_corners NUMERIC NOT NULL,
  expected_away_corners NUMERIC NOT NULL,
  expected_total_corners NUMERIC NOT NULL,
  projected_low NUMERIC,
  projected_high NUMERIC,
  score_ia NUMERIC NOT NULL,
  confidence_score NUMERIC NOT NULL,
  confidence_label TEXT,
  volatility NUMERIC,
  sample_size INTEGER NOT NULL DEFAULT 0,
  decision TEXT NOT NULL,
  decision_reason TEXT,
  summary TEXT,
  risk_profile TEXT,
  bankroll NUMERIC,
  factors JSONB NOT NULL DEFAULT '{}'::JSONB,
  scenarios JSONB NOT NULL DEFAULT '[]'::JSONB,
  request_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  response_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_prediction_offers (
  id BIGSERIAL PRIMARY KEY,
  prediction_run_id BIGINT NOT NULL REFERENCES ai_prediction_runs(id) ON DELETE CASCADE,
  bookmaker TEXT NOT NULL,
  market_category TEXT NOT NULL DEFAULT 'corners',
  period TEXT NOT NULL DEFAULT 'match',
  line NUMERIC NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('over', 'under')),
  odd NUMERIC NOT NULL,
  model_probability NUMERIC NOT NULL,
  fair_odd NUMERIC NOT NULL,
  expected_value NUMERIC NOT NULL,
  edge NUMERIC NOT NULL,
  is_value_bet BOOLEAN NOT NULL DEFAULT FALSE,
  rating TEXT,
  kelly_fraction NUMERIC NOT NULL DEFAULT 0,
  recommended_stake_percent NUMERIC NOT NULL DEFAULT 0,
  recommended_stake NUMERIC,
  risk_level TEXT,
  explanation TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (prediction_run_id, bookmaker, line, side, odd)
);

CREATE TABLE IF NOT EXISTS ai_prediction_outcomes (
  prediction_run_id BIGINT PRIMARY KEY REFERENCES ai_prediction_runs(id) ON DELETE CASCADE,
  home_corners INTEGER,
  away_corners INTEGER,
  total_corners INTEGER,
  match_status TEXT NOT NULL DEFAULT 'pending',
  settled_at TIMESTAMPTZ,
  source_key TEXT,
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_offer_settlements (
  prediction_offer_id BIGINT PRIMARY KEY REFERENCES ai_prediction_offers(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK (result IN ('win', 'loss', 'push', 'void', 'pending')),
  profit_units NUMERIC,
  closing_odd NUMERIC,
  closing_line NUMERIC,
  closing_line_value NUMERIC,
  settled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_model_metrics_daily (
  id BIGSERIAL PRIMARY KEY,
  model_key TEXT NOT NULL REFERENCES ai_model_versions(model_key),
  metric_date DATE NOT NULL,
  competition_key TEXT NOT NULL DEFAULT 'all',
  market_key TEXT NOT NULL DEFAULT 'all',
  predictions INTEGER NOT NULL DEFAULT 0,
  settled_predictions INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  pushes INTEGER NOT NULL DEFAULT 0,
  stake_units NUMERIC NOT NULL DEFAULT 0,
  profit_units NUMERIC NOT NULL DEFAULT 0,
  roi_percent NUMERIC,
  hit_rate_percent NUMERIC,
  average_expected_value NUMERIC,
  average_closing_line_value NUMERIC,
  maximum_drawdown_units NUMERIC,
  calibration_error NUMERIC,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (model_key, metric_date, competition_key, market_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_prediction_runs_created
  ON ai_prediction_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_prediction_runs_fixture
  ON ai_prediction_runs(fixture_key, model_key);
CREATE INDEX IF NOT EXISTS idx_ai_prediction_runs_competition
  ON ai_prediction_runs(competition_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_prediction_runs_score
  ON ai_prediction_runs(score_ia DESC, confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_prediction_offers_value
  ON ai_prediction_offers(is_value_bet, expected_value DESC);
CREATE INDEX IF NOT EXISTS idx_ai_prediction_outcomes_status
  ON ai_prediction_outcomes(match_status, settled_at);
CREATE INDEX IF NOT EXISTS idx_ai_model_metrics_lookup
  ON ai_model_metrics_daily(model_key, metric_date DESC);

INSERT INTO ai_model_versions (
  model_key,
  name,
  version,
  status,
  parameters,
  notes
)
VALUES (
  'corners-statistical-v4',
  'Motor Estatístico Explicável de Escanteios',
  '4.0.0',
  'production',
  '{"market":"corners","engine":"statistical","kellyMode":"fractional"}'::JSONB,
  'Modelo de produção existente no momento da criação do Decision Warehouse.'
)
ON CONFLICT (model_key) DO UPDATE SET
  name = EXCLUDED.name,
  version = EXCLUDED.version,
  updated_at = NOW();