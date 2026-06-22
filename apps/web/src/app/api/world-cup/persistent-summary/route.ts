import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

const WORLD_CUP_2026_KEY = 'world_cup_2026';

type StatRow = {
  metric_key?: string;
  metric_name?: string;
  value_numeric?: number | null;
  value_text?: string | null;
  team_name?: string | null;
};

function normalize(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function statValue(stats: StatRow[], includes: string[]): string | null {
  const found = stats.find((stat) => {
    const text = normalize(`${stat.metric_key ?? ''} ${stat.metric_name ?? ''}`);
    return includes.some((part) => text.includes(part));
  });

  if (!found) return null;
  if (found.value_numeric !== null && found.value_numeric !== undefined) return String(found.value_numeric);
  return found.value_text ? String(found.value_text) : null;
}

function teamStatPair(stats: StatRow[], includes: string[], homeName: string, awayName: string) {
  const matched = stats.filter((stat) => {
    const text = normalize(`${stat.metric_key ?? ''} ${stat.metric_name ?? ''}`);
    return includes.some((part) => text.includes(part));
  });

  const homeKey = normalize(homeName);
  const awayKey = normalize(awayName);
  const home = matched.find((stat) => normalize(stat.team_name) === homeKey);
  const away = matched.find((stat) => normalize(stat.team_name) === awayKey);

  return {
    home: home?.value_numeric ?? home?.value_text ?? null,
    away: away?.value_numeric ?? away?.value_text ?? null,
  };
}

export async function GET() {
  try {
    const matches = await sql`
      SELECT
        m.id,
        m.fixture_key,
        m.home_team_name,
        m.away_team_name,
        m.home_score,
        m.away_score,
        m.status,
        m.kickoff_at,
        m.stage,
        m.group_name,
        m.round_name,
        m.venue,
        m.referee,
        COALESCE(
          json_agg(
            json_build_object(
              'team_name', t.name,
              'metric_key', ms.metric_key,
              'metric_name', ms.metric_name,
              'value_numeric', ms.value_numeric,
              'value_text', ms.value_text
            )
          ) FILTER (WHERE ms.id IS NOT NULL),
          '[]'::json
        ) AS stats
      FROM world_cup_matches m
      LEFT JOIN world_cup_match_statistics ms ON ms.match_id = m.id
      LEFT JOIN world_cup_teams t ON t.id = ms.team_id
      WHERE m.competition_key = ${WORLD_CUP_2026_KEY}
      GROUP BY m.id
      ORDER BY m.kickoff_at DESC NULLS LAST, m.id DESC
      LIMIT 120
    `;

    const formattedMatches = matches.map((match) => {
      const stats = Array.isArray(match.stats) ? (match.stats as StatRow[]) : [];
      const corners = teamStatPair(stats, ['corner', 'escanteio'], match.home_team_name, match.away_team_name);
      const yellowCards = teamStatPair(stats, ['yellow card', 'cartao amarelo', 'cartoes amarelos'], match.home_team_name, match.away_team_name);
      const redCards = teamStatPair(stats, ['red card', 'cartao vermelho', 'cartoes vermelhos'], match.home_team_name, match.away_team_name);
      const shots = teamStatPair(stats, ['shot', 'finalizacao', 'finalizacoes'], match.home_team_name, match.away_team_name);
      const shotsOnGoal = teamStatPair(stats, ['shot on goal', 'chute no gol', 'chutes no gol'], match.home_team_name, match.away_team_name);
      const possession = teamStatPair(stats, ['possession', 'posse'], match.home_team_name, match.away_team_name);
      const fouls = teamStatPair(stats, ['foul', 'falta'], match.home_team_name, match.away_team_name);
      const offsides = teamStatPair(stats, ['offside', 'impedimento'], match.home_team_name, match.away_team_name);

      return {
        id: match.id,
        fixtureKey: match.fixture_key,
        homeTeamName: match.home_team_name,
        awayTeamName: match.away_team_name,
        homeScore: match.home_score,
        awayScore: match.away_score,
        status: match.status,
        kickoffAt: match.kickoff_at,
        stage: match.stage,
        groupName: match.group_name,
        roundName: match.round_name,
        venue: match.venue,
        referee: match.referee,
        statsCount: stats.length,
        summary: {
          possession,
          shots,
          shotsOnGoal,
          corners,
          yellowCards,
          redCards,
          fouls,
          offsides,
          xg: statValue(stats, ['expected goals', 'xg']),
        },
        rawStats: stats,
      };
    });

    return NextResponse.json({
      competition: WORLD_CUP_2026_KEY,
      matches: formattedMatches,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('world cup persistent summary error:', error);
    return NextResponse.json(
      { error: 'Failed to load persistent World Cup data', matches: [] },
      { status: 500 }
    );
  }
}
