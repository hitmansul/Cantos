import sql from '@/app/api/utils/sql';
import { assertPersistentDatabaseConfigured } from '@/lib/persistence/database';

type Indicator = {
  venue_scope: 'all' | 'home' | 'away';
  window_size: number;
  sample_size: number;
  averages: Record<string, number>;
  rates: Record<string, number>;
};

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function pick(rows: Indicator[], scope: Indicator['venue_scope'], window: number) {
  return rows.find((row) => row.venue_scope === scope && row.window_size === window) ?? null;
}

function momentum(indicator: Indicator | null) {
  if (!indicator) return 0;
  const a = indicator.averages ?? {};
  const r = indicator.rates ?? {};
  return clamp(
    number(r.wins) * 0.45 +
    Math.max(0, 50 + (number(a.goals_for) - number(a.goals_against)) * 15) * 0.25 +
    Math.min(100, number(a.xg_for) * 35) * 0.15 +
    Math.min(100, number(a.corners_for) * 10) * 0.15,
  );
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export async function getMatchIntelligence(fixtureId: string) {
  assertPersistentDatabaseConfigured();

  const fixtures = await sql`
    SELECT m.*, ht.name AS home_name, ht.logo_url AS home_logo,
      at.name AS away_name, at.logo_url AS away_logo
    FROM football_matches m
    JOIN football_teams ht ON ht.team_key = m.home_team_key
    JOIN football_teams at ON at.team_key = m.away_team_key
    WHERE m.fixture_id = ${fixtureId}
    LIMIT 1
  `;
  const fixture = fixtures[0];
  if (!fixture) return null;

  const indicators = await sql`
    SELECT team_key, venue_scope, window_size, sample_size, averages, rates
    FROM football_team_indicators
    WHERE team_key IN (${String(fixture.home_team_key)}, ${String(fixture.away_team_key)})
      AND competition_key = ${fixture.competition_key}
      AND season = ${fixture.season}
  ` as unknown as Array<Indicator & { team_key: string }>;

  const homeRows = indicators.filter((row) => row.team_key === String(fixture.home_team_key));
  const awayRows = indicators.filter((row) => row.team_key === String(fixture.away_team_key));
  const homeRecent = pick(homeRows, 'all', 10) ?? pick(homeRows, 'all', 5) ?? pick(homeRows, 'all', 0);
  const awayRecent = pick(awayRows, 'all', 10) ?? pick(awayRows, 'all', 5) ?? pick(awayRows, 'all', 0);
  const homeVenue = pick(homeRows, 'home', 10) ?? pick(homeRows, 'home', 0) ?? homeRecent;
  const awayVenue = pick(awayRows, 'away', 10) ?? pick(awayRows, 'away', 0) ?? awayRecent;

  const h2h = await sql`
    SELECT id, fixture_id, kickoff_at, home_team_key, away_team_key, home_score, away_score
    FROM football_matches
    WHERE status IN ('FT', 'AET', 'PEN')
      AND ((home_team_key = ${String(fixture.home_team_key)} AND away_team_key = ${String(fixture.away_team_key)})
        OR (home_team_key = ${String(fixture.away_team_key)} AND away_team_key = ${String(fixture.home_team_key)}))
      AND fixture_id <> ${fixtureId}
    ORDER BY kickoff_at DESC NULLS LAST
    LIMIT 5
  `;

  const h2hIds = h2h.map((row) => Number(row.id));
  const h2hStats = h2hIds.length ? await sql`
    SELECT match_id, metric_key, SUM(COALESCE(value_numeric, 0)) AS total
    FROM football_match_statistics
    WHERE match_id = ANY(${h2hIds}::bigint[])
      AND metric_key IN ('corner_kicks', 'corners', 'yellow_cards', 'red_cards')
    GROUP BY match_id, metric_key
  ` : [];

  const statByMatch = new Map<number, Record<string, number>>();
  for (const row of h2hStats) {
    const bucket = statByMatch.get(Number(row.match_id)) ?? {};
    bucket[String(row.metric_key)] = number(row.total);
    statByMatch.set(Number(row.match_id), bucket);
  }

  const h2hSummary = {
    matches: h2h.length,
    averageGoals: average(h2h.map((row) => number(row.home_score) + number(row.away_score))),
    averageCorners: average(h2h.map((row) => {
      const stats = statByMatch.get(Number(row.id)) ?? {};
      return number(stats.corner_kicks ?? stats.corners);
    })),
    averageCards: average(h2h.map((row) => {
      const stats = statByMatch.get(Number(row.id)) ?? {};
      return number(stats.yellow_cards) + number(stats.red_cards);
    })),
    bttsRate: h2h.length ? h2h.filter((row) => number(row.home_score) > 0 && number(row.away_score) > 0).length / h2h.length * 100 : 0,
  };

  const homeMomentum = momentum(homeRecent);
  const awayMomentum = momentum(awayRecent);
  const cornerProbability = clamp(average([
    number(homeRecent?.rates?.corners_over_9_5),
    number(awayRecent?.rates?.corners_over_9_5),
    number(homeVenue?.rates?.corners_over_9_5),
    number(awayVenue?.rates?.corners_over_9_5),
    h2hSummary.matches ? (h2h.filter((row) => {
      const stats = statByMatch.get(Number(row.id)) ?? {};
      return number(stats.corner_kicks ?? stats.corners) > 9.5;
    }).length / h2hSummary.matches * 100) : 0,
  ].filter((value) => value > 0)));

  const bttsProbability = clamp(average([
    number(homeRecent?.rates?.btts),
    number(awayRecent?.rates?.btts),
    h2hSummary.bttsRate,
  ].filter((value) => value > 0)));

  const confidence = clamp(50 + Math.min(30, average([
    number(homeRecent?.sample_size), number(awayRecent?.sample_size),
    number(homeVenue?.sample_size), number(awayVenue?.sample_size),
  ]) * 2) + Math.min(20, h2hSummary.matches * 4));

  const favorite = homeMomentum === awayMomentum ? null : homeMomentum > awayMomentum ? String(fixture.home_name) : String(fixture.away_name);

  return {
    fixture: {
      fixtureId: String(fixture.fixture_id), competitionKey: fixture.competition_key,
      competitionName: fixture.competition_name, season: fixture.season,
      kickoffAt: fixture.kickoff_at, venue: fixture.venue, referee: fixture.referee, status: fixture.status,
    },
    home: { teamKey: String(fixture.home_team_key), name: String(fixture.home_name), logo: fixture.home_logo, recent: homeRecent, venue: homeVenue },
    away: { teamKey: String(fixture.away_team_key), name: String(fixture.away_name), logo: fixture.away_logo, recent: awayRecent, venue: awayVenue },
    headToHead: { ...h2hSummary, matches: h2h },
    insights: {
      favorite,
      momentum: { home: homeMomentum, away: awayMomentum },
      corners: { over95Probability: cornerProbability },
      goals: { bttsProbability },
      confidence,
    },
    methodology: {
      version: '1.0',
      note: 'Scores heurísticos baseados em indicadores históricos; não representam garantia de resultado.',
    },
  };
}
