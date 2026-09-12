import { liveSql as sql } from '@/app/api/utils/sql';
let ready:Promise<unknown>|null=null;
/** Additive schema: legacy recommendation records remain untouched and excluded from v2 metrics. */
export function ensureLiveSchema(){
  if(!ready)ready=sql.transaction(q=>[
    q`CREATE TABLE IF NOT EXISTS live_engine_matches (event_key TEXT PRIMARY KEY, match_data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    q`CREATE TABLE IF NOT EXISTS live_engine_snapshots (id BIGSERIAL PRIMARY KEY,event_key TEXT NOT NULL,captured_at TIMESTAMPTZ NOT NULL,snapshot_data JSONB NOT NULL,UNIQUE(event_key,captured_at))`,
    q`CREATE INDEX IF NOT EXISTS live_engine_snapshots_time_idx ON live_engine_snapshots(captured_at)`,
    q`CREATE INDEX IF NOT EXISTS live_engine_matches_time_idx ON live_engine_matches(updated_at)`,
    q`CREATE TABLE IF NOT EXISTS live_engine_aliases (alias TEXT PRIMARY KEY,event_key TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    q`CREATE INDEX IF NOT EXISTS live_engine_aliases_key_idx ON live_engine_aliases(event_key)`,
    q`CREATE INDEX IF NOT EXISTS live_engine_aliases_time_idx ON live_engine_aliases(updated_at)`,
    q`CREATE TABLE IF NOT EXISTS live_engine_control (id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT,lease_until TIMESTAMPTZ,last_success_at TIMESTAMPTZ,last_attempt_at TIMESTAMPTZ,last_error TEXT,source_status JSONB)`,
    q`INSERT INTO live_engine_control(id) VALUES(1) ON CONFLICT DO NOTHING`,
    q`CREATE TABLE IF NOT EXISTS live_recommendations_v2 (
      evaluation_key TEXT PRIMARY KEY,event_key TEXT NOT NULL,fixture TEXT NOT NULL,competition TEXT,
      model_version TEXT NOT NULL,protocol_version TEXT NOT NULL,decision TEXT NOT NULL,
      score INTEGER NOT NULL,probability INTEGER,pressure INTEGER,speed INTEGER,confidence TEXT NOT NULL,
      match_minute INTEGER NOT NULL,corners_before INTEGER NOT NULL,stats_source TEXT NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL,inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      input_data JSONB NOT NULL,assessment JSONB NOT NULL,
      outcome_5m TEXT NOT NULL DEFAULT 'pending',outcome_10m TEXT NOT NULL DEFAULT 'pending',
      evidence JSONB,resolved_at TIMESTAMPTZ,
      CHECK(outcome_5m IN ('pending','hit','miss','inconclusive')),
      CHECK(outcome_10m IN ('pending','hit','miss','inconclusive'))
    )`,
    q`CREATE INDEX IF NOT EXISTS live_recommendations_v2_pending_idx ON live_recommendations_v2(recorded_at,event_key) WHERE resolved_at IS NULL`,
    q`CREATE INDEX IF NOT EXISTS live_recommendations_v2_time_idx ON live_recommendations_v2(recorded_at)`
  ]).catch(error=>{ready=null;throw error;});
  return ready;
}
