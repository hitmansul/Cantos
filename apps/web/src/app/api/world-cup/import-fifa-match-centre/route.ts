import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';

const WORLD_CUP_2026_KEY = 'world_cup_2026';
const DEFAULT_URL = 'https://www.fifa.com/pt/match-centre/match/17/285023/289287/400021516';

type MatchRow = { id: number; home_team_id: number | null; away_team_id: number | null; home_team_name: string; away_team_name: string; fixture_key: string; fifa_match_id?: string | null };
type Stat = { metricKey: string; metricName: string; home: number | null; away: number | null; raw?: unknown; path?: string; sourceUrl?: string };
type ImportBody = { url?: string; matchCentreUrl?: string; fifaMatchId?: string | number; localMatchId?: string | number; homeTeamName?: string; awayTeamName?: string; dryRun?: boolean; debug?: boolean };

const METRICS: Record<string, string> = {
  possession: 'Posse de bola', ballpossession: 'Posse de bola', possessionpercentage: 'Posse de bola', possessionpct: 'Posse de bola',
  shots: 'Finalizações', totalshots: 'Finalizações', attempts: 'Finalizações', totalattempts: 'Finalizações', attemptsatgoal: 'Finalizações',
  shotson_target: 'Finalizações no gol', shotsontarget: 'Finalizações no gol', attemptsontarget: 'Finalizações no gol', ongoal: 'Finalizações no gol', ontarget: 'Finalizações no gol',
  corners: 'Escanteios', cornerkicks: 'Escanteios', corner: 'Escanteios',
  yellowcards: 'Cartões amarelos', yellow_cards: 'Cartões amarelos', cautions: 'Cartões amarelos', bookings: 'Cartões amarelos',
  redcards: 'Cartões vermelhos', red_cards: 'Cartões vermelhos', redcard: 'Cartões vermelhos',
  fouls: 'Faltas', foulscommitted: 'Faltas', fouls_committed: 'Faltas',
  offsides: 'Impedimentos', offside: 'Impedimentos',
  passes: 'Passes totais', totalpasses: 'Passes totais', total_passes: 'Passes totais', passesattempted: 'Passes totais',
  passaccuracy: 'Precisão de passes', pass_accuracy: 'Precisão de passes', passingaccuracy: 'Precisão de passes',
  saves: 'Defesas do goleiro', goalkeepersaves: 'Defesas do goleiro', goalkeeper_saves: 'Defesas do goleiro',
  expectedgoals: 'Gols esperados (xG)', expected_goals: 'Gols esperados (xG)', xg: 'Gols esperados (xG)',
  crosses: 'Cruzamentos', tackles: 'Desarmes', interceptions: 'Interceptações', recoveries: 'Recuperações', clearances: 'Cortes defensivos', blocks: 'Bloqueios', duels: 'Duelos'
};
const METRIC_KEYS = Object.keys(METRICS);

function normalize(value: unknown) { return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function compact(value: unknown) { return normalize(value).replace(/\s+/g, ''); }
function num(value: unknown): number | null { if (typeof value === 'number' && Number.isFinite(value)) return value; if (typeof value === 'string') { const n = Number(value.replace('%', '').replace(',', '.').trim()); return Number.isFinite(n) ? n : null; } if (value && typeof value === 'object' && !Array.isArray(value)) { const obj = value as Record<string, unknown>; for (const k of ['value','Value','statValue','numericValue','total','count','home','away']) { const n = num(obj[k]); if (n !== null) return n; } } return null; }
function metricKey(value: unknown) { const c = compact(value); if (!c) return null; if (METRICS[c]) return c; for (const k of METRIC_KEYS) if (c.includes(k) || k.includes(c)) return k; return null; }
function metricName(key: string) { return METRICS[key] ?? key.replace(/_/g, ' '); }
function sameTeam(a: unknown, b: unknown) { const ax = normalize(a); const bx = normalize(b); return Boolean(ax && bx && (ax === bx || ax.includes(bx) || bx.includes(ax))); }
function idsFromUrl(url: string) { const m = url.match(/\/match-centre\/match\/(\d+)\/(\d+)\/(\d+)\/(\d+)/i); return m ? { competitionId: m[1], seasonId: m[2], stageId: m[3], matchId: m[4] } : null; }
function urlFromMatchId(matchId: string | number) { return `https://www.fifa.com/pt/match-centre/match/17/285023/289287/${matchId}`; }
function preview(value: unknown, max = 200) { return String(typeof value === 'string' ? value : JSON.stringify(value) ?? '').slice(0, max); }

function extractJsonBlocks(html: string) {
  const blocks: unknown[] = [];
  const next = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (next?.[1]) { try { blocks.push(JSON.parse(next[1])); } catch {} }
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { blocks.push(JSON.parse(m[1])); } catch {} }
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,["']([\s\S]*?)["']\]\)/g)) { try { blocks.push(JSON.parse(m[1].replace(/\\"/g, '"'))); } catch {} }
  return blocks;
}
function endpoints(url: string, html: string) {
  const ids = idsFromUrl(url); const out: string[] = [];
  if (ids) out.push(
    `https://api.fifa.com/api/v3/live/football/${ids.matchId}`,
    `https://api.fifa.com/api/v3/live/football/${ids.matchId}/statistics`,
    `https://api.fifa.com/api/v3/live/football/${ids.matchId}/stats`,
    `https://api.fifa.com/api/v3/calendar/matches/${ids.matchId}`,
    `https://api.fifa.com/api/v3/calendar/matches?competition=${ids.competitionId}&season=${ids.seasonId}&stage=${ids.stageId}&match=${ids.matchId}`,
    `https://api.fifa.com/api/v3/calendar/matches?competitionId=${ids.competitionId}&seasonId=${ids.seasonId}&stageId=${ids.stageId}&matchId=${ids.matchId}`
  );
  for (const m of html.matchAll(/https?:\\?\/\\?\/[^\s"'<>]+/gi)) { const raw = m[0].replace(/\\\//g, '/').replace(/[),.;]+$/g, ''); if (/api|match|stats|statistics|football|fifa/i.test(raw)) out.push(raw); }
  return Array.from(new Set(out)).slice(0, 50);
}
async function fetchJson(url: string) { try { const r = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json,text/plain,*/*', 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8', referer: 'https://www.fifa.com/' } }); const text = await r.text(); let json: unknown = null; try { if (/json/i.test(r.headers.get('content-type') ?? '') || /^[\[{]/.test(text.trim())) json = JSON.parse(text); } catch {} return { url, ok: r.ok, status: r.status, length: text.length, json }; } catch (e) { return { url, ok: false, status: 0, length: 0, json: null, error: e instanceof Error ? e.message : 'erro' }; } }

function statFromObject(obj: Record<string, unknown>, path: string, sourceUrl?: string): Stat | null {
  const label = obj.name ?? obj.label ?? obj.title ?? obj.statName ?? obj.metricName ?? obj.metric ?? obj.key ?? obj.type ?? path.split('.').pop();
  const key = metricKey(label) ?? metricKey(path);
  if (!key) return null;
  const home = num(obj.home) ?? num(obj.homeValue) ?? num(obj.homeTeamValue) ?? num(obj.team1Value) ?? num(obj.valueHome) ?? num(obj.HomeTeam) ?? num(obj.homeTeam);
  const away = num(obj.away) ?? num(obj.awayValue) ?? num(obj.awayTeamValue) ?? num(obj.team2Value) ?? num(obj.valueAway) ?? num(obj.AwayTeam) ?? num(obj.awayTeam);
  if (home !== null && away !== null) return { metricKey: key, metricName: metricName(key), home, away, raw: obj, path, sourceUrl };
  for (const arrKey of ['values','items','teams','statistics','stats','data','children']) {
    const arr = obj[arrKey]; if (!Array.isArray(arr) || arr.length < 2) continue;
    const a = num(arr[0]); const b = num(arr[1]); if (a !== null && b !== null) return { metricKey: key, metricName: metricName(key), home: a, away: b, raw: obj, path, sourceUrl };
  }
  return null;
}
function collect(value: unknown, path = '$', out: Stat[] = [], sourceUrl?: string) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) { value.forEach((item, i) => collect(item, `${path}[${i}]`, out, sourceUrl)); return out; }
  const obj = value as Record<string, unknown>;
  const direct = statFromObject(obj, path, sourceUrl); if (direct) out.push(direct);
  const home = obj.HomeTeam ?? obj.homeTeam ?? obj.home; const away = obj.AwayTeam ?? obj.awayTeam ?? obj.away;
  if (home && away && typeof home === 'object' && typeof away === 'object' && !Array.isArray(home) && !Array.isArray(away)) {
    const h = home as Record<string, unknown>; const a = away as Record<string, unknown>;
    for (const k of Object.keys(h)) { const key = metricKey(k); const hv = num(h[k]); const av = num(a[k]); if (key && hv !== null && av !== null) out.push({ metricKey: key, metricName: metricName(key), home: hv, away: av, raw: { home: h[k], away: a[k] }, path: `${path}.teams.${k}`, sourceUrl }); }
  }
  for (const [k, v] of Object.entries(obj)) { const key = metricKey(k); if (key && v && typeof v === 'object' && !Array.isArray(v)) { const child = statFromObject({ ...(v as Record<string, unknown>), key: k }, `${path}.${k}`, sourceUrl); if (child) out.push(child); } collect(v, `${path}.${k}`, out, sourceUrl); }
  return out;
}
function extractTextStats(text: string): Stat[] {
  const clean = text.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&quot;|&#34;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const stats: Stat[] = [];
  for (const key of METRIC_KEYS) {
    const label = key.replace(/_/g, ' '); const re = new RegExp(`${label}[^0-9-]{0,120}(-?\\d+(?:[,.]\\d+)?%?)[^0-9-]{1,120}(-?\\d+(?:[,.]\\d+)?%?)`, 'i'); const m = clean.match(re); const h = num(m?.[1]); const a = num(m?.[2]); if (h !== null && a !== null) stats.push({ metricKey: key, metricName: metricName(key), home: h, away: a, path: 'html-text', sourceUrl: 'html' });
  }
  return stats;
}
function dedupe(stats: Stat[]) { const by = new Map<string, Stat>(); for (const s of stats) { if (s.home === null || s.away === null) continue; if (!by.has(s.metricKey)) by.set(s.metricKey, s); else if ((s.sourceUrl?.includes('/live/football/') && !by.get(s.metricKey)?.sourceUrl?.includes('/live/football/')) || String(s.path).length < String(by.get(s.metricKey)?.path).length) by.set(s.metricKey, s); } return Array.from(by.values()); }

async function findMatch(body: ImportBody, url: string, homeName?: string, awayName?: string): Promise<MatchRow | null> {
  if (body.localMatchId) { const rows = await sql`SELECT id, home_team_id, away_team_id, home_team_name, away_team_name, fixture_key, fifa_match_id FROM world_cup_matches WHERE id = ${Number(body.localMatchId)} LIMIT 1`; if (rows[0]) return rows[0] as MatchRow; }
  const officialId = String(body.fifaMatchId ?? idsFromUrl(url)?.matchId ?? '');
  if (officialId) { const rows = await sql`SELECT id, home_team_id, away_team_id, home_team_name, away_team_name, fixture_key, fifa_match_id FROM world_cup_matches WHERE competition_key = ${WORLD_CUP_2026_KEY} AND fifa_match_id = ${officialId} LIMIT 1`; if (rows[0]) return rows[0] as MatchRow; }
  if (homeName && awayName) { const rows = await sql`SELECT id, home_team_id, away_team_id, home_team_name, away_team_name, fixture_key, fifa_match_id FROM world_cup_matches WHERE competition_key = ${WORLD_CUP_2026_KEY} ORDER BY kickoff_at DESC NULLS LAST, id DESC LIMIT 400`; return (rows as MatchRow[]).find((r) => (sameTeam(r.home_team_name, homeName) && sameTeam(r.away_team_name, awayName)) || (sameTeam(r.home_team_name, awayName) && sameTeam(r.away_team_name, homeName))) ?? null; }
  return null;
}
async function save(match: MatchRow, stat: Stat, url: string, officialId: string, reversed: boolean) {
  const entries = [
    { teamId: reversed ? match.away_team_id : match.home_team_id, value: reversed ? stat.away : stat.home, side: 'home' },
    { teamId: reversed ? match.home_team_id : match.away_team_id, value: reversed ? stat.home : stat.away, side: 'away' },
  ] as const;
  let saved = 0;
  for (const e of entries) {
    if (!e.teamId || e.value === null || !Number.isFinite(Number(e.value))) continue;
    await sql`DELETE FROM world_cup_match_statistics WHERE match_id = ${match.id} AND team_id = ${e.teamId} AND period = 'match' AND metric_key = ${stat.metricKey} AND source_key = 'fifa'`;
    await sql`INSERT INTO world_cup_match_statistics (match_id, team_id, period, metric_key, metric_name, value_numeric, source_key, source_payload, source_updated_at) VALUES (${match.id}, ${e.teamId}, 'match', ${stat.metricKey}, ${stat.metricName}, ${Number(e.value)}, 'fifa', ${JSON.stringify({ importedBy: 'fifa-match-centre-official-id', matchCentreUrl: url, fifaMatchId: officialId, internalEndpoint: stat.sourceUrl, path: stat.path, raw: stat.raw, side: e.side })}::jsonb, NOW())`;
    saved += 1;
  }
  return saved;
}

async function runImport(body: ImportBody) {
  const url = body.matchCentreUrl ?? body.url ?? (body.fifaMatchId ? urlFromMatchId(body.fifaMatchId) : DEFAULT_URL);
  if (!/^https:\/\/www\.fifa\.com\//i.test(url)) return NextResponse.json({ success: false, error: 'Informe a URL oficial do Match Centre da FIFA.' }, { status: 400 });
  const officialId = String(body.fifaMatchId ?? idsFromUrl(url)?.matchId ?? '');
  const response = await fetch(url, { cache: 'no-store', headers: { 'user-agent': 'Mozilla/5.0 CantosEstatisticas/1.0', 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8' } });
  if (!response.ok) return NextResponse.json({ success: false, error: `Falha ao acessar FIFA Match Centre: HTTP ${response.status}` }, { status: 502 });
  const html = await response.text();
  const endpointResults = [] as Awaited<ReturnType<typeof fetchJson>>[];
  for (const endpoint of endpoints(url, html)) endpointResults.push(await fetchJson(endpoint));
  const blocks = [...extractJsonBlocks(html), ...endpointResults.filter((r) => r.json !== null).map((r) => r.json)];
  const rawStats = [...blocks.flatMap((block, i) => collect(block, `$json[${i}]`, [], endpointResults[i]?.url ?? url)), ...extractTextStats(html)];
  const extractedStats = dedupe(rawStats);
  const match = await findMatch(body, url, body.homeTeamName, body.awayTeamName);
  if (!match) return NextResponse.json({ success: false, error: 'Partida não encontrada no banco.', detected: { fifaMatchId: officialId, homeTeamName: body.homeTeamName, awayTeamName: body.awayTeamName }, extractedStats, debug: body.debug ? { endpointResults, samples: blocks.slice(0, 3).map((b) => preview(b, 1200)) } : undefined }, { status: 404 });
  const reversed = Boolean(body.homeTeamName && body.awayTeamName && sameTeam(match.home_team_name, body.awayTeamName) && sameTeam(match.away_team_name, body.homeTeamName));
  let savedValues = 0;
  if (!body.dryRun) {
    if (officialId) await sql`UPDATE world_cup_matches SET fifa_match_id = ${officialId}, source_payload = COALESCE(source_payload, '{}'::jsonb) || ${JSON.stringify({ fifaMatchId: officialId, matchCentreUrl: url })}::jsonb, source_updated_at = NOW(), updated_at = NOW() WHERE id = ${match.id}`;
    for (const stat of extractedStats) savedValues += await save(match, stat, url, officialId, reversed);
  }
  return NextResponse.json({ success: true, dryRun: Boolean(body.dryRun), match, detected: { fifaMatchId: officialId, matchCentreUrl: url, matchedBy: body.localMatchId ? 'localMatchId' : officialId ? 'fifaMatchId' : 'teams' }, parser: { htmlLength: html.length, endpointCount: endpointResults.length, endpointJsonCount: endpointResults.filter((r) => r.json !== null).length, strategy: 'fifa-match-centre-official-id-deep-scanner' }, extractedStats, savedValues, warning: extractedStats.length === 0 ? 'Match Centre acessado, mas nenhum par de estatística foi identificado nos JSONs disponíveis.' : null, debug: body.debug ? { endpointResults: endpointResults.map(({ json, ...rest }) => rest), samples: blocks.slice(0, 6).map((b) => preview(b, 1200)) } : undefined, source: url, lastUpdated: new Date().toISOString() });
}

export async function GET(request: NextRequest) {
  try { const p = request.nextUrl.searchParams; return await runImport({ url: p.get('url') ?? undefined, matchCentreUrl: p.get('matchCentreUrl') ?? undefined, fifaMatchId: p.get('fifaMatchId') ?? undefined, localMatchId: p.get('localMatchId') ?? undefined, homeTeamName: p.get('homeTeamName') ?? undefined, awayTeamName: p.get('awayTeamName') ?? undefined, dryRun: p.get('dryRun') !== 'false', debug: p.get('debug') === 'true' }); }
  catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro ao importar FIFA Match Centre.' }, { status: 500 }); }
}
export async function POST(request: NextRequest) { try { return await runImport((await request.json()) as ImportBody); } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro ao importar FIFA Match Centre.' }, { status: 500 }); } }
