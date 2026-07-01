import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const WORLD_CUP_2026_KEY = 'world_cup_2026';
const DEFAULT_URL = 'https://www.fifa.com/pt/match-centre/match/17/285023/289287/400021516';

type MatchRow = { id: number; home_team_id: number | null; away_team_id: number | null; home_team_name: string; away_team_name: string; fixture_key: string; fifa_match_id?: string | null };
type Stat = { metricKey: string; metricName: string; home: number | null; away: number | null; raw?: unknown; path?: string; sourceUrl?: string };

type Body = { url?: string; matchCentreUrl?: string; fifaMatchId?: string | number; localMatchId?: string | number; homeTeamName?: string; awayTeamName?: string; dryRun?: boolean; debug?: boolean };

const METRICS: Record<string, string> = {
  possession: 'Posse de bola', ballpossession: 'Posse de bola', possessionpercentage: 'Posse de bola', possessionpct: 'Posse de bola',
  shots: 'Finalizações', totalshots: 'Finalizações', attempts: 'Finalizações', totalattempts: 'Finalizações', attemptsatgoal: 'Finalizações',
  shotsontarget: 'Finalizações no gol', shotson_target: 'Finalizações no gol', attemptsontarget: 'Finalizações no gol', ontarget: 'Finalizações no gol',
  corners: 'Escanteios', cornerkicks: 'Escanteios', corner: 'Escanteios',
  yellowcards: 'Cartões amarelos', redcards: 'Cartões vermelhos', fouls: 'Faltas', foulscommitted: 'Faltas', offsides: 'Impedimentos',
  passes: 'Passes totais', totalpasses: 'Passes totais', passaccuracy: 'Precisão de passes', passingaccuracy: 'Precisão de passes',
  saves: 'Defesas do goleiro', goalkeepersaves: 'Defesas do goleiro', expectedgoals: 'Gols esperados (xG)', xg: 'Gols esperados (xG)',
  crosses: 'Cruzamentos', tackles: 'Desarmes', interceptions: 'Interceptações', recoveries: 'Recuperações', clearances: 'Cortes defensivos', blocks: 'Bloqueios', duels: 'Duelos'
};
const KEYS = Object.keys(METRICS);

function normalize(value: unknown) { return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function compact(value: unknown) { return normalize(value).replace(/\s+/g, ''); }
function sameTeam(a: unknown, b: unknown) { const x = normalize(a); const y = normalize(b); return Boolean(x && y && (x === y || x.includes(y) || y.includes(x))); }
function metricKey(value: unknown) { const c = compact(value); if (!c) return null; if (METRICS[c]) return c; for (const key of KEYS) if (c.includes(key) || key.includes(c)) return key; return null; }
function metricName(key: string) { return METRICS[key] ?? key; }
function num(value: unknown): number | null { if (typeof value === 'number' && Number.isFinite(value)) return value; if (typeof value === 'string') { const n = Number(value.replace('%', '').replace(',', '.').trim()); return Number.isFinite(n) ? n : null; } if (value && typeof value === 'object' && !Array.isArray(value)) { const obj = value as Record<string, unknown>; for (const key of ['value','Value','statValue','numericValue','total','count','home','away','displayValue']) { const n = num(obj[key]); if (n !== null) return n; } } return null; }
function idsFromUrl(url: string) { const m = url.match(/\/match-centre\/match\/(\d+)\/(\d+)\/(\d+)\/(\d+)/i); return m ? { matchId: m[4] } : null; }
function urlFromMatchId(matchId: string | number) { return `https://www.fifa.com/pt/match-centre/match/17/285023/289287/${matchId}`; }
function preview(value: unknown, max = 600) { return String(typeof value === 'string' ? value : JSON.stringify(value) ?? '').slice(0, max); }

function statFromObject(obj: Record<string, unknown>, path: string, sourceUrl?: string): Stat | null {
  const label = obj.name ?? obj.Name ?? obj.label ?? obj.title ?? obj.statName ?? obj.metricName ?? obj.metric ?? obj.key ?? obj.type ?? obj.typeName ?? path.split('.').pop();
  const key = metricKey(label) ?? metricKey(path);
  if (!key) return null;
  const home = num(obj.home) ?? num(obj.homeValue) ?? num(obj.HomeValue) ?? num(obj.homeTeamValue) ?? num(obj.team1Value) ?? num(obj.valueHome) ?? num(obj.homeTeam) ?? num(obj.HomeTeam);
  const away = num(obj.away) ?? num(obj.awayValue) ?? num(obj.AwayValue) ?? num(obj.awayTeamValue) ?? num(obj.team2Value) ?? num(obj.valueAway) ?? num(obj.awayTeam) ?? num(obj.AwayTeam);
  if (home !== null && away !== null) return { metricKey: key, metricName: metricName(key), home, away, raw: obj, path, sourceUrl };
  for (const arrKey of ['values','items','teams','statistics','stats','data','children']) {
    const arr = obj[arrKey];
    if (!Array.isArray(arr) || arr.length < 2) continue;
    const a = num(arr[0]); const b = num(arr[1]);
    if (a !== null && b !== null) return { metricKey: key, metricName: metricName(key), home: a, away: b, raw: obj, path, sourceUrl };
  }
  return null;
}
function collect(value: unknown, path = '$', out: Stat[] = [], sourceUrl?: string) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) { value.forEach((item, index) => collect(item, `${path}[${index}]`, out, sourceUrl)); return out; }
  const obj = value as Record<string, unknown>;
  const direct = statFromObject(obj, path, sourceUrl); if (direct) out.push(direct);
  const home = obj.HomeTeam ?? obj.homeTeam ?? obj.home; const away = obj.AwayTeam ?? obj.awayTeam ?? obj.away;
  if (home && away && typeof home === 'object' && typeof away === 'object' && !Array.isArray(home) && !Array.isArray(away)) {
    const h = home as Record<string, unknown>; const a = away as Record<string, unknown>;
    for (const key of Object.keys(h)) { const mk = metricKey(key); const hv = num(h[key]); const av = num(a[key]); if (mk && hv !== null && av !== null) out.push({ metricKey: mk, metricName: metricName(mk), home: hv, away: av, raw: { home: h[key], away: a[key] }, path: `${path}.teams.${key}`, sourceUrl }); }
  }
  for (const [key, child] of Object.entries(obj)) { const mk = metricKey(key); if (mk && child && typeof child === 'object' && !Array.isArray(child)) { const nested = statFromObject({ ...(child as Record<string, unknown>), key }, `${path}.${key}`, sourceUrl); if (nested) out.push(nested); } collect(child, `${path}.${key}`, out, sourceUrl); }
  return out;
}
function extractTextStats(text: string): Stat[] {
  const stats: Stat[] = [];
  const normalized = text.replace(/\s+/g, ' ');
  const aliases: Record<string, string[]> = {
    possession: ['possession', 'posse de bola'], shots: ['shots', 'total attempts', 'finalizações', 'finalizacoes'], shotsontarget: ['shots on target', 'on target', 'finalizações no gol', 'finalizacoes no gol'], corners: ['corners', 'corner kicks', 'escanteios'], fouls: ['fouls', 'faltas'], offsides: ['offsides', 'impedimentos'], passes: ['total passes', 'passes totais'], expectedgoals: ['expected goals', 'xg', 'gols esperados']
  };
  for (const [key, words] of Object.entries(aliases)) for (const word of words) { const m = normalized.match(new RegExp(`${word}[^0-9-]{0,160}(-?\\d+(?:[,.]\\d+)?%?)[^0-9-]{1,160}(-?\\d+(?:[,.]\\d+)?%?)`, 'i')); const h = num(m?.[1]); const a = num(m?.[2]); if (h !== null && a !== null) stats.push({ metricKey: key, metricName: metricName(key), home: h, away: a, path: 'browser-page-text', sourceUrl: 'browser' }); }
  return stats;
}
function dedupe(stats: Stat[]) { const by = new Map<string, Stat>(); for (const stat of stats) { if (stat.home === null || stat.away === null) continue; if (!by.has(stat.metricKey)) by.set(stat.metricKey, stat); else if (String(stat.path).length < String(by.get(stat.metricKey)?.path).length) by.set(stat.metricKey, stat); } return Array.from(by.values()); }

async function findMatch(body: Body, url: string): Promise<MatchRow | null> {
  if (body.localMatchId) { const rows = await sql`SELECT id, home_team_id, away_team_id, home_team_name, away_team_name, fixture_key, fifa_match_id FROM world_cup_matches WHERE id = ${Number(body.localMatchId)} LIMIT 1`; if (rows[0]) return rows[0] as MatchRow; }
  const officialId = String(body.fifaMatchId ?? idsFromUrl(url)?.matchId ?? '');
  if (officialId) { const rows = await sql`SELECT id, home_team_id, away_team_id, home_team_name, away_team_name, fixture_key, fifa_match_id FROM world_cup_matches WHERE competition_key = ${WORLD_CUP_2026_KEY} AND fifa_match_id = ${officialId} LIMIT 1`; if (rows[0]) return rows[0] as MatchRow; }
  return null;
}
async function save(match: MatchRow, stat: Stat, url: string, officialId: string, reversed: boolean) {
  const rows = [
    { teamId: reversed ? match.away_team_id : match.home_team_id, value: reversed ? stat.away : stat.home, side: 'home' },
    { teamId: reversed ? match.home_team_id : match.away_team_id, value: reversed ? stat.home : stat.away, side: 'away' },
  ];
  let count = 0;
  for (const row of rows) {
    if (!row.teamId || row.value === null) continue;
    await sql`DELETE FROM world_cup_match_statistics WHERE match_id = ${match.id} AND team_id = ${row.teamId} AND period = 'match' AND metric_key = ${stat.metricKey} AND source_key = 'fifa'`;
    await sql`INSERT INTO world_cup_match_statistics (match_id, team_id, period, metric_key, metric_name, value_numeric, source_key, source_payload, source_updated_at) VALUES (${match.id}, ${row.teamId}, 'match', ${stat.metricKey}, ${stat.metricName}, ${Number(row.value)}, 'fifa', ${JSON.stringify({ importedBy: 'fifa-match-centre-browser-network', matchCentreUrl: url, fifaMatchId: officialId, sourceUrl: stat.sourceUrl, path: stat.path, raw: stat.raw, side: row.side })}::jsonb, NOW())`;
    count += 1;
  }
  return count;
}

async function run(request: NextRequest, body: Body) {
  const url = body.matchCentreUrl ?? body.url ?? (body.fifaMatchId ? urlFromMatchId(body.fifaMatchId) : DEFAULT_URL);
  const officialId = String(body.fifaMatchId ?? idsFromUrl(url)?.matchId ?? '');
  const captureUrl = `${request.nextUrl.origin}/api/world-cup/fifa-match-centre-browser-capture?url=${encodeURIComponent(url)}&waitMs=8000`;
  const captureResponse = await fetch(captureUrl, { cache: 'no-store' });
  const capturePayload: any = await captureResponse.json().catch(() => null);
  if (!captureResponse.ok || !capturePayload?.success) return NextResponse.json({ success: false, error: 'Falha na captura de rede com navegador.', captureStatus: captureResponse.status, capturePayload }, { status: 502 });
  const stats = dedupe([
    ...((capturePayload.responses ?? []).flatMap((item: any, index: number) => item.json ? collect(item.json, `$network[${index}]`, [], item.url) : [])),
    ...extractTextStats(capturePayload.pageText ?? ''),
  ]);
  const match = await findMatch(body, url);
  if (!match) return NextResponse.json({ success: false, error: 'Partida não encontrada no banco para salvar estatísticas capturadas.', detected: { officialId, url }, extractedStats: stats, captureSummary: { capturedCount: capturePayload.capturedCount, likelyStatsCount: capturePayload.likelyStatsCount } }, { status: 404 });
  const reversed = Boolean(body.homeTeamName && body.awayTeamName && sameTeam(match.home_team_name, body.awayTeamName) && sameTeam(match.away_team_name, body.homeTeamName));
  let savedValues = 0;
  if (!body.dryRun) {
    if (officialId) await sql`UPDATE world_cup_matches SET fifa_match_id = ${officialId}, source_payload = COALESCE(source_payload, '{}'::jsonb) || ${JSON.stringify({ fifaMatchId: officialId, matchCentreUrl: url, browserCapture: true })}::jsonb, source_updated_at = NOW(), updated_at = NOW() WHERE id = ${match.id}`;
    for (const stat of stats) savedValues += await save(match, stat, url, officialId, reversed);
  }
  return NextResponse.json({
    success: true,
    dryRun: Boolean(body.dryRun),
    strategy: 'Browser network capture: Playwright captura XHR/fetch reais e importa pares de estatísticas.',
    match,
    detected: { fifaMatchId: officialId, matchCentreUrl: url },
    parser: { capturedCount: capturePayload.capturedCount, likelyStatsCount: capturePayload.likelyStatsCount, pageTextLength: String(capturePayload.pageText ?? '').length },
    extractedStats: stats,
    savedValues,
    warning: stats.length === 0 ? 'O navegador carregou a página, mas as respostas capturadas não continham pares de estatística reconhecíveis.' : null,
    debug: body.debug ? { likelyStats: capturePayload.likelyStats, pageText: capturePayload.pageText, samples: (capturePayload.responses ?? []).slice(0, 10).map((r: any) => ({ url: r.url, score: r.score, preview: r.textPreview ?? preview(r.json) })) } : undefined,
    lastUpdated: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  try { const p = request.nextUrl.searchParams; return await run(request, { url: p.get('url') ?? undefined, matchCentreUrl: p.get('matchCentreUrl') ?? undefined, fifaMatchId: p.get('fifaMatchId') ?? undefined, localMatchId: p.get('localMatchId') ?? undefined, homeTeamName: p.get('homeTeamName') ?? undefined, awayTeamName: p.get('awayTeamName') ?? undefined, dryRun: p.get('dryRun') !== 'false', debug: p.get('debug') === 'true' }); }
  catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro no importador browser Match Centre.' }, { status: 500 }); }
}
export async function POST(request: NextRequest) { try { return await run(request, await request.json().catch(() => ({}))); } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro no importador browser Match Centre.' }, { status: 500 }); } }
