import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';

const WORLD_CUP_2026_KEY = 'world_cup_2026';
const DEFAULT_MATCH_CENTRE_URL = 'https://www.fifa.com/pt/match-centre/match/17/285023/289273/400021459';

type Side = 'home' | 'away';
type MatchRow = { id: number; home_team_id: number | null; away_team_id: number | null; home_team_name: string; away_team_name: string; fixture_key: string };
type StatCandidate = { metricKey: string; metricName: string; home: number | null; away: number | null; raw?: unknown; path?: string; sourceUrl?: string };
type SingleStatCandidate = { metricKey: string; metricName: string; value: number | null; side: Side | null; teamName?: string | null; raw?: unknown; path?: string; sourceUrl?: string };
type ImportBody = { url?: string; homeTeamName?: string; awayTeamName?: string; dryRun?: boolean; debug?: boolean };
type EndpointResult = { url: string; ok: boolean; status: number; contentType: string; length: number; json: unknown | null; error?: string };
type ScanHit = { path: string; key: string; valuePreview: string; sourceUrl?: string };

const TEAM_ALIASES: Record<string, string[]> = {
  turkiye: ['turkey', 'turkiye', 'turquia', 'türkiye', 'tur'],
  usa: ['usa', 'united states', 'eua', 'estados unidos', 'us', 'united states of america'],
  portugal: ['portugal', 'por'],
  uzbekistan: ['uzbekistan', 'uzbequistao', 'uzbequistão', 'uzb'],
};

const METRIC_ALIASES: Record<string, string> = {
  possession: 'Posse de bola', ballpossession: 'Posse de bola', ball_possession: 'Posse de bola', possessionpercentage: 'Posse de bola', possessionpercent: 'Posse de bola', possessionpct: 'Posse de bola',
  shots: 'Finalizações', totalshots: 'Finalizações', total_shots: 'Finalizações', attempts: 'Finalizações', totalattempts: 'Finalizações', attemptsongoal: 'Finalizações no gol',
  shotson_target: 'Finalizações no gol', shotsontarget: 'Finalizações no gol', attemptsontarget: 'Finalizações no gol', on_target: 'Finalizações no gol', ongoal: 'Finalizações no gol',
  corners: 'Escanteios', cornerkicks: 'Escanteios', corner_kicks: 'Escanteios', cornerswon: 'Escanteios',
  yellowcards: 'Cartões amarelos', yellow_cards: 'Cartões amarelos', cautions: 'Cartões amarelos', yellowcard: 'Cartões amarelos', bookings: 'Cartões amarelos',
  redcards: 'Cartões vermelhos', red_cards: 'Cartões vermelhos', redcard: 'Cartões vermelhos',
  fouls: 'Faltas', foulscommitted: 'Faltas', fouls_committed: 'Faltas', foulcommitted: 'Faltas',
  offsides: 'Impedimentos', offside: 'Impedimentos',
  passes: 'Passes totais', totalpasses: 'Passes totais', total_passes: 'Passes totais', passesattempted: 'Passes totais',
  passaccuracy: 'Precisão de passes', pass_accuracy: 'Precisão de passes', passingaccuracy: 'Precisão de passes', passcompletion: 'Precisão de passes',
  saves: 'Defesas do goleiro', goalkeepersaves: 'Defesas do goleiro', goalkeeper_saves: 'Defesas do goleiro', savesmade: 'Defesas do goleiro',
  expectedgoals: 'Gols esperados (xG)', expected_goals: 'Gols esperados (xG)', xg: 'Gols esperados (xG)',
  crosses: 'Cruzamentos', tackles: 'Desarmes', interceptions: 'Interceptações', recoveries: 'Recuperações', clearances: 'Cortes defensivos',
  blocks: 'Bloqueios', blockedshots: 'Chutes bloqueados', duels: 'Duelos', aerialduels: 'Duelos aéreos', successfulpasses: 'Passes certos',
  passescompleted: 'Passes certos', passingcompletion: 'Precisão de passes', possessioncontest: 'Disputa de posse',
};

const METRIC_WORDS = Object.keys(METRIC_ALIASES);
const VALUE_KEYS = ['value', 'Value', 'statValue', 'numericValue', 'total', 'count', 'home', 'away', 'homeValue', 'awayValue', 'homeTeamValue', 'awayTeamValue', 'team1Value', 'team2Value', 'teamAValue', 'teamBValue', 'valueHome', 'valueAway'];

function normalize(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function compact(value: unknown) { return normalize(value).replace(/\s+/g, ''); }
function preview(value: unknown, max = 160) { const text = typeof value === 'string' ? value : JSON.stringify(value); return String(text ?? '').slice(0, max); }
function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace('%', '').replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of VALUE_KEYS) {
      if (key in obj) {
        const parsed = numberValue(obj[key]);
        if (parsed !== null) return parsed;
      }
    }
  }
  return null;
}
function metricKeyFromName(name: unknown) {
  const c = compact(name);
  if (!c || c.length < 2) return null;
  if (METRIC_ALIASES[c]) return c;
  for (const key of METRIC_WORDS) if (c.includes(key) || key.includes(c)) return key;
  if (c.length <= 42 && /[a-z]/.test(c) && !/^\d+$/.test(c) && /(shot|corner|possession|pass|foul|card|offside|save|goal|tackle|duel|block|clearance|cross|interception|recovery)/i.test(c)) return c;
  return null;
}
function metricName(key: string, fallback?: unknown) { return METRIC_ALIASES[key] ?? String(fallback ?? key).replace(/_/g, ' '); }
function teamKey(name: unknown) {
  const n = normalize(name);
  for (const [canonical, aliases] of Object.entries(TEAM_ALIASES)) if (aliases.some((a) => n === normalize(a) || n.includes(normalize(a)))) return canonical;
  return n;
}
function sameTeam(a: unknown, b: unknown) { const ak = teamKey(a); const bk = teamKey(b); return Boolean(ak && bk && (ak === bk || ak.includes(bk) || bk.includes(ak))); }
function sideFromKey(key: string): Side | null {
  const k = compact(key);
  if (/(^|[.\[])(home|hometeam|team1|teamone|teama|local)([.\]]|$)/i.test(key) || ['home', 'hometeam', 'team1', 'teamone', 'teama', 'local'].includes(k)) return 'home';
  if (/(^|[.\[])(away|awayteam|team2|teamtwo|teamb|visitor|visiting)([.\]]|$)/i.test(key) || ['away', 'awayteam', 'team2', 'teamtwo', 'teamb', 'visitor', 'visiting'].includes(k)) return 'away';
  return null;
}
function sideFromObject(obj: Record<string, unknown>, path: string, homeTeamName?: string, awayTeamName?: string): Side | null {
  const explicit = obj.side ?? obj.teamSide ?? obj.homeAway ?? obj.location ?? obj.teamType ?? obj.type;
  const exp = compact(explicit);
  if (['home', 'hometeam', 'team1', 'teama', 'local'].includes(exp)) return 'home';
  if (['away', 'awayteam', 'team2', 'teamb', 'visitor', 'visiting'].includes(exp)) return 'away';
  const name = obj.teamName ?? obj.team ?? obj.name ?? obj.countryName ?? obj.displayName ?? obj.TeamName ?? obj.shortName;
  if (homeTeamName && sameTeam(name, homeTeamName)) return 'home';
  if (awayTeamName && sameTeam(name, awayTeamName)) return 'away';
  return sideFromKey(path);
}

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
  return blocks;
}

function candidateLabel(obj: Record<string, unknown>, path: string) {
  return obj.name ?? obj.label ?? obj.title ?? obj.statName ?? obj.type ?? obj.key ?? obj.code ?? obj.metricName ?? obj.metric ?? obj.displayName ?? obj.shortName ?? path.split('.').pop();
}

function statFromObject(obj: Record<string, unknown>, path: string, sourceUrl?: string): StatCandidate | null {
  const label = candidateLabel(obj, path);
  const metricKey = metricKeyFromName(label) ?? metricKeyFromName(path);
  if (!metricKey) return null;
  const home = numberValue(obj.home) ?? numberValue(obj.homeValue) ?? numberValue(obj.homeTeamValue) ?? numberValue(obj.team1Value) ?? numberValue(obj.teamAValue) ?? numberValue(obj.valueHome) ?? numberValue(obj.homeTeam?.value) ?? numberValue(obj.homeTeam);
  const away = numberValue(obj.away) ?? numberValue(obj.awayValue) ?? numberValue(obj.awayTeamValue) ?? numberValue(obj.team2Value) ?? numberValue(obj.teamBValue) ?? numberValue(obj.valueAway) ?? numberValue(obj.awayTeam?.value) ?? numberValue(obj.awayTeam);
  if (home !== null && away !== null) return { metricKey, metricName: metricName(metricKey, label), home, away, raw: obj, path, sourceUrl };

  for (const key of ['values', 'items', 'teams', 'teamValues', 'statistics', 'stats', 'data']) {
    const arr = obj[key];
    if (!Array.isArray(arr) || arr.length < 2) continue;
    const first = arr[0];
    const second = arr[1];
    const firstSide = first && typeof first === 'object' ? sideFromObject(first as Record<string, unknown>, `${path}.${key}[0]`) : null;
    const secondSide = second && typeof second === 'object' ? sideFromObject(second as Record<string, unknown>, `${path}.${key}[1]`) : null;
    const firstValue = numberValue(first);
    const secondValue = numberValue(second);
    if (firstValue === null || secondValue === null) continue;
    if (firstSide === 'away' || secondSide === 'home') return { metricKey, metricName: metricName(metricKey, label), home: secondValue, away: firstValue, raw: obj, path, sourceUrl };
    return { metricKey, metricName: metricName(metricKey, label), home: firstValue, away: secondValue, raw: obj, path, sourceUrl };
  }
  return null;
}

function singleStatFromObject(obj: Record<string, unknown>, path: string, sourceUrl?: string, inheritedSide: Side | null = null, homeTeamName?: string, awayTeamName?: string): SingleStatCandidate | null {
  const label = candidateLabel(obj, path);
  const metricKey = metricKeyFromName(label) ?? metricKeyFromName(path);
  if (!metricKey) return null;
  const value = numberValue(obj.value) ?? numberValue(obj.statValue) ?? numberValue(obj.numericValue) ?? numberValue(obj.total) ?? numberValue(obj.count);
  if (value === null) return null;
  const side = sideFromObject(obj, path, homeTeamName, awayTeamName) ?? inheritedSide;
  const teamName = String(obj.teamName ?? obj.team ?? obj.countryName ?? obj.displayName ?? obj.TeamName ?? '') || null;
  return { metricKey, metricName: metricName(metricKey, label), value, side, teamName, raw: obj, path, sourceUrl };
}

function collectKeyValueStats(obj: Record<string, unknown>, path: string, sourceUrl?: string): StatCandidate[] {
  const found: StatCandidate[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const metricKey = metricKeyFromName(key);
    if (!metricKey) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const child = value as Record<string, unknown>;
      const stat = statFromObject({ ...child, key }, `${path}.${key}`, sourceUrl);
      if (stat) found.push(stat);
    }
  }
  return found;
}

function collectStats(value: unknown, path = '$', out: StatCandidate[] = [], sourceUrl?: string, inheritedSide: Side | null = null, singles: SingleStatCandidate[] = [], homeTeamName?: string, awayTeamName?: string, hits: ScanHit[] = []) {
  if (!value || typeof value !== 'object') return { pairs: out, singles, hits };
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStats(item, `${path}[${index}]`, out, sourceUrl, inheritedSide, singles, homeTeamName, awayTeamName, hits));
    return { pairs: out, singles, hits };
  }
  const obj = value as Record<string, unknown>;
  const objectText = normalize(`${candidateLabel(obj, path)} ${path}`);
  if (/(stat|statistics|corner|possession|shot|foul|card|offside|pass|xg|goal|save)/.test(objectText) && hits.length < 80) {
    hits.push({ path, key: String(candidateLabel(obj, path)), valuePreview: preview(obj), sourceUrl });
  }

  const direct = statFromObject(obj, path, sourceUrl);
  if (direct) out.push(direct);
  collectKeyValueStats(obj, path, sourceUrl).forEach((stat) => out.push(stat));
  const single = singleStatFromObject(obj, path, sourceUrl, inheritedSide, homeTeamName, awayTeamName);
  if (single) singles.push(single);

  for (const [key, child] of Object.entries(obj)) {
    if (['raw', 'payload'].includes(key)) continue;
    const keyMetric = metricKeyFromName(key);
    const childSide = sideFromKey(key) ?? inheritedSide;
    if (keyMetric) {
      const childValue = numberValue(child);
      if (childValue !== null && childSide) singles.push({ metricKey: keyMetric, metricName: metricName(keyMetric, key), value: childValue, side: childSide, raw: { [key]: child }, path: `${path}.${key}`, sourceUrl });
    }
    collectStats(child, `${path}.${key}`, out, sourceUrl, childSide, singles, homeTeamName, awayTeamName, hits);
  }
  return { pairs: out, singles, hits };
}

function pairSingles(singles: SingleStatCandidate[]) {
  const grouped = new Map<string, { home?: SingleStatCandidate; away?: SingleStatCandidate }>();
  for (const single of singles) {
    if (single.value === null || !single.side) continue;
    const group = grouped.get(single.metricKey) ?? {};
    if (single.side === 'home' && group.home === undefined) group.home = single;
    if (single.side === 'away' && group.away === undefined) group.away = single;
    grouped.set(single.metricKey, group);
  }
  const pairs: StatCandidate[] = [];
  for (const [metricKey, group] of grouped.entries()) {
    if (!group.home || !group.away) continue;
    pairs.push({ metricKey, metricName: group.home.metricName, home: group.home.value, away: group.away.value, raw: { home: group.home.raw, away: group.away.raw }, path: `${group.home.path} + ${group.away.path}`, sourceUrl: group.home.sourceUrl ?? group.away.sourceUrl });
  }
  return pairs;
}

function dedupeStats(stats: StatCandidate[]) {
  const byKey = new Map<string, StatCandidate>();
  for (const stat of stats) {
    if (stat.home === null || stat.away === null) continue;
    const current = byKey.get(stat.metricKey);
    if (!current) byKey.set(stat.metricKey, stat);
    else if ((stat.sourceUrl?.includes('/live/football/') && !current.sourceUrl?.includes('/live/football/')) || String(stat.path).length < String(current.path).length) byKey.set(stat.metricKey, stat);
  }
  return Array.from(byKey.values());
}

function matchCentreIds(url: string) {
  const ids = url.match(/\/match-centre\/match\/(\d+)\/(\d+)\/(\d+)\/(\d+)/i);
  return ids ? { competitionId: ids[1], seasonId: ids[2], stageId: ids[3], matchId: ids[4] } : null;
}
function unique(values: string[]) { return Array.from(new Set(values.filter(Boolean))); }

function endpointCandidates(url: string, html: string) {
  const ids = matchCentreIds(url);
  const candidates: string[] = [];
  for (const match of html.matchAll(/https?:\\?\/\\?\/[^\s"'<>]+/gi)) {
    const raw = match[0].replace(/\\\//g, '/').replace(/[),.;]+$/g, '');
    if (/fifa|digitalhub|football|match|statistics|api/i.test(raw)) candidates.push(raw);
  }
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
    try {
      const absolute = new URL(match[1], url).toString();
      if (/fifa|_next|api|match|statistics/i.test(absolute)) candidates.push(absolute);
    } catch {}
  }
  if (ids) {
    const { competitionId, seasonId, stageId, matchId } = ids;
    candidates.push(
      `https://api.fifa.com/api/v3/live/football/${matchId}`,
      `https://api.fifa.com/api/v3/live/football/${matchId}/statistics`,
      `https://api.fifa.com/api/v3/live/football/${matchId}/stats`,
      `https://api.fifa.com/api/v3/match/${matchId}`,
      `https://api.fifa.com/api/v3/matches/${matchId}`,
      `https://api.fifa.com/api/v3/calendar/matches/${matchId}`,
      `https://api.fifa.com/api/v3/calendar/matches?competition=${competitionId}&season=${seasonId}&stage=${stageId}&match=${matchId}`,
      `https://api.fifa.com/api/v3/calendar/matches?competitionId=${competitionId}&seasonId=${seasonId}&stageId=${stageId}&matchId=${matchId}`,
    );
  }
  return unique(candidates).slice(0, 40);
}

async function fetchEndpoint(url: string): Promise<EndpointResult> {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        accept: 'application/json,text/plain,*/*',
        'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
        origin: 'https://www.fifa.com',
        referer: 'https://www.fifa.com/',
        'user-agent': 'Mozilla/5.0 CantosEstatisticas/1.0',
      },
    });
    const contentType = response.headers.get('content-type') ?? '';
    const text = await response.text();
    let json: unknown | null = null;
    if (/json/i.test(contentType) || /^[\[{]/.test(text.trim())) {
      try { json = JSON.parse(text); } catch {}
    }
    return { url, ok: response.ok, status: response.status, contentType, length: text.length, json };
  } catch (error) {
    return { url, ok: false, status: 0, contentType: '', length: 0, json: null, error: error instanceof Error ? error.message : 'Erro ao acessar endpoint.' };
  }
}

async function discoverInternalPayloads(url: string, html: string) {
  const candidates = endpointCandidates(url, html).filter((candidate) => /api|match|stats|statistics|football/i.test(candidate)).slice(0, 25);
  const results: EndpointResult[] = [];
  for (const candidate of candidates) results.push(await fetchEndpoint(candidate));
  const jsonPayloads = results.filter((result) => result.json !== null).map((result) => ({ url: result.url, json: result.json }));
  return { candidates, results, jsonPayloads };
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
      VALUES (${match.id}, ${side.teamId}, 'match', ${stat.metricKey}, ${stat.metricName}, ${side.value}, 'fifa', ${JSON.stringify({ importedBy: 'fifa-match-centre-deep-json-scanner', matchCentreUrl: url, internalEndpoint: stat.sourceUrl, side: side.side, raw: stat.raw, path: stat.path })}::jsonb, NOW())
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
  const discovery = await discoverInternalPayloads(url, html);
  const htmlCollected = jsonBlocks.map((block, index) => collectStats(block, `$htmlJson[${index}]`, [], url, null, [], homeTeamName, awayTeamName, []));
  const endpointCollected = discovery.jsonPayloads.map((payload, index) => collectStats(payload.json, `$endpointJson[${index}]`, [], payload.url, null, [], homeTeamName, awayTeamName, []));
  const htmlStats = htmlCollected.flatMap((result) => [...result.pairs, ...pairSingles(result.singles)]);
  const endpointStats = endpointCollected.flatMap((result) => [...result.pairs, ...pairSingles(result.singles)]);
  const scanHits = [...endpointCollected.flatMap((result) => result.hits), ...htmlCollected.flatMap((result) => result.hits)].slice(0, 120);
  const extractedStats = dedupeStats([...endpointStats, ...htmlStats]);
  const match = await findMatch(homeTeamName, awayTeamName);
  if (!match) return NextResponse.json({ success: false, error: 'Partida não encontrada no banco.', detected: { homeTeamName, awayTeamName }, extractedStats }, { status: 404 });
  const reversed = sameTeam(match.home_team_name, awayTeamName) && sameTeam(match.away_team_name, homeTeamName);
  let savedValues = 0;
  if (!body.dryRun) for (const stat of extractedStats) savedValues += await savePair(match, stat, url, reversed);
  return NextResponse.json({
    success: true,
    dryRun: Boolean(body.dryRun),
    match,
    parser: {
      htmlLength: html.length,
      htmlJsonBlocks: jsonBlocks.length,
      internalCandidates: discovery.candidates.length,
      internalJsonPayloads: discovery.jsonPayloads.length,
      scanHits: scanHits.length,
      strategy: 'fifa-match-centre-deep-json-scanner-v2',
    },
    extractedStats,
    savedValues,
    warning: extractedStats.length === 0 ? 'A página e os endpoints JSON foram acessados, mas ainda não encontrei pares de estatísticas. Abra com debug=true e envie debug.scanHits.' : null,
    debug: body.debug ? { endpointResults: discovery.results.map(({ json, ...rest }) => rest), scanHits } : undefined,
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
      debug: params.get('debug') === 'true',
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
