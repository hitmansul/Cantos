import sql from '@/app/api/utils/sql';
import { assertPersistentDatabaseConfigured } from './database';

export type LiveEventSnapshot = {
  eventKey: string;
  competitionKey?: string | null;
  competitionName?: string | null;
  sourceKey: '365scores' | 'api-football' | 'fifa';
  scores365EventId?: string | null;
  apiFootballFixtureId?: string | null;
  fifaMatchId?: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number | null;
  awayScore?: number | null;
  status?: string | null;
  matchMinute?: string | null;
  kickoffAt?: string | null;
  payload?: Record<string, unknown>;
  sourceUpdatedAt?: string | null;
};

export async function upsertLiveEvent(snapshot: LiveEventSnapshot): Promise<number> {
  assertPersistentDatabaseConfigured();
  const rows = await sql`
    INSERT INTO live_events (
      event_key,
      competition_key,
      competition_name,
      source_key,
      scores365_event_id,
      api_football_fixture_id,
      fifa_match_id,
      home_team_name,
      away_team_name,
      home_score,
      away_score,
      status,
      match_minute,
      kickoff_at,
      source_payload,
      source_updated_at
    )
    VALUES (
      ${snapshot.eventKey},
      ${snapshot.competitionKey ?? null},
      ${snapshot.competitionName ?? null},
      ${snapshot.sourceKey},
      ${snapshot.scores365EventId ?? null},
      ${snapshot.apiFootballFixtureId ?? null},
      ${snapshot.fifaMatchId ?? null},
      ${snapshot.homeTeamName},
      ${snapshot.awayTeamName},
      ${snapshot.homeScore ?? null},
      ${snapshot.awayScore ?? null},
      ${snapshot.status ?? null},
      ${snapshot.matchMinute ?? null},
      ${snapshot.kickoffAt ?? null},
      ${JSON.stringify(snapshot.payload ?? {})}::jsonb,
      ${snapshot.sourceUpdatedAt ?? null}
    )
    ON CONFLICT (event_key) DO UPDATE SET
      competition_key = EXCLUDED.competition_key,
      competition_name = EXCLUDED.competition_name,
      source_key = EXCLUDED.source_key,
      scores365_event_id = EXCLUDED.scores365_event_id,
      api_football_fixture_id = EXCLUDED.api_football_fixture_id,
      fifa_match_id = EXCLUDED.fifa_match_id,
      home_team_name = EXCLUDED.home_team_name,
      away_team_name = EXCLUDED.away_team_name,
      home_score = EXCLUDED.home_score,
      away_score = EXCLUDED.away_score,
      status = EXCLUDED.status,
      match_minute = EXCLUDED.match_minute,
      kickoff_at = EXCLUDED.kickoff_at,
      source_payload = EXCLUDED.source_payload,
      source_updated_at = EXCLUDED.source_updated_at,
      updated_at = NOW()
    RETURNING id
  `;
  return Number(rows[0]?.id);
}
