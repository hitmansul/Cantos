import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

const WORLD_CUP_2026_KEY = 'world_cup_2026';

type StatRow = {
  source_key?: string;
  period?: string | null;
  metric_key?: string;
  metric_name?: string;
  value_numeric?: number | null;
  value_text?: string | null;
  team_name?: string | null;
  source_payload?: unknown;
};

type StatPair = { home: string | number | null; away: string | number | null };
type Summary = Record<string, StatPair>;
type PairKind = 'possession' | 'passes' | 'percent' | 'generic';

type MetricConfig = {
  key: string;
  label: string;
  includes: string[];
  excludes?: string[];
  kind?: PairKind;
  strictLabelOnly?: boolean;
};

const SUMMARY_METRICS: MetricConfig[] = [
  { key: 'possession', label: 'Posse de bola', includes: ['possession', 'ball possession', 'posse de bola'], kind: 'possession', excludes: ['average possession', 'territory', 'field tilt'], strictLabelOnly: true },
  { key: 'goals', label: 'Gols', includes: ['goals gols', 'goals gol', 'gols'], excludes: ['conceded', 'sofridos', 'against'], strictLabelOnly: true },
  { key: 'goals_conceded', label: 'Gols sofridos', includes: ['goals_conceded', 'gols sofridos', 'sofridos'], strictLabelOnly: true },
  { key: 'assists', label: 'Assistências', includes: ['assists', 'assistencias', 'assistências'], strictLabelOnly: true },
  { key: 'shots', label: 'Finalizações', includes: ['shots finalizacoes', 'shots finalizações', 'total shots', 'total attempts', 'attempts', 'chutes'], excludes: ['target', 'fora', 'off target'], strictLabelOnly: true },
  { key: 'shotsontarget', label: 'Finalizações no gol', includes: ['shotsontarget', 'shots on target', 'attempts on target', 'chutes no gol', 'finalizacoes no gol'], strictLabelOnly: true },
  { key: 'shots_off_target', label: 'Finalizações para fora', includes: ['shots_off_target', 'para fora', 'off target'], strictLabelOnly: true },
  { key: 'corners', label: 'Escanteios', includes: ['corners', 'corner kick', 'escanteio', 'escanteios', 'cantos'], strictLabelOnly: true },
  { key: 'yellowcards', label: 'Cartões amarelos', includes: ['yellowcards', 'yellow card', 'cartoes amarelos', 'cartões amarelos'], strictLabelOnly: true },
  { key: 'redcards', label: 'Cartões vermelhos', includes: ['redcards', 'red card', 'cartoes vermelhos', 'cartões vermelhos'], strictLabelOnly: true },
  { key: 'fouls', label: 'Faltas', includes: ['fouls', 'falta', 'faltas recebidas', 'faltas'], strictLabelOnly: true },
  { key: 'offsides', label: 'Impedimentos', includes: ['offsides', 'offside', 'impedimento', 'impedimentos'], strictLabelOnly: true },
  { key: 'passes', label: 'Passes totais', includes: ['passes passes totais', 'total passes', 'passes totais'], kind: 'passes', excludes: ['completed', 'concluidos', 'concluídos', 'accuracy', 'precisao', 'precisão'], strictLabelOnly: true },
  { key: 'completedpasses', label: 'Passes concluídos', includes: ['completedpasses', 'passes concluidos', 'passes concluídos', 'completed passes'], kind: 'passes', strictLabelOnly: true },
  { key: 'passaccuracy', label: 'Precisão de passes', includes: ['passaccuracy', 'pass accuracy', 'passing accuracy', 'precisao de passes', 'precisão de passes'], kind: 'percent', strictLabelOnly: true },
  { key: 'crosses', label: 'Cruzamentos', includes: ['crosses', 'cruzamentos'], excludes: ['completed', 'concluidos', 'concluídos'], strictLabelOnly: true },
  { key: 'completedcrosses', label: 'Cruzamentos concluídos', includes: ['completedcrosses', 'cruzamentos concluidos', 'cruzamentos concluídos', 'completed crosses'], strictLabelOnly: true },
  { key: 'freekicks', label: 'Livres', includes: ['freekicks', 'free kicks', 'livres'], strictLabelOnly: true },
  { key: 'penaltiesconverted', label: 'Pênaltis convertidos', includes: ['penaltiesconverted', 'penalties converted', 'penaltis convertidos', 'pênaltis convertidos'], strictLabelOnly: true },
  { key: 'turnoversforced', label: 'Erros forçados', includes: ['turnoversforced', 'erros forcados', 'erros forçados', 'forced turnovers'], strictLabelOnly: true },
  { key: 'defensivepressures', label: 'Pressões defensivas exercidas', includes: ['defensivepressures', 'pressoes defensivas exercidas', 'pressões defensivas exercidas', 'defensive pressures'], strictLabelOnly: true },
  { key: 'goalkeeperSaves', label: 'Defesas do goleiro', includes: ['goalkeeper saves', 'keeper saves', 'saves by goalkeeper', 'defesas do goleiro'], excludes: ['tackle', 'interception', 'clearance', 'duel'], strictLabelOnly: true },
  { key: 'expectedgoals', label: 'Gols esperados (xG)', includes: ['expectedgoals', 'expected goals', 'xg', 'gols esperados'], strictLabelOnly: true },
  { key: 'tackles', label: 'Desarmes', includes: ['tackles', 'desarmes'], strictLabelOnly: true },
  { key: 'interceptions', label: 'Interceptações', includes: ['interceptions', 'interceptacoes', 'interceptações'], strictLabelOnly: true },
  { key: 'clearances', label: 'Cortes defensivos', includes: ['clearances', 'cortes defensivos'], strictLabelOnly: true },
];

function normalize(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function payloadText(value: unknown): string {
  try { return normalize(JSON.stringify(value ?? '')); } catch { return ''; }
}

function metricLabelText(stat: StatRow): string {
  return normalize(`${stat.metric_key ?? ''} ${stat.metric_name ?? ''}`);
}

function metricFullText(stat: StatRow): string {
  return normalize(`${stat.metric_key ?? ''} ${stat.metric_name ?? ''} ${payloadText(stat.source_payload)}`);
}

function hasAny(text: string, terms: string[] = []): boolean {
  return terms.some((term) => text.includes(normalize(term)));
}

function cleanScalar(value: unknown): string | number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).replace('%', '').trim();
  if (!text) return null;
  const number = Number(text.replace(',', '.'));
  if (Number.isFinite(number)) return number;
  return String(value).trim();
}

function findValueInPayload(payload: unknown): string | number | null {
  const record = asRecord(payload);
  if (!record) return cleanScalar(payload);
  for (const key of ['value', 'statValue', 'amount', 'total', 'displayValue', 'formattedValue', 'numericValue', 'percentage', 'percent']) {
    const value = cleanScalar(record[key]);
    if (value !== null) return value;
  }
  for (const nestedKey of ['stat', 'statistics', 'data', 'payload', 'item']) {
    const value = findValueInPayload(record[nestedKey]);
    if (value !== null) return value;
  }
  return null;
}

function statDisplayValue(stat?: StatRow | null): string | number | null {
  if (!stat) return null;
  const stored = cleanScalar(stat.value_numeric ?? stat.value_text);
  if (stored !== null) return stored;
  return findValueInPayload(stat.source_payload);
}

function toNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace('%', '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function sourceRank(source?: string): number {
  if (source === 'fifa') return 1;
  if (source === '365scores') return 2;
  if (source === 'api-football') return 3;
  return 9;
}

function sameTeam(left: unknown, right: unknown): boolean {
  const a = normalize(left);
  const b = normalize(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function payloadSideValue(payload: unknown, side: 'home' | 'away'): string | number | null {
  const record = asRecord(payload);
  if (!record) return null;
  const keys = side === 'home'
    ? ['homeValue', 'home', 'homeTeamValue', 'valueHome', 'home_value', 'homePercent', 'homePercentage']
    : ['awayValue', 'away', 'awayTeamValue', 'valueAway', 'away_value', 'awayPercent', 'awayPercentage'];
  for (const key of keys) {
    const value = cleanScalar(record[key]);
    if (value !== null) return value;
  }
  return null;
}

function validatePair(pair: StatPair, kind: PairKind = 'generic'): StatPair {
  let home = toNumber(pair.home);
  let away = toNumber(pair.away);
  if (kind === 'possession') {
    if (home === null || away === null) return { home: null, away: null };
    if (home >= 0 && away >= 0 && home <= 1 && away <= 1 && home + away >= 0.95 && home + away <= 1.05) {
      home *= 100;
      away *= 100;
    }
    const total = home + away;
    if (home < 0 || away < 0 || home > 100 || away > 100 || total < 80 || total > 105) return { home: null, away: null };
    return { home: Math.round(home), away: Math.round(away) };
  }
  if (kind === 'percent') {
    if (home === null || away === null) return pair;
    if (home >= 0 && away >= 0 && home <= 1 && away <= 1) return { home: Math.round(home * 100), away: Math.round(away * 100) };
    if (home < 0 || away < 0 || home > 100 || away > 100) return { home: null, away: null };
  }
  if (kind === 'passes' && home !== null && away !== null && home <= 5 && away <= 5) return { home: null, away: null };
  return pair;
}

function teamStatPair(stats: StatRow[], config: MetricConfig, homeName: string, awayName: string): StatPair {
  const matched = stats
    .filter((stat) => {
      const label = metricLabelText(stat);
      const text = config.strictLabelOnly ? label : metricFullText(stat);
      return hasAny(text, config.includes) && !hasAny(label, config.excludes) && !hasAny(payloadText(stat.source_payload), config.excludes);
    })
    .sort((a, b) => sourceRank(a.source_key) - sourceRank(b.source_key));

  const preferredSource = matched[0]?.source_key;
  const preferred = preferredSource ? matched.filter((stat) => stat.source_key === preferredSource) : matched;
  const pairedPayload = preferred.find((stat) => payloadSideValue(stat.source_payload, 'home') !== null || payloadSideValue(stat.source_payload, 'away') !== null);
  if (pairedPayload) return validatePair({ home: payloadSideValue(pairedPayload.source_payload, 'home'), away: payloadSideValue(pairedPayload.source_payload, 'away') }, config.kind ?? 'generic');

  const home = preferred.find((stat) => sameTeam(stat.team_name, homeName));
  const away = preferred.find((stat) => sameTeam(stat.team_name, awayName));
  if (home || away) return validatePair({ home: statDisplayValue(home), away: statDisplayValue(away) }, config.kind ?? 'generic');
  if (preferred.length >= 2) return validatePair({ home: statDisplayValue(preferred[0]), away: statDisplayValue(preferred[1]) }, config.kind ?? 'generic');
  if (matched.length >= 2) return validatePair({ home: statDisplayValue(matched[0]), away: statDisplayValue(matched[1]) }, config.kind ?? 'generic');
  return { home: null, away: null };
}

function countMappedValues(summary: Summary): number {
  return Object.values(summary).flatMap((value) => [value.home, value.away]).filter((value) => value !== null && value !== undefined && value !== '').length;
}

function buildSummary(stats: StatRow[], homeName: string, awayName: string): Summary {
  const summary: Summary = {};
  for (const config of SUMMARY_METRICS) {
    const pair = teamStatPair(stats, config, homeName, awayName);
    if (pair.home !== null || pair.away !== null) summary[config.label] = pair;
  }
  return summary;
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
        rawStats: stats,
      };
    });

    return NextResponse.json({
      competition: WORLD_CUP_2026_KEY,
      priority: 'FIFA first. 365Scores and API-Football only fill metrics missing from FIFA.',
      matches: formattedMatches,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('world cup persistent summary error:', error);
    return NextResponse.json({ error: 'Failed to load persistent World Cup data', matches: [] }, { status: 500 });
  }
}
