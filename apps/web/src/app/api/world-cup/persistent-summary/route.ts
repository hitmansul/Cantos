import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

const WORLD_CUP_2026_KEY = 'world_cup_2026';

type StatRow = {
  source_key?: string | null;
  period?: string | null;
  metric_key?: string | null;
  metric_name?: string | null;
  value_numeric?: number | null;
  value_text?: string | null;
  team_name?: string | null;
  source_payload?: unknown;
};

type StatPair = { home: string | number | null; away: string | number | null };
type Summary = Record<string, StatPair>;

type MetricConfig = {
  keys: string[];
  label: string;
  order: number;
};

const METRICS: MetricConfig[] = [
  { order: 10, keys: ['possession'], label: 'Posse de bola' },
  { order: 20, keys: ['goals'], label: 'Gols' },
  { order: 30, keys: ['goals_conceded'], label: 'Gols sofridos' },
  { order: 40, keys: ['assists'], label: 'Assistências' },
  { order: 50, keys: ['shots'], label: 'Finalizações' },
  { order: 60, keys: ['shotsontarget', 'shotsOnGoal', 'shots_on_target'], label: 'Finalizações no gol' },
  { order: 70, keys: ['shots_off_target'], label: 'Finalizações para fora' },
  { order: 80, keys: ['yellowcards', 'yellowCards', 'yellow_cards'], label: 'Cartões amarelos' },
  { order: 90, keys: ['redcards', 'redCards', 'red_cards'], label: 'Cartões vermelhos' },
  { order: 100, keys: ['fouls'], label: 'Faltas' },
  { order: 110, keys: ['offsides'], label: 'Impedimentos' },
  { order: 120, keys: ['passes'], label: 'Passes totais' },
  { order: 130, keys: ['completedpasses', 'completedPasses', 'completed_passes'], label: 'Passes concluídos' },
  { order: 140, keys: ['passaccuracy', 'passAccuracy', 'pass_accuracy'], label: 'Precisão de passes' },
  { order: 150, keys: ['crosses'], label: 'Cruzamentos' },
  { order: 160, keys: ['completedcrosses', 'completedCrosses', 'completed_crosses'], label: 'Cruzamentos concluídos' },
  { order: 170, keys: ['corners', 'cornerKicks', 'corner_kicks'], label: 'Escanteios' },
  { order: 180, keys: ['freekicks', 'freeKicks', 'free_kicks'], label: 'Livres' },
  { order: 190, keys: ['penaltiesconverted', 'penaltiesConverted', 'penalties_converted'], label: 'Pênaltis convertidos' },
  { order: 200, keys: ['turnoversforced', 'turnoversForced', 'forced_turnovers'], label: 'Erros forçados' },
  { order: 210, keys: ['defensivepressures', 'defensivePressures', 'defensive_pressures'], label: 'Pressões defensivas exercidas' },
  { order: 220, keys: ['saves', 'goalkeeperSaves', 'goalkeeper_saves'], label: 'Defesas do goleiro' },
  { order: 230, keys: ['expectedgoals', 'expectedGoals', 'xg'], label: 'Gols esperados (xG)' },
  { order: 240, keys: ['tackles'], label: 'Desarmes' },
  { order: 250, keys: ['interceptions'], label: 'Interceptações' },
  { order: 260, keys: ['clearances'], label: 'Cortes defensivos' },
  { order: 270, keys: ['stoppagetime', 'stoppageTime', 'stoppage_time', 'addedtime', 'addedTime', 'added_time', 'injurytime', 'injuryTime', 'injury_time', 'acrescimos', 'acrescimo', 'tempoacrescimo', 'tempoDeAcrescimo', 'tempo_de_acrescimo', 'addedminutes', 'addedMinutes', 'added_minutes'], label: 'Acréscimos' },
];

const ORDER_BY_LABEL = new Map(METRICS.map((metric) => [metric.label, metric.order]));

function normalize(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function cleanScalar(value: unknown): string | number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).replace('%', '').trim();
  if (!text) return null;
  const number = Number(text.replace(',', '.'));
  return Number.isFinite(number) ? number : text;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace('%', '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function sameTeam(left: unknown, right: unknown): boolean {
  const a = normalize(left);
  const b = normalize(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function sourceRank(source?: string | null): number {
  if (source === 'fifa') return 1;
  if (source === '365scores') return 2;
  if (source === 'api-football') return 3;
  return 9;
}

function metricConfig(stat: StatRow): MetricConfig | null {
  const key = normalize(stat.metric_key);
  const name = normalize(stat.metric_name);
  return METRICS.find((metric) => metric.keys.some((candidate) => normalize(candidate) === key || normalize(candidate) === name)) ?? null;
}

function statValue(stat?: StatRow | null): string | number | null {
  if (!stat) return null;
  return cleanScalar(stat.value_numeric ?? stat.value_text);
}

function validate(label: string, pair: StatPair): StatPair {
  const home = toNumber(pair.home);
  const away = toNumber(pair.away);
  if (label === 'Posse de bola') {
    if (home === null || away === null || home < 0 || away < 0 || home > 100 || away > 100) return { home: null, away: null };
    if (home + away < 80 || home + away > 105) return { home: null, away: null };
    return { home: Math.round(home), away: Math.round(away) };
  }
  if (label === 'Acréscimos') {
    if ((home !== null && home < 0) || (away !== null && away < 0)) return { home: null, away: null };
    if ((home !== null && home > 40) || (away !== null && away > 40)) return { home: null, away: null };
  }
  if (label === 'Passes totais' && home !== null && away !== null && home <= 5 && away <= 5) return { home: null, away: null };
  return pair;
}

function buildSummary(stats: StatRow[], homeName: string, awayName: string): Summary {
  const summary = new Map<string, StatPair>();
  const grouped = new Map<string, StatRow[]>();

  for (const stat of stats) {
    const config = metricConfig(stat);
    if (!config) continue;
    const list = grouped.get(config.label) ?? [];
    list.push(stat);
    grouped.set(config.label, list);
  }

  for (const metric of METRICS) {
    const rows = (grouped.get(metric.label) ?? []).sort((a, b) => sourceRank(a.source_key) - sourceRank(b.source_key));
    if (rows.length === 0) continue;
    const preferredSource = rows[0].source_key;
    const preferred = rows.filter((row) => row.source_key === preferredSource);
    const home = preferred.find((stat) => sameTeam(stat.team_name, homeName));
    const away = preferred.find((stat) => sameTeam(stat.team_name, awayName));
    const pair = validate(metric.label, {
      home: home ? statValue(home) : statValue(preferred[0]),
      away: away ? statValue(away) : statValue(preferred.length > 1 ? preferred[1] : null),
    });
    if (pair.home !== null || pair.away !== null) summary.set(metric.label, pair);
  }

  return Object.fromEntries([...summary.entries()].sort(([a], [b]) => (ORDER_BY_LABEL.get(a) ?? 999) - (ORDER_BY_LABEL.get(b) ?? 999)));
}

function countMappedValues(summary: Summary): number {
  return Object.values(summary).flatMap((value) => [value.home, value.away]).filter((value) => value !== null && value !== undefined && value !== '').length;
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
              'source_key', ms.source_key,
              'period', ms.period,
              'metric_key', ms.metric_key,
              'metric_name', ms.metric_name,
              'value_numeric', ms.value_numeric,
              'value_text', ms.value_text,
              'source_payload', ms.source_payload
            )
            ORDER BY CASE ms.source_key WHEN 'fifa' THEN 1 WHEN '365scores' THEN 2 WHEN 'api-football' THEN 3 ELSE 9 END, ms.metric_key, t.name
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
      const summary = buildSummary(stats, match.home_team_name, match.away_team_name);
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
        mappedStatsCount: countMappedValues(summary),
        sources: [...new Set(stats.map((stat) => stat.source_key).filter(Boolean))],
        summary,
        summaryOrder: Object.keys(summary),
        rawStats: stats,
      };
    });

    return NextResponse.json({
      success: true,
      source: 'persistent',
      matches: formattedMatches,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      matches: [],
      error: error instanceof Error ? error.message : 'Erro ao carregar estatísticas persistidas da Copa.',
      lastUpdated: new Date().toISOString(),
    }, { status: 200 });
  }
}
