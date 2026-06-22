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

function metricText(stat: StatRow): string {
  return normalize(`${stat.metric_key ?? ''} ${stat.metric_name ?? ''}`);
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function statValue(stats: StatRow[], includes: string[]): string | null {
  const found = stats.find((stat) => hasAny(metricText(stat), includes));
  if (!found) return null;
  if (found.value_numeric !== null && found.value_numeric !== undefined) return String(found.value_numeric);
  return found.value_text ? String(found.value_text) : null;
}

function statDisplayValue(stat?: StatRow | null): string | number | null {
  if (!stat) return null;
  if (stat.value_numeric !== null && stat.value_numeric !== undefined) return stat.value_numeric;
  if (stat.value_text !== null && stat.value_text !== undefined && stat.value_text !== '') return stat.value_text;
  return null;
}

function sameTeam(left: unknown, right: unknown): boolean {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function teamStatPair(stats: StatRow[], includes: string[], homeName: string, awayName: string) {
  const matched = stats.filter((stat) => hasAny(metricText(stat), includes));
  const home = matched.find((stat) => sameTeam(stat.team_name, homeName));
  const away = matched.find((stat) => sameTeam(stat.team_name, awayName));

  if (home || away) {
    return {
      home: statDisplayValue(home),
      away: statDisplayValue(away),
    };
  }

  // Fallback: algumas fontes gravam a estatística sem nome de equipe confiável,
  // mas enviam duas linhas na ordem mandante/visitante. Mantemos esse fallback
  // para não esconder dados já importados no banco.
  if (matched.length >= 2) {
    return {
      home: statDisplayValue(matched[0]),
      away: statDisplayValue(matched[1]),
    };
  }

  return { home: null, away: null };
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
      const corners = teamStatPair(stats, ['corner', 'corners', 'escanteio', 'escanteios'], match.home_team_name, match.away_team_name);
      const yellowCards = teamStatPair(stats, ['yellow card', 'yellow cards', 'cartao amarelo', 'cartoes amarelos'], match.home_team_name, match.away_team_name);
      const redCards = teamStatPair(stats, ['red card', 'red cards', 'cartao vermelho', 'cartoes vermelhos'], match.home_team_name, match.away_team_name);
      const shotsOnGoal = teamStatPair(stats, ['shots on target', 'shots_on_target', 'shot on goal', 'chute no gol', 'chutes no gol', 'finalizacoes no gol'], match.home_team_name, match.away_team_name);
      const shots = teamStatPair(stats, ['total shots', 'shots', 'shot attempts', 'finalizacao', 'finalizacoes', 'chutes'], match.home_team_name, match.away_team_name);
      const possession = teamStatPair(stats, ['possession', 'posse', 'ball possession'], match.home_team_name, match.away_team_name);
      const fouls = teamStatPair(stats, ['fouls', 'foul', 'falta', 'faltas'], match.home_team_name, match.away_team_name);
      const offsides = teamStatPair(stats, ['offsides', 'offside', 'impedimento', 'impedimentos'], match.home_team_name, match.away_team_name);

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
      priority: 'FIFA first. Persistent table currently stores imported match statistics when the pipeline has already collected them.',
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
