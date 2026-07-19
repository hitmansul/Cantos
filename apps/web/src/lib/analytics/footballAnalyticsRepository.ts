import sql from '@/app/api/utils/sql';
import { assertPersistentDatabaseConfigured } from '@/lib/persistence/database';

export type VenueScope = 'all' | 'home' | 'away';
export type IndicatorRow = {
  team_key: string;
  name: string;
  logo_url: string | null;
  country: string | null;
  competition_key: string | null;
  season: string | null;
  venue_scope: VenueScope;
  sample_size: number;
  window_size: number;
  averages: Record<string, number>;
  rates: Record<string, number>;
  calculated_at: string;
};

const AVERAGE_METRICS = new Set([
  'corners_for', 'corners_against', 'corners_total', 'shots_for', 'shots_against',
  'shots_on_target_for', 'possession', 'yellow_cards', 'red_cards', 'fouls',
  'xg_for', 'xg_against', 'goals_for', 'goals_against',
]);

const RATE_METRICS = new Set([
  'wins', 'draws', 'losses', 'btts', 'clean_sheets',
  'corners_over_7_5', 'corners_over_8_5', 'corners_over_9_5',
  'corners_over_10_5', 'corners_over_11_5', 'corners_over_12_5',
]);

export function normalizeCompetitionKey(value: string | null) {
  if (!value) return null;
  return /^\d+$/.test(value) ? `api-football:${value}` : value;
}

export function validateMetric(metric: string) {
  if (AVERAGE_METRICS.has(metric)) return { bucket: 'averages' as const, metric };
  if (RATE_METRICS.has(metric)) return { bucket: 'rates' as const, metric };
  return null;
}

export async function getRankings(input: {
  competitionKey: string;
  season: string;
  metric: string;
  venueScope: VenueScope;
  windowSize: number;
  limit: number;
}) {
  assertPersistentDatabaseConfigured();
  const metric = validateMetric(input.metric);
  if (!metric) throw new Error('Métrica não suportada');
  const rows = await sql`
    SELECT i.team_key, t.name, t.logo_url, t.country, i.sample_size,
      CASE WHEN ${metric.bucket} = 'averages'
        THEN NULLIF(i.averages ->> ${metric.metric}, '')::numeric
        ELSE NULLIF(i.rates ->> ${metric.metric}, '')::numeric
      END AS value
    FROM football_team_indicators i
    JOIN football_teams t ON t.team_key = i.team_key
    WHERE i.competition_key = ${input.competitionKey}
      AND i.season = ${input.season}
      AND i.venue_scope = ${input.venueScope}
      AND i.window_size = ${input.windowSize}
      AND (CASE WHEN ${metric.bucket} = 'averages'
        THEN i.averages ? ${metric.metric}
        ELSE i.rates ? ${metric.metric}
      END)
    ORDER BY value DESC NULLS LAST, t.name ASC
    LIMIT ${input.limit}
  `;
  return rows.map((row, index) => ({
    position: index + 1,
    teamKey: String(row.team_key),
    team: String(row.name),
    logo: row.logo_url ? String(row.logo_url) : null,
    country: row.country ? String(row.country) : null,
    sampleSize: Number(row.sample_size),
    value: Number(row.value),
  }));
}

export async function searchTeams(query: string, limit = 10) {
  assertPersistentDatabaseConfigured();
  const term = `%${query.trim()}%`;
  return sql`
    SELECT team_key, name, country, logo_url
    FROM football_teams
    WHERE name ILIKE ${term}
    ORDER BY CASE WHEN name ILIKE ${query.trim()} THEN 0 ELSE 1 END, name ASC
    LIMIT ${limit}
  `;
}

export async function getTeamProfile(input: {
  teamKey?: string | null;
  teamName?: string | null;
  competitionKey?: string | null;
  season?: string | null;
}) {
  assertPersistentDatabaseConfigured();
  const teams = input.teamKey
    ? await sql`SELECT team_key, name, country, logo_url FROM football_teams WHERE team_key = ${input.teamKey} LIMIT 1`
    : await sql`SELECT team_key, name, country, logo_url FROM football_teams WHERE name ILIKE ${input.teamName ?? ''} ORDER BY name LIMIT 1`;
  const team = teams[0];
  if (!team) return null;

  const indicators = await sql`
    SELECT team_key, competition_key, season, venue_scope, sample_size, window_size, averages, rates, calculated_at
    FROM football_team_indicators
    WHERE team_key = ${String(team.team_key)}
      AND (${input.competitionKey ?? null}::text IS NULL OR competition_key = ${input.competitionKey ?? null})
      AND (${input.season ?? null}::text IS NULL OR season = ${input.season ?? null})
    ORDER BY season DESC NULLS LAST, competition_key, venue_scope, window_size
  `;

  return {
    teamKey: String(team.team_key),
    name: String(team.name),
    country: team.country ? String(team.country) : null,
    logo: team.logo_url ? String(team.logo_url) : null,
    indicators: indicators.map((row) => ({
      competitionKey: row.competition_key ? String(row.competition_key) : null,
      season: row.season ? String(row.season) : null,
      venueScope: String(row.venue_scope),
      sampleSize: Number(row.sample_size),
      windowSize: Number(row.window_size),
      averages: row.averages ?? {},
      rates: row.rates ?? {},
      calculatedAt: String(row.calculated_at),
    })),
  };
}
