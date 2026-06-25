import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { WORLD_CUP_2026_KEY } from '@/lib/persistence/worldCupRepository';

export const dynamic = 'force-dynamic';

function clamp(value: number, min = 5, max = 95) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function overProbability(expected: number, line: number, variance = 2.4) {
  const z = (line - expected) / variance;
  return clamp(100 * (1 - 0.5 * (1 + Math.tanh(z * 0.8))));
}

export async function GET() {
  try {
    const matches = await sql`
      SELECT id, fixture_key, home_team_name, away_team_name, group_name, round_name, kickoff_at, status
      FROM world_cup_matches
      WHERE competition_key = ${WORLD_CUP_2026_KEY}
      ORDER BY kickoff_at ASC NULLS LAST, id ASC
      LIMIT 80
    `;

    const averages = await sql`
      SELECT t.name AS team_name, ms.metric_key, AVG(ms.value_numeric)::float AS avg_value
      FROM world_cup_match_statistics ms
      JOIN world_cup_matches m ON m.id = ms.match_id
      JOIN world_cup_teams t ON t.id = ms.team_id
      WHERE m.competition_key = ${WORLD_CUP_2026_KEY}
        AND ms.period = 'match'
        AND ms.value_numeric IS NOT NULL
        AND ms.metric_key IN ('corners', 'yellow_cards', 'red_cards', 'fouls', 'shots', 'expected_goals')
      GROUP BY t.name, ms.metric_key
    `;

    const byTeam = new Map<string, Record<string, number>>();
    for (const row of averages) {
      const team = String(row.team_name ?? '').toLowerCase();
      const current = byTeam.get(team) ?? {};
      current[String(row.metric_key)] = Number(row.avg_value);
      byTeam.set(team, current);
    }

    const predictions = matches.map((match) => {
      const home = byTeam.get(String(match.home_team_name ?? '').toLowerCase()) ?? {};
      const away = byTeam.get(String(match.away_team_name ?? '').toLowerCase()) ?? {};
      const homeCorners = Number(home.corners ?? 4.7);
      const awayCorners = Number(away.corners ?? 4.7);
      const expectedCorners = Math.round((homeCorners + awayCorners) * 10) / 10;
      const expectedCards = Math.round(((home.yellow_cards ?? 1.8) + (away.yellow_cards ?? 1.8) + (home.red_cards ?? 0.08) + (away.red_cards ?? 0.08)) * 10) / 10;
      const expectedXg = Math.round(((home.expected_goals ?? 1.2) + (away.expected_goals ?? 1.2)) * 10) / 10;
      const expectedShots = Math.round(((home.shots ?? 10) + (away.shots ?? 10)) * 10) / 10;

      return {
        matchId: match.id,
        fixtureKey: match.fixture_key,
        homeTeamName: match.home_team_name,
        awayTeamName: match.away_team_name,
        groupName: match.group_name,
        roundName: match.round_name,
        kickoffAt: match.kickoff_at,
        status: match.status,
        expectedCorners,
        corners: {
          homeExpected: Math.round(homeCorners * 10) / 10,
          awayExpected: Math.round(awayCorners * 10) / 10,
          over75: overProbability(expectedCorners, 7.5),
          over85: overProbability(expectedCorners, 8.5),
          over95: overProbability(expectedCorners, 9.5),
          over105: overProbability(expectedCorners, 10.5),
        },
        cards: {
          expectedTotal: expectedCards,
          over35: overProbability(expectedCards, 3.5, 1.8),
          over45: overProbability(expectedCards, 4.5, 1.8),
          over55: overProbability(expectedCards, 5.5, 1.8),
        },
        attack: { expectedXg, expectedShots },
        confidence: home.corners && away.corners ? 'media-alta' : 'baixa-ate-ter-mais-FIFA',
      };
    });

    return NextResponse.json({ success: true, count: predictions.length, predictions, lastUpdated: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro ao gerar previsoes da Copa.', predictions: [] }, { status: 500 });
  }
}
