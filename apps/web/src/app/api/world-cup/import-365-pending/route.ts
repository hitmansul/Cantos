import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { scores365Get } from '@/app/api/utils/scores365';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const WORLD_CUP_2026_KEY = 'world_cup_2026';
const SOURCE_KEY = '365scores';

type MatchRow = {
  id: number;
  fixture_key: string | null;
  scores365_event_id: string | number | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team_name: string;
  away_team_name: string;
  home_score: number | null;
  away_score: number | null;
  kickoff_at: string | null;
  status: string | null;
  source_payload: unknown;
  fifa_stats_count: string | number;
  scores365_stats_count: string | number;
};

type Scores365Statistic = {
  id?: number;
  name?: string;
  competitorId?: number;
  categoryId?: number;
  categoryName?: string;
  isMajor?: boolean;
  value?: number | string;
  order?: number;
  categoryOrder?: number;
};

type Scores365Game = {
  id?: number;
  homeCompetitor?: { id?: number; name?: string; score?: number };
  awayCompetitor?: { id?: number; name?: string; score?: number };
};

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace('%', '').replace(',', '.').trim());
  return Number.isFinite(number) ? number : null;
}
function normalize(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function metricKey(name?: string) {
  const key = normalize(name);
  if (!key) return 'unknown';
  if (key.includes('corner') || key.includes('escanteio') || key === 'cantos') return 'corners';
  if (key.includes('possession') || key.includes('posse')) return 'possession';
  if (key.includes('shots on') || key.includes('chutes no gol') || key.includes('finalizacoes no gol') || key.includes('no gol')) return 'shots_on_target';
  if (key.includes('shot') || key.includes('chute') || key.includes('finaliz')) return 'shots';
  if (key.includes('yellow') || key.includes('amarelo')) return 'yellow_cards';
  if (key.includes('red') || key.includes('vermelho')) return 'red_cards';
  if (key.includes('foul') || key.includes('falta')) return 'fouls';
  if (key.includes('offside') || key.includes('imped')) return 'offsides';
  if (key.includes('save') || key.includes('defesa')) return 'goalkeeper_saves';
  if (key.includes('xg') || key.includes('expected')) return 'expected_goals';
  if (key.includes('pass')) return key.includes('complete') || key.includes('conclu') ? 'completed_passes' : 'passes';
  if (key.includes('cross') || key.includes('cruzamento')) return key.includes('complete') || key.includes('conclu') ? 'completed_crosses' : 'crosses';
  return key.replace(/\s+/g, '_');
}
function score365IdFromFixtureKey(key: string | null) {
  const match = String(key ?? '').match(/^scores365:(\d+):/);
  return match?.[1] ?? null;
}
function sourcePayloadRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function payloadCompetitorId(payload: unknown, side: 'home' | 'away') {
  const record = sourcePayloadRecord(payload);
  const competitor = sourcePayloadRecord(record[side === 'home' ? 'homeCompetitor' : 'awayCompetitor']);
  const id = Number(competitor.id);
  return Number.isFinite(id) ? id : null;
}
async function getMatches(limit: number, localMatchId?: string | null) {
  if (localMatchId) {
    return (await sql`
      SELECT m.*, COUNT(s.id) FILTER (WHERE s.source_key = 'fifa') AS fifa_stats_count, COUNT(s.id) FILTER (WHERE s.source_key = '365scores') AS scores365_stats_count
      FROM world_cup_matches m
      LEFT JOIN world_cup_match_statistics s ON s.match_id = m.id
      WHERE m.competition_key = ${WORLD_CUP_2026_KEY} AND m.id = ${Number(localMatchId)}
      GROUP BY m.id
      LIMIT 1
    `) as MatchRow[];
  }
  return (await sql`
    SELECT m.*, COUNT(s.id) FILTER (WHERE s.source_key = 'fifa') AS fifa_stats_count, COUNT(s.id) FILTER (WHERE s.source_key = '365scores') AS scores365_stats_count
    FROM world_cup_matches m
    LEFT JOIN world_cup_match_statistics s ON s.match_id = m.id
    WHERE m.competition_key = ${WORLD_CUP_2026_KEY}
      AND (m.status ILIKE '%fim%' OR m.status ILIKE '%final%' OR m.status ILIKE '%finished%' OR m.status ILIKE '%prorroga%' OR m.status ILIKE '%penalt%' OR m.home_score IS NOT NULL OR m.away_score IS NOT NULL)
      AND (m.scores365_event_id IS NOT NULL OR m.fixture_key LIKE 'scores365:%')
    GROUP BY m.id
    HAVING COUNT(s.id) FILTER (WHERE s.source_key = '365scores') < 20
    ORDER BY m.kickoff_at DESC NULLS LAST, m.id DESC
    LIMIT ${limit}
  `) as MatchRow[];
}
async function fetchGame(gameId: string): Promise<Scores365Game | null> {
  const attempts = [
    ['/web/game/', { gameId }],
    ['/web/game/', { games: gameId }],
    ['/web/games/current/', { gameIds: gameId }],
  ] as const;
  for (const [path, params] of attempts) {
    try {
      const data = await scores365Get(path, params);
      const record = sourcePayloadRecord(data);
      const game = record.game ?? (Array.isArray(record.games) ? record.games[0] : null);
      if (game && typeof game === 'object') return game as Scores365Game;
    } catch {}
  }
  return null;
}
async function fetchStats(gameId: string) {
  const data = await scores365Get('/web/game/stats/', { games: gameId }) as { statistics?: Scores365Statistic[] };
  return data.statistics ?? [];
}
function resolveCompetitors(match: MatchRow, stats: Scores365Statistic[], game: Scores365Game | null) {
  const payloadHome = payloadCompetitorId(match.source_payload, 'home');
  const payloadAway = payloadCompetitorId(match.source_payload, 'away');
  const gameHome = Number(game?.homeCompetitor?.id);
  const gameAway = Number(game?.awayCompetitor?.id);
  const distinct = Array.from(new Set(stats.map((stat) => Number(stat.competitorId)).filter((id) => Number.isFinite(id))));
  const home = payloadHome ?? (Number.isFinite(gameHome) ? gameHome : null);
  const away = payloadAway ?? (Number.isFinite(gameAway) ? gameAway : null);
  if (home && away) return { home, away, method: payloadHome && payloadAway ? 'source_payload' : 'game_endpoint' };
  if (distinct.length === 2) return { home: distinct[0], away: distinct[1], method: 'stats_order_fallback' };
  return { home: null, away: null, method: 'unresolved' };
}
async function saveStats(match: MatchRow, gameId: string, stats: Scores365Statistic[], homeCompetitorId: number, awayCompetitorId: number, dryRun: boolean) {
  const rows = [] as Array<{ teamId: number; period: string; metricKey: string; metricName: string; valueNumeric: number | null; valueText: string | null; sourcePayload: Scores365Statistic }>;
  const seen = new Set<string>();
  for (const stat of stats) {
    const competitorId = Number(stat.competitorId);
    const teamId = competitorId === homeCompetitorId ? match.home_team_id : competitorId === awayCompetitorId ? match.away_team_id : null;
    if (!teamId) continue;
    const key = metricKey(stat.name);
    const valueNumeric = cleanNumber(stat.value);
    const dedupe = `${teamId}:match:${key}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    rows.push({
      teamId: Number(teamId),
      period: 'match',
      metricKey: key,
      metricName: stat.name ?? 'Estatística',
      valueNumeric,
      valueText: valueNumeric === null ? String(stat.value ?? '') : null,
      sourcePayload: stat,
    });
  }
  if (dryRun || rows.length === 0) return { parsedRows: rows.length, savedRows: 0 };
  let savedRows = 0;
  for (const row of rows) {
    const payload = JSON.stringify({ ...row.sourcePayload, importedBy: 'import-365-pending', scores365GameId: gameId });
    await sql`
      INSERT INTO world_cup_match_statistics (match_id, team_id, period, metric_key, metric_name, value_numeric, value_text, source_key, source_payload, source_updated_at)
      VALUES (${match.id}, ${row.teamId}, ${row.period}, ${row.metricKey}, ${row.metricName}, ${row.valueNumeric}, ${row.valueText}, ${SOURCE_KEY}, ${payload}::jsonb, NOW())
      ON CONFLICT ON CONSTRAINT world_cup_match_statistics_unique
      DO UPDATE SET
        metric_name = EXCLUDED.metric_name,
        value_numeric = EXCLUDED.value_numeric,
        value_text = EXCLUDED.value_text,
        source_key = EXCLUDED.source_key,
        source_payload = EXCLUDED.source_payload,
        source_updated_at = NOW()
    `;
    savedRows += 1;
  }
  await sql`UPDATE world_cup_matches SET scores365_event_id = COALESCE(scores365_event_id, ${gameId}), source_payload = COALESCE(source_payload, '{}'::jsonb) || ${JSON.stringify({ scores365EventId: gameId, scores365StatsBackfilled: true })}::jsonb, source_updated_at = NOW(), updated_at = NOW() WHERE id = ${match.id}`;
  return { parsedRows: rows.length, savedRows };
}
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const dryRun = params.get('dryRun') !== 'false';
    const limit = Math.max(1, Math.min(5, Number(params.get('limit') ?? 1)));
    const localMatchId = params.get('localMatchId') ?? params.get('matchId');
    const matches = await getMatches(limit, localMatchId);
    const attempts = [] as unknown[];
    let totalSaved = 0;
    let totalParsed = 0;
    for (const match of matches) {
      const gameId = String(match.scores365_event_id ?? score365IdFromFixtureKey(match.fixture_key) ?? '');
      if (!/^\d+$/.test(gameId)) {
        attempts.push({ localMatchId: match.id, home: match.home_team_name, away: match.away_team_name, skipped: 'sem scores365GameId' });
        continue;
      }
      const [stats, game] = await Promise.all([fetchStats(gameId), fetchGame(gameId)]);
      const competitors = resolveCompetitors(match, stats, game);
      if (!competitors.home || !competitors.away) {
        attempts.push({ localMatchId: match.id, gameId, home: match.home_team_name, away: match.away_team_name, statsFetched: stats.length, competitors, savedRows: 0 });
        continue;
      }
      const saved = await saveStats(match, gameId, stats, competitors.home, competitors.away, dryRun);
      totalSaved += saved.savedRows;
      totalParsed += saved.parsedRows;
      attempts.push({ localMatchId: match.id, gameId, home: match.home_team_name, away: match.away_team_name, statsFetched: stats.length, competitors, ...saved });
    }
    return NextResponse.json({
      success: totalParsed > 0 || matches.length === 0,
      dryRun,
      provider: SOURCE_KEY,
      strategy: 'Backfill 365Scores timeout-safe: processa poucos jogos por chamada e usa UPSERT para não falhar com estatísticas já existentes.',
      matchesChecked: matches.length,
      totalParsed,
      totalSaved,
      attempts,
      nextStep: totalSaved > 0 ? 'Rode novamente até totalSaved zerar e a tela Resultados não mostrar jogos com 0 dados.' : null,
      lastUpdated: new Date().toISOString(),
    }, { status: totalParsed > 0 || matches.length === 0 ? 200 : 207 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro no backfill 365Scores.' }, { status: 500 });
  }
}
