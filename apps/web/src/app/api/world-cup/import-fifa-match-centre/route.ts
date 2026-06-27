import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';

const WORLD_CUP_2026_KEY = 'world_cup_2026';
const DEFAULT_MATCH_CENTRE_URL = 'https://www.fifa.com/pt/match-centre/match/17/285023/289273/400021459';

type MatchRow = { id: number; home_team_id: number | null; away_team_id: number | null; home_team_name: string; away_team_name: string; fixture_key: string };
type StatCandidate = { metricKey: string; metricName: string; home: number | null; away: number | null; raw?: unknown; path?: string };
type ImportBody = { url?: string; homeTeamName?: string; awayTeamName?: string; dryRun?: boolean };

const TEAM_ALIASES: Record<string, string[]> = {
  turkiye: ['turkey', 'turkiye', 'turquia', 'türkiye', 'tur'],
  usa: ['usa', 'united states', 'eua', 'estados unidos', 'us'],
  portugal: ['portugal', 'por'],
  uzbekistan: ['uzbekistan', 'uzbequistao', 'uzbequistão', 'uzb'],
};

const METRIC_ALIASES: Record<string, string> = {
  possession: 'Posse de bola', ballpossession: 'Posse de bola', ball_possession: 'Posse de bola',
  shots: 'Finalizações', totalshots: 'Finalizações', total_shots: 'Finalizações', attempts: 'Finalizações', totalattempts: 'Finalizações',
  shotson_target: 'Finalizações no gol', shotsontarget: 'Finalizações no gol', attemptsontarget: 'Finalizações no gol', on_target: 'Finalizações no gol',
  corners: 'Escanteios', cornerkicks: 'Escanteios', corner_kicks: 'Escanteios',
  yellowcards: 'Cartões amarelos', yellow_cards: 'Cartões amarelos', cautions: 'Cartões amarelos',
  redcards: 'Cartões vermelhos', red_cards: 'Cartões vermelhos',
  fouls: 'Faltas', foulscommitted: 'Faltas', fouls_committed: 'Faltas',
  offsides: 'Impedimentos',
  passes: 'Passes totais', totalpasses: 'Passes totais', total_passes: 'Passes totais',
  passaccuracy: 'Precisão de passes', pass_accuracy: 'Precisão de passes', passingaccuracy: 'Precisão de passes',
  saves: 'Defesas do goleiro', goalkeepersaves: 'Defesas do goleiro', goalkeeper_saves: 'Defesas do goleiro',
  expectedgoals: 'Gols esperados (xG)', expected_goals: 'Gols esperados (xG)', xg: 'Gols esperados (xG)',
  crosses: 'Cruzamentos', tackles: 'Desarmes', interceptions: 'Interceptações', recoveries: 'Recuperações', clearances: 'Cortes defensivos',
  blocks: 'Bloqueios', blockedshots: 'Chutes bloqueados', duels: 'Duelos', aerialduels: 'Duelos aéreos', successfulpasses: 'Passes certos',
  passescompleted: 'Passes certos', passingcompletion: 'Precisão de passes', possessioncontest: 'Disputa de posse',
};

function normalize(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function compact(value: unknown) { return normalize(value).replace(/\s+/g, ''); }
function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace('%', '').replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function metricKeyFromName(name: unknown) {
  const c = compact(name);
  if (!c || c.length < 2) return null;
  if (METRIC_ALIASES[c]) return c;
  for (const key of Object.keys(METRIC_ALIASES)) if (c.includes(key) || key.includes(c)) return key;
  if (c.length <= 42 && /[a-z]/.test(c)) return c.replace(/[^a-z0-9]+/g, '_');
  return null;
}
function metricName(key: string, fallback?: unknown) { return METRIC_ALIASES[key] ?? String(fallback ?? key).replace(/_/g, ' '); }
function teamKey(name: unknown) {
  const n = normalize(name);
  for (const [canonical, aliases] of Object.entries(TEAM_ALIASES)) if (aliases.some((a) => n === normalize(a) || n.includes(normalize(a)))) return canonical;
  return n;
}
function sameTeam(a: unknown, b: unknown) { const ak = teamKey(a); const bk = teamKey(b); return ak && bk && (ak === bk || ak.includes(bk) || bk.includes(ak)); }

async function findMatch(homeName: string, awayName: string): Promise<MatchRow | null> {
  const rows = (await sql`
    SELECT id, home_team_id, away_team_id, home_team_name, away_team_name, fixture_key
    FROM world_cup_matches
    WHERE competition_key = ${WORLD_CUP_2026_KEY}
      AND fixture_key NOT LIKE 'fifa:pdf:%'
    ORDER BY kickoff_at DESC NULLS LAST, id DESC
    LIMIT 300
  `) as MatchRow[];
  return rows.find((row) => (sameTeam(row.home_team_name, homeName) && sameTeam(row.away_team_name, awayName)) || (sameTeam(row.home_team_name, awayName) && sameTeam(row.away_team_name, homeName))) ?? null;
}

function extractJsonBlocks(html: string) {
  const blocks: unknown[] = [];
  const next = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (next?.[1]) { try { blocks.push(JSON.parse(next[1])); } catch {} }
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { blocks.push(JSON.parse(match[1])); } catch {}
  }
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)) {
    try { blocks.push(JSON.parse(JSON.parse('"' + match[1].replace(/"/g, '\\"') + '"'))); } catch {}
  }
  return blocks;
}

function statFromObject(obj: Record<string, unknown>, path: string): StatCandidate | null {
  const label = obj.name ?? obj.label ?? obj.title ?? obj.statName ?? obj.type ?? obj.key ?? obj.code ?? obj.metricName ?? obj.metric;
  const metricKey = metricKeyFromName(label);
  if (!metricKey) return null;
  const home = numberValue(obj.home) ?? numberValue(obj.homeValue) ?? numberValue(obj.homeTeamValue) ?? numberValue(obj.team1Value) ?? numberValue(obj.teamAValue) ?? numberValue(obj.valueHome);
  const away = numberValue(obj.away) ?? numberValue(obj.awayValue) ?? numberValue(obj.awayTeamValue) ?? numberValue(obj.team2Value) ?? numberValue(obj.teamBValue) ?? numberValue(obj.valueAway);
  if (home === null || away === null) return null;
  return { metricKey, metricName: metricName(metricKey, label), home, away, raw: obj, path };
}

function collectStats(value: unknown, path = '$', out: StatCandidate[] = []) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) { value.forEach((item, index) => collectStats(item, `${path}[${index}]`, out)); return out; }
  const obj = value as Record<string, unknown>;
  const direct = statFromObject(obj, path);
  if (direct) out.push(direct);
  for (const [key, child] of Object.entries(obj)) {
    if (['raw', 'payload'].includes(key)) continue;
    collectStats(child, `${path}.${key}`, out);
  }
  return out;
}

function dedupeStats(stats: StatCandidate[]) {
  const byKey = new Map<string, StatCandidate>();
  for (const stat of stats) {
    if (stat.home === null || stat.away === null) continue;
    if (!byKey.has(stat.metricKey)) byKey.set(stat.metricKey, stat);
  }
  return Array.from(byKey.values());
}

async function savePair(match: MatchRow, stat: StatCandidate, url: string, reversed: boolean) {
  const homeTeamId = reversed ? match.away_team_id : match.home_team_id;
  const awayTeamId = reversed ? match.home_team_id : match.away_team_id;
  const homeValue = reversed ? stat.away : stat.home;
  const awayValue = reversed ? stat.home : stat.away;
  let saved = 0;
  for (const side of [{ teamId: homeTeamId, value: homeValue, side: 'home' }, { teamId: awayTeamId, value: awayValue, side: 'away' }] as const) {
    if (!side.teamId || side.value === null) continue;
    await sql`
      INSERT INTO world_cup_match_statistics (match_id, team_id, period, metric_key, metric_name, value_numeric, source_key, source_payload, source_updated_at)
      VALUES (${match.id}, ${side.teamId}, 'match', ${stat.metricKey}, ${stat.metricName}, ${side.value}, 'fifa', ${JSON.stringify({ importedBy: 'fifa-match-centre', matchCentreUrl: url, side: side.side, raw: stat.raw, path: stat.path })}::jsonb, NOW())
      ON CONFLICT ON CONSTRAINT world_cup_match_statistics_unique
      DO UPDATE SET metric_name = EXCLUDED.metric_name, value_numeric = EXCLUDED.value_numeric, source_payload = EXCLUDED.source_payload, source_updated_at = EXCLUDED.source_updated_at
    `;
    saved += 1;
  }
  return saved;
}

async function runImport(body: ImportBody) {
  const url = body.url || DEFAULT_MATCH_CENTRE_URL;
  if (!/^https:\/\/www\.fifa\.com\//i.test(url)) return NextResponse.json({ success: false, error: 'Informe a URL oficial do Match Centre da FIFA.' }, { status: 400 });
  const homeTeamName = body.homeTeamName ?? 'Turquia';
  const awayTeamName = body.awayTeamName ?? 'EUA';
  const response = await fetch(url, { cache: 'no-store', headers: { 'user-agent': 'Mozilla/5.0 CantosEstatisticas/1.0' } });
  if (!response.ok) return NextResponse.json({ success: false, error: `Falha ao acessar FIFA Match Centre: HTTP ${response.status}` }, { status: 502 });
  const html = await response.text();
  const jsonBlocks = extractJsonBlocks(html);
  const extractedStats = dedupeStats(jsonBlocks.flatMap((block, index) => collectStats(block, `$json[${index}]`)));
  const match = await findMatch(homeTeamName, awayTeamName);
  if (!match) return NextResponse.json({ success: false, error: 'Partida não encontrada no banco.', detected: { homeTeamName, awayTeamName }, extractedStats }, { status: 404 });
  const reversed = sameTeam(match.home_team_name, awayTeamName) && sameTeam(match.away_team_name, homeTeamName);
  let savedValues = 0;
  if (!body.dryRun) for (const stat of extractedStats) savedValues += await savePair(match, stat, url, reversed);
  return NextResponse.json({
    success: true,
    dryRun: Boolean(body.dryRun),
    match,
    parser: { htmlLength: html.length, jsonBlocks: jsonBlocks.length, strategy: 'fifa-match-centre-json-recursive' },
    extractedStats,
    savedValues,
    warning: extractedStats.length === 0 ? 'A página foi acessada, mas não encontrei estatísticas estruturadas no HTML inicial. Pode exigir endpoint interno da FIFA ou renderização client-side.' : null,
    source: url,
    lastUpdated: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    return await runImport({
      url: params.get('url') || DEFAULT_MATCH_CENTRE_URL,
      homeTeamName: params.get('homeTeamName') || 'Turquia',
      awayTeamName: params.get('awayTeamName') || 'EUA',
      dryRun: params.get('dryRun') !== 'false',
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro ao importar FIFA Match Centre.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    return await runImport((await request.json()) as ImportBody);
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro ao importar FIFA Match Centre.' }, { status: 500 });
  }
}
