import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';

const WORLD_CUP_2026_KEY = 'world_cup_2026';

type Row = {
  id: number | string;
  fixture_key: string;
  home_team_name: string;
  away_team_name: string;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
  kickoff_at: string | null;
  total_stats: number;
  fifa_stats: number;
  other_stats: number;
  required_metric_count: number;
};

const REQUIRED_METRICS = [
  'possession',
  'shots',
  'shots_on_target',
  'corners',
  'yellow_cards',
  'red_cards',
  'fouls',
  'offsides',
  'passes',
  'pass_accuracy',
  'goalkeeper_saves',
  'expected_goals',
];

function normalize(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function finished(status: unknown) {
  const value = normalize(status);
  return ['fim', 'final', 'finished', 'ft', 'encerrado'].some((term) => value.includes(term));
}

function displayName(value: unknown) {
  return String(value ?? '')
    .replace(/TchÃ©quia/g, 'Tchéquia')
    .replace(/MÃ©xico/g, 'México')
    .replace(/Ãfrica/g, 'África')
    .replace(/EscÃ³cia/g, 'Escócia')
    .replace(/BÃ³snia/g, 'Bósnia')
    .replace(/SuÃ­Ã§a/g, 'Suíça')
    .replace(/CanadÃ¡/g, 'Canadá')
    .replace(/ColÃ´mbia/g, 'Colômbia')
    .replace(/PanamÃ¡/g, 'Panamá')
    .replace(/CroÃ¡cia/g, 'Croácia')
    .replace(/UzbequistÃ£o/g, 'Uzbequistão')
    .replace(/JordÃ¢nia/g, 'Jordânia')
    .replace(/ArgÃ©lia/g, 'Argélia')
    .replace(/FranÃ§a/g, 'França')
    .replace(/Ãustria/g, 'Áustria')
    .replace(/TunÃ­sia/g, 'Tunísia')
    .replace(/JapÃ£o/g, 'Japão')
    .replace(/CuraÃ§ao/g, 'Curaçao')
    .replace(/SuÃ©cia/g, 'Suécia')
    .replace(/AustrÃ¡lia/g, 'Austrália')
    .replace(/IrÃ£/g, 'Irã')
    .replace(/ArÃ¡bia/g, 'Arábia');
}

export async function GET() {
  try {
    const rows = (await sql`
      SELECT
        m.id,
        m.fixture_key,
        m.home_team_name,
        m.away_team_name,
        m.home_score,
        m.away_score,
        m.status,
        m.kickoff_at,
        COUNT(ms.id)::int AS total_stats,
        COUNT(ms.id) FILTER (WHERE ms.source_key = 'fifa')::int AS fifa_stats,
        COUNT(ms.id) FILTER (WHERE ms.source_key <> 'fifa')::int AS other_stats,
        COUNT(DISTINCT ms.metric_key) FILTER (WHERE ms.source_key = 'fifa' AND ms.metric_key = ANY(${REQUIRED_METRICS}))::int AS required_metric_count
      FROM world_cup_matches m
      LEFT JOIN world_cup_match_statistics ms ON ms.match_id = m.id
      WHERE m.competition_key = ${WORLD_CUP_2026_KEY}
      GROUP BY m.id
      ORDER BY m.kickoff_at DESC NULLS LAST, m.id DESC
    `) as Row[];

    const completed = rows.filter((row) => finished(row.status) || row.home_score !== null || row.away_score !== null);
    const completeFifa = completed.filter((row) => row.fifa_stats > 0 && row.required_metric_count >= 8);
    const partialFifa = completed.filter((row) => row.fifa_stats > 0 && row.required_metric_count < 8);
    const missingFifa = completed.filter((row) => row.fifa_stats === 0);
    const missingAllStats = completed.filter((row) => row.total_stats === 0);

    return NextResponse.json({
      success: true,
      competition: WORLD_CUP_2026_KEY,
      scope: 'Somente Copa do Mundo 2026.',
      requiredMetrics: REQUIRED_METRICS,
      summary: {
        completedMatches: completed.length,
        completeFifaMatches: completeFifa.length,
        partialFifaMatches: partialFifa.length,
        missingFifaMatches: missingFifa.length,
        missingAllStatsMatches: missingAllStats.length,
        fifaCoveragePercent: completed.length ? Math.round((completeFifa.length / completed.length) * 100) : 0,
      },
      missingFifa: missingFifa.map((row) => ({
        id: row.id,
        fixtureKey: row.fixture_key,
        match: `${displayName(row.home_team_name)} x ${displayName(row.away_team_name)}`,
        score: `${row.home_score ?? '-'} x ${row.away_score ?? '-'}`,
        totalStats: row.total_stats,
        otherStats: row.other_stats,
      })),
      partialFifa: partialFifa.map((row) => ({
        id: row.id,
        fixtureKey: row.fixture_key,
        match: `${displayName(row.home_team_name)} x ${displayName(row.away_team_name)}`,
        fifaStats: row.fifa_stats,
        requiredMetricCount: row.required_metric_count,
      })),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro ao medir saúde dos dados FIFA.' }, { status: 500 });
  }
}
