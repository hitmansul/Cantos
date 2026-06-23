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

type Summary = {
  possession: StatPair;
  shots: StatPair;
  shotsOnGoal: StatPair;
  corners: StatPair;
  yellowCards: StatPair;
  redCards: StatPair;
  fouls: StatPair;
  offsides: StatPair;
  passes: StatPair;
  passAccuracy: StatPair;
  goalkeeperSaves: StatPair;
  xg: string | null;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function payloadText(value: unknown): string {
  try {
    return normalize(JSON.stringify(value ?? ''));
  } catch {
    return '';
  }
}

function metricText(stat: StatRow): string {
  return normalize(`${stat.metric_key ?? ''} ${stat.metric_name ?? ''} ${payloadText(stat.source_payload)}`);
}

function hasAny(text: string, terms: string[]): boolean {
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

  const directKeys = [
    'value',
    'statValue',
    'amount',
    'total',
    'displayValue',
    'formattedValue',
    'numericValue',
    'percentage',
    'percent',
  ];

  for (const key of directKeys) {
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

function sourceRank(source?: string): number {
  if (source === 'fifa') return 1;
  if (source === '365scores') return 2;
  if (source === 'api-football') return 3;
  return 9;
}

function sameTeam(left: unknown, right: unknown): boolean {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function payloadSideValue(payload: unknown, side: 'home' | 'away'): string | number | null {
  const record = asRecord(payload);
  if (!record) return null;
  const keys = side === 'home'
    ? ['homeValue', 'home', 'homeTeamValue', 'valueHome', 'home_value']
    : ['awayValue', 'away', 'awayTeamValue', 'valueAway', 'away_value'];

  for (const key of keys) {
    const value = cleanScalar(record[key]);
    if (value !== null) return value;
  }

  return null;
}

function statValue(stats: StatRow[], includes: string[]): string | null {
  const found = [...stats]
    .sort((a, b) => sourceRank(a.source_key) - sourceRank(b.source_key))
    .find((stat) => hasAny(metricText(stat), includes));
  const value = statDisplayValue(found);
  return value === null ? null : String(value);
}

function teamStatPair(stats: StatRow[], includes: string[], homeName: string, awayName: string): StatPair {
  const matched = stats
    .filter((stat) => hasAny(metricText(stat), includes))
    .sort((a, b) => sourceRank(a.source_key) - sourceRank(b.source_key));

  const pairedPayload = matched.find((stat) => payloadSideValue(stat.source_payload, 'home') !== null || payloadSideValue(stat.source_payload, 'away') !== null);
  if (pairedPayload) {
    return {
      home: payloadSideValue(pairedPayload.source_payload, 'home'),
      away: payloadSideValue(pairedPayload.source_payload, 'away'),
    };
  }

  const home = matched.find((stat) => sameTeam(stat.team_name, homeName));
  const away = matched.find((stat) => sameTeam(stat.team_name, awayName));

  if (home || away) return { home: statDisplayValue(home), away: statDisplayValue(away) };

  const firstSource = matched[0]?.source_key;
  const sameSource = matched.filter((stat) => stat.source_key === firstSource);
  if (sameSource.length >= 2) return { home: statDisplayValue(sameSource[0]), away: statDisplayValue(sameSource[1]) };
  if (matched.length >= 2) return { home: statDisplayValue(matched[0]), away: statDisplayValue(matched[1]) };

  return { home: null, away: null };
}

function countMappedValues(summary: Summary): number {
  return Object.values(summary).flatMap((value) => {
    if (value && typeof value === 'object' && 'home' in value && 'away' in value) return [value.home, value.away];
    return [value];
  }).filter((value) => value !== null && value !== undefined && value !== '').length;
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
      const summary: Summary = {
        possession: teamStatPair(stats, ['possession', 'ball possession', 'posse'], match.home_team_name, match.away_team_name),
        shots: teamStatPair(stats, ['total shots', 'total attempts', 'goal attempts', 'attempts', 'shots', 'shot attempts', 'finalizacao', 'finalizacoes', 'chutes'], match.home_team_name, match.away_team_name),
        shotsOnGoal: teamStatPair(stats, ['shots on target', 'attempts on target', 'on target', 'shot on goal', 'chute no gol', 'chutes no gol', 'finalizacoes no gol'], match.home_team_name, match.away_team_name),
        corners: teamStatPair(stats, ['corner', 'corners', 'corner kick', 'corner kicks', 'escanteio', 'escanteios'], match.home_team_name, match.away_team_name),
        yellowCards: teamStatPair(stats, ['yellow card', 'yellow cards', 'cautions', 'cartao amarelo', 'cartoes amarelos'], match.home_team_name, match.away_team_name),
        redCards: teamStatPair(stats, ['red card', 'red cards', 'send off', 'cartao vermelho', 'cartoes vermelhos'], match.home_team_name, match.away_team_name),
        fouls: teamStatPair(stats, ['fouls committed', 'fouls', 'foul', 'falta', 'faltas'], match.home_team_name, match.away_team_name),
        offsides: teamStatPair(stats, ['offsides', 'offside', 'impedimento', 'impedimentos'], match.home_team_name, match.away_team_name),
        passes: teamStatPair(stats, ['passes completed', 'passes', 'passes attempted'], match.home_team_name, match.away_team_name),
        passAccuracy: teamStatPair(stats, ['pass accuracy', 'pass completion', 'precisao passe'], match.home_team_name, match.away_team_name),
        goalkeeperSaves: teamStatPair(stats, ['goalkeeper saves', 'saves', 'defesas'], match.home_team_name, match.away_team_name),
        xg: statValue(stats, ['expected goals', 'xg']),
      };

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
      priority: 'FIFA first, then 365Scores, then API-Football when the same metric exists from more than one source.',
      matches: formattedMatches,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('world cup persistent summary error:', error);
    return NextResponse.json({ error: 'Failed to load persistent World Cup data', matches: [] }, { status: 500 });
  }
}
