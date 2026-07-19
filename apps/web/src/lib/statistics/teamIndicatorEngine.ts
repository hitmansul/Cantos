import sql from '@/app/api/utils/sql';
import { assertPersistentDatabaseConfigured } from '@/lib/persistence/database';

type VenueScope = 'all' | 'home' | 'away';
type MatchRow = {
  id: number;
  kickoff_at: string | null;
  home_team_key: string;
  away_team_key: string;
  home_score: number | null;
  away_score: number | null;
};

type StatRow = {
  match_id: number;
  team_key: string;
  metric_key: string;
  value_numeric: number | string | null;
};

const WINDOWS = [5, 10, 20, 0] as const;
const SCOPES: VenueScope[] = ['all', 'home', 'away'];
const OVER_LINES = [7.5, 8.5, 9.5, 10.5, 11.5, 12.5];

const METRIC_ALIASES: Record<string, string[]> = {
  corners: ['corner_kicks', 'corners', 'corner'],
  shots: ['total_shots', 'shots'],
  shots_on_target: ['shots_on_goal', 'shots_on_target'],
  possession: ['ball_possession', 'possession'],
  yellow_cards: ['yellow_cards', 'yellowcards'],
  red_cards: ['red_cards', 'redcards'],
  fouls: ['fouls'],
  xg: ['expected_goals', 'xg'],
};

function normalizeMetric(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function canonicalMetric(metricKey: string): string | null {
  const normalized = normalizeMetric(metricKey);
  for (const [canonical, aliases] of Object.entries(METRIC_ALIASES)) {
    if (aliases.includes(normalized)) return canonical;
  }
  return null;
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]) {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

export async function recalculateTeamIndicators(competitionKey: string, season: string) {
  assertPersistentDatabaseConfigured();

  const matches = await sql`
    SELECT id, kickoff_at, home_team_key, away_team_key, home_score, away_score
    FROM football_matches
    WHERE competition_key = ${competitionKey}
      AND season = ${season}
      AND status IN ('FT', 'AET', 'PEN')
    ORDER BY kickoff_at DESC NULLS LAST, id DESC
  ` as unknown as MatchRow[];

  if (!matches.length) {
    return { competitionKey, season, teams: 0, indicators: 0 };
  }

  const stats = await sql`
    SELECT s.match_id, s.team_key, s.metric_key, s.value_numeric
    FROM football_match_statistics s
    JOIN football_matches m ON m.id = s.match_id
    WHERE m.competition_key = ${competitionKey}
      AND m.season = ${season}
      AND m.status IN ('FT', 'AET', 'PEN')
  ` as unknown as StatRow[];

  const statsByMatchTeam = new Map<string, Record<string, number>>();
  for (const row of stats) {
    const canonical = canonicalMetric(row.metric_key);
    if (!canonical) continue;
    const key = `${row.match_id}:${row.team_key}`;
    const bucket = statsByMatchTeam.get(key) ?? {};
    bucket[canonical] = numeric(row.value_numeric);
    statsByMatchTeam.set(key, bucket);
  }

  const teamKeys = [...new Set(matches.flatMap((match) => [match.home_team_key, match.away_team_key]))];
  let saved = 0;

  for (const teamKey of teamKeys) {
    for (const scope of SCOPES) {
      const scopedMatches = matches.filter((match) => {
        if (scope === 'home') return match.home_team_key === teamKey;
        if (scope === 'away') return match.away_team_key === teamKey;
        return match.home_team_key === teamKey || match.away_team_key === teamKey;
      });

      for (const windowSize of WINDOWS) {
        const selected = windowSize === 0 ? scopedMatches : scopedMatches.slice(0, windowSize);
        if (!selected.length) continue;

        const rows = selected.map((match) => {
          const isHome = match.home_team_key === teamKey;
          const opponentKey = isHome ? match.away_team_key : match.home_team_key;
          const own = statsByMatchTeam.get(`${match.id}:${teamKey}`) ?? {};
          const opponent = statsByMatchTeam.get(`${match.id}:${opponentKey}`) ?? {};
          const goalsFor = numeric(isHome ? match.home_score : match.away_score);
          const goalsAgainst = numeric(isHome ? match.away_score : match.home_score);
          return { own, opponent, goalsFor, goalsAgainst };
        });

        const averages: Record<string, number> = {
          corners_for: mean(rows.map((row) => row.own.corners ?? 0)),
          corners_against: mean(rows.map((row) => row.opponent.corners ?? 0)),
          corners_total: mean(rows.map((row) => (row.own.corners ?? 0) + (row.opponent.corners ?? 0))),
          shots_for: mean(rows.map((row) => row.own.shots ?? 0)),
          shots_against: mean(rows.map((row) => row.opponent.shots ?? 0)),
          shots_on_target_for: mean(rows.map((row) => row.own.shots_on_target ?? 0)),
          possession: mean(rows.map((row) => row.own.possession ?? 0)),
          yellow_cards: mean(rows.map((row) => row.own.yellow_cards ?? 0)),
          red_cards: mean(rows.map((row) => row.own.red_cards ?? 0)),
          fouls: mean(rows.map((row) => row.own.fouls ?? 0)),
          xg_for: mean(rows.map((row) => row.own.xg ?? 0)),
          xg_against: mean(rows.map((row) => row.opponent.xg ?? 0)),
          goals_for: mean(rows.map((row) => row.goalsFor)),
          goals_against: mean(rows.map((row) => row.goalsAgainst)),
        };

        const rates: Record<string, number> = {
          wins: round(rows.filter((row) => row.goalsFor > row.goalsAgainst).length / rows.length * 100, 1),
          draws: round(rows.filter((row) => row.goalsFor === row.goalsAgainst).length / rows.length * 100, 1),
          losses: round(rows.filter((row) => row.goalsFor < row.goalsAgainst).length / rows.length * 100, 1),
          btts: round(rows.filter((row) => row.goalsFor > 0 && row.goalsAgainst > 0).length / rows.length * 100, 1),
          clean_sheets: round(rows.filter((row) => row.goalsAgainst === 0).length / rows.length * 100, 1),
        };

        for (const line of OVER_LINES) {
          rates[`corners_over_${String(line).replace('.', '_')}`] = round(
            rows.filter((row) => (row.own.corners ?? 0) + (row.opponent.corners ?? 0) > line).length / rows.length * 100,
            1,
          );
        }

        await sql`
          INSERT INTO football_team_indicators (
            team_key, competition_key, season, venue_scope, sample_size, window_size, averages, rates, calculated_at
          ) VALUES (
            ${teamKey}, ${competitionKey}, ${season}, ${scope}, ${rows.length}, ${windowSize},
            ${JSON.stringify(averages)}::jsonb, ${JSON.stringify(rates)}::jsonb, NOW()
          )
          ON CONFLICT (team_key, competition_key, season, venue_scope, window_size) DO UPDATE SET
            sample_size = EXCLUDED.sample_size,
            averages = EXCLUDED.averages,
            rates = EXCLUDED.rates,
            calculated_at = NOW()
        `;
        saved += 1;
      }
    }
  }

  return { competitionKey, season, teams: teamKeys.length, indicators: saved };
}
