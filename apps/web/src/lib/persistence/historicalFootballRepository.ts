import sql from '@/app/api/utils/sql';
import { assertPersistentDatabaseConfigured } from './database';
import type { UnifiedMatchStatistics } from '@/lib/statistics/matchStatisticsEngine';

export type HistoricalMatchInput = {
  fixtureId: string;
  competitionKey?: string | null;
  competitionName?: string | null;
  season?: string | null;
  roundName?: string | null;
  status: string;
  kickoffAt?: string | null;
  venue?: string | null;
  referee?: string | null;
  home: { id: string; name: string; logo?: string | null; country?: string | null; score?: number | null };
  away: { id: string; name: string; logo?: string | null; country?: string | null; score?: number | null };
  sourcePayload?: unknown;
};

function teamKey(id: string, name: string) {
  return id ? `api-football:${id}` : `name:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function splitValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return { numeric: value, text: null };
  if (typeof value === 'string') {
    const parsed = Number(value.replace('%', '').replace(',', '.'));
    if (Number.isFinite(parsed)) return { numeric: parsed, text: value };
    return { numeric: null, text: value };
  }
  return { numeric: null, text: null };
}

async function upsertTeam(team: HistoricalMatchInput['home']) {
  const key = teamKey(team.id, team.name);
  await sql`
    INSERT INTO football_teams (team_key, api_football_team_id, name, country, logo_url, metadata)
    VALUES (${key}, ${team.id || null}, ${team.name}, ${team.country ?? null}, ${team.logo ?? null}, ${JSON.stringify({})}::jsonb)
    ON CONFLICT (team_key) DO UPDATE SET
      name = EXCLUDED.name,
      country = COALESCE(EXCLUDED.country, football_teams.country),
      logo_url = COALESCE(EXCLUDED.logo_url, football_teams.logo_url),
      updated_at = NOW()
  `;
  return key;
}

export async function persistHistoricalMatch(match: HistoricalMatchInput, data: UnifiedMatchStatistics) {
  assertPersistentDatabaseConfigured();
  const homeKey = await upsertTeam(match.home);
  const awayKey = await upsertTeam(match.away);

  const saved = await sql`
    INSERT INTO football_matches (
      fixture_id, competition_key, competition_name, season, round_name, status, kickoff_at,
      venue, referee, home_team_key, away_team_key, home_score, away_score, source_payload
    ) VALUES (
      ${match.fixtureId}, ${match.competitionKey ?? null}, ${match.competitionName ?? null}, ${match.season ?? null},
      ${match.roundName ?? null}, ${match.status}, ${match.kickoffAt ?? null}, ${match.venue ?? null}, ${match.referee ?? null},
      ${homeKey}, ${awayKey}, ${match.home.score ?? null}, ${match.away.score ?? null}, ${JSON.stringify(match.sourcePayload ?? {})}::jsonb
    )
    ON CONFLICT (fixture_id) DO UPDATE SET
      competition_key = EXCLUDED.competition_key,
      competition_name = EXCLUDED.competition_name,
      season = EXCLUDED.season,
      round_name = EXCLUDED.round_name,
      status = EXCLUDED.status,
      kickoff_at = EXCLUDED.kickoff_at,
      venue = EXCLUDED.venue,
      referee = EXCLUDED.referee,
      home_score = EXCLUDED.home_score,
      away_score = EXCLUDED.away_score,
      source_payload = EXCLUDED.source_payload,
      imported_at = NOW(),
      updated_at = NOW()
    RETURNING id
  `;
  const matchId = Number(saved[0].id);
  const keyByTeamId = new Map([[match.home.id, homeKey], [match.away.id, awayKey]]);

  for (const team of data.teams) {
    const key = keyByTeamId.get(team.teamId) ?? (team.teamName === match.home.name ? homeKey : awayKey);
    const side = key === homeKey ? 'home' : 'away';
    for (const [metricKey, value] of Object.entries(team.values)) {
      const { numeric, text } = splitValue(value);
      await sql`
        INSERT INTO football_match_statistics (match_id, team_key, team_side, metric_key, value_numeric, value_text, source_payload)
        VALUES (${matchId}, ${key}, ${side}, ${metricKey}, ${numeric}, ${text}, ${JSON.stringify({ value })}::jsonb)
        ON CONFLICT (match_id, team_key, period, metric_key, source_key) DO UPDATE SET
          value_numeric = EXCLUDED.value_numeric,
          value_text = EXCLUDED.value_text,
          source_payload = EXCLUDED.source_payload,
          updated_at = NOW()
      `;
    }
  }

  await sql`DELETE FROM football_match_events WHERE match_id = ${matchId}`;
  for (const [index, event] of data.events.entries()) {
    const key = event.teamId ? keyByTeamId.get(event.teamId) ?? null : null;
    await sql`
      INSERT INTO football_match_events (
        match_id, sequence_no, team_key, minute, extra_minute, event_type, detail, player_name, assist_name, comments, source_payload
      ) VALUES (
        ${matchId}, ${index + 1}, ${key}, ${event.minute ?? null}, ${event.extraMinute ?? null}, ${event.type},
        ${event.detail ?? null}, ${event.player ?? null}, ${event.assist ?? null}, ${event.comments ?? null}, ${JSON.stringify(event)}::jsonb
      )
    `;
  }

  for (const lineup of data.lineups) {
    const key = keyByTeamId.get(lineup.teamId) ?? (lineup.teamName === match.home.name ? homeKey : awayKey);
    await sql`
      INSERT INTO football_match_lineups (match_id, team_key, formation, coach_name, starters, substitutes, source_payload)
      VALUES (${matchId}, ${key}, ${lineup.formation ?? null}, ${lineup.coach ?? null}, ${JSON.stringify(lineup.starters)}::jsonb, ${JSON.stringify(lineup.substitutes)}::jsonb, ${JSON.stringify(lineup)}::jsonb)
      ON CONFLICT (match_id, team_key) DO UPDATE SET
        formation = EXCLUDED.formation,
        coach_name = EXCLUDED.coach_name,
        starters = EXCLUDED.starters,
        substitutes = EXCLUDED.substitutes,
        source_payload = EXCLUDED.source_payload
    `;
  }

  return { matchId, fixtureId: match.fixtureId, statistics: data.teams.length, events: data.events.length, lineups: data.lineups.length };
}
