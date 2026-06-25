import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

const WORLD_CUP_2026_KEY = 'world_cup_2026';

type TeamAverages = {
  team_name: string;
  matches: number;
  corners_for: number | null;
  corners_against: number | null;
  cards_for: number | null;
  cards_against: number | null;
  shots_for: number | null;
  shots_against: number | null;
  xg_for: number | null;
  xg_against: number | null;
};

function n(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function probabilityOver(mean: number, line: number) {
  const z = (mean - line) / Math.max(1.8, Math.sqrt(Math.max(mean, 1)));
  return clamp(Math.round(50 + z * 24), 5, 95);
}

function isFinishedStatus(status: unknown) {
  const value = String(status ?? '').toLowerCase();
  return ['finished', 'fim', 'final', 'ft'].some((term) => value.includes(term));
}

function model(home?: TeamAverages, away?: TeamAverages) {
  const homeCornersFor = n(home?.corners_for, 4.5);
  const homeCornersAgainst = n(home?.corners_against, 4.5);
  const awayCornersFor = n(away?.corners_for, 4.5);
  const awayCornersAgainst = n(away?.corners_against, 4.5);
  const homeCardsFor = n(home?.cards_for, 1.8);
  const homeCardsAgainst = n(home?.cards_against, 1.8);
  const awayCardsFor = n(away?.cards_for, 1.8);
  const awayCardsAgainst = n(away?.cards_against, 1.8);
  const homeXgFor = n(home?.xg_for, 1.2);
  const homeXgAgainst = n(home?.xg_against, 1.2);
  const awayXgFor = n(away?.xg_for, 1.2);
  const awayXgAgainst = n(away?.xg_against, 1.2);

  const homeCorners = (homeCornersFor + awayCornersAgainst) / 2;
  const awayCorners = (awayCornersFor + homeCornersAgainst) / 2;
  const totalCorners = homeCorners + awayCorners;
  const homeCards = (homeCardsFor + awayCardsAgainst) / 2;
  const awayCards = (awayCardsFor + homeCardsAgainst) / 2;
  const totalCards = homeCards + awayCards;
  const homeXg = (homeXgFor + awayXgAgainst) / 2;
  const awayXg = (awayXgFor + homeXgAgainst) / 2;
  const totalXg = homeXg + awayXg;
  const confidence = clamp(35 + Math.min(n(home?.matches), n(away?.matches)) * 12, 35, 82);

  return {
    corners: {
      home: round(homeCorners),
      away: round(awayCorners),
      total: round(totalCorners),
      over85: probabilityOver(totalCorners, 8.5),
      over95: probabilityOver(totalCorners, 9.5),
      over105: probabilityOver(totalCorners, 10.5),
    },
    cards: {
      home: round(homeCards),
      away: round(awayCards),
      total: round(totalCards),
      over35: probabilityOver(totalCards, 3.5),
      over45: probabilityOver(totalCards, 4.5),
    },
    goals: {
      homeXg: round(homeXg, 2),
      awayXg: round(awayXg, 2),
      totalXg: round(totalXg, 2),
      bothTeamsScore: clamp(Math.round(30 + Math.min(homeXg, awayXg) * 24), 10, 78),
      over25: probabilityOver(totalXg, 2.5),
    },
    confidence,
    note: 'Modelo inicial baseado no histórico persistido da Copa. Prioriza dados oficiais FIFA quando disponíveis e usa 365Scores/API-Football apenas como complemento.',
  };
}

export async function GET() {
  try {
    const now = new Date();
    const upcoming = await sql`
      SELECT id, home_team_name, away_team_name, kickoff_at, group_name, round_name, status, source_key
      FROM world_cup_matches
      WHERE competition_key = ${WORLD_CUP_2026_KEY}
        AND kickoff_at >= NOW() - INTERVAL '2 hours'
      ORDER BY kickoff_at ASC NULLS LAST, id ASC
      LIMIT 60
    `;

    const averages = (await sql`
      WITH stat_base AS (
        SELECT
          m.id AS match_id,
          m.home_team_id,
          m.away_team_id,
          ms.team_id,
          LOWER(ms.metric_key) AS metric_key,
          ms.value_numeric,
          ROW_NUMBER() OVER (
            PARTITION BY m.id, ms.team_id, LOWER(ms.metric_key)
            ORDER BY CASE ms.source_key WHEN 'fifa' THEN 1 WHEN '365scores' THEN 2 WHEN 'api-football' THEN 3 ELSE 9 END
          ) AS rn
        FROM world_cup_match_statistics ms
        JOIN world_cup_matches m ON m.id = ms.match_id
        WHERE m.competition_key = ${WORLD_CUP_2026_KEY}
          AND ms.value_numeric IS NOT NULL
          AND LOWER(COALESCE(m.status, '')) IN ('finished', 'fim', 'final', 'ft')
      ), picked AS (
        SELECT * FROM stat_base WHERE rn = 1
      )
      SELECT
        t.name AS team_name,
        COUNT(DISTINCT p.match_id)::int AS matches,
        AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('corners', 'corner_kicks') AND p.team_id = t.id)::float AS corners_for,
        AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('corners', 'corner_kicks') AND p.team_id <> t.id)::float AS corners_against,
        AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('yellow_cards', 'red_cards') AND p.team_id = t.id)::float AS cards_for,
        AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('yellow_cards', 'red_cards') AND p.team_id <> t.id)::float AS cards_against,
        AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('shots', 'total_shots') AND p.team_id = t.id)::float AS shots_for,
        AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('shots', 'total_shots') AND p.team_id <> t.id)::float AS shots_against,
        AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('expected_goals', 'xg') AND p.team_id = t.id)::float AS xg_for,
        AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('expected_goals', 'xg') AND p.team_id <> t.id)::float AS xg_against
      FROM world_cup_teams t
      LEFT JOIN picked p ON p.team_id = t.id OR p.home_team_id = t.id OR p.away_team_id = t.id
      WHERE t.competition_key = ${WORLD_CUP_2026_KEY}
      GROUP BY t.id, t.name
    `) as TeamAverages[];

    const byTeam = new Map(averages.map((row) => [row.team_name.toLowerCase(), row]));
    const predictions = upcoming
      .filter((match: any) => {
        const kickoff = match.kickoff_at ? new Date(match.kickoff_at) : null;
        return !isFinishedStatus(match.status) && (!kickoff || kickoff.getTime() >= now.getTime() - 2 * 60 * 60 * 1000);
      })
      .map((match: any) => {
        const home = byTeam.get(String(match.home_team_name).toLowerCase());
        const away = byTeam.get(String(match.away_team_name).toLowerCase());
        return {
          id: match.id,
          homeTeamName: match.home_team_name,
          awayTeamName: match.away_team_name,
          kickoffAt: match.kickoff_at,
          groupName: match.group_name,
          roundName: match.round_name,
          sourceKey: match.source_key,
          prediction: model(home, away),
          samples: { homeMatches: home?.matches ?? 0, awayMatches: away?.matches ?? 0 },
        };
      });

    return NextResponse.json({ success: true, predictions, count: predictions.length, lastUpdated: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro ao gerar previsões.' }, { status: 500 });
  }
}
