import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const WORLD_CUP_2026_KEY = 'world_cup_2026';
const COMPETITION_ID = '17';
const SEASON_ID = '285023';
const STAGE_ID = '289287';
const DEFAULT_MATCH_ID = '400065454';
const DEFAULT_URL = `https://www.fifa.com/pt/match-centre/match/${COMPETITION_ID}/${SEASON_ID}/${STAGE_ID}/${DEFAULT_MATCH_ID}`;
const CXM_BASE = 'https://cxm-api.fifa.com/fifaplusweb/api';

type MatchRow = {
  id: number;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team_name: string;
  away_team_name: string;
  fixture_key: string;
  fifa_match_id?: string | null;
};
type Stat = { metricKey: string; metricName: string; home: number | null; away: number | null; raw?: unknown; path?: string; sourceUrl?: string };
type Body = {
  url?: string;
  matchCentreUrl?: string;
  fifaMatchId?: string | number;
  localMatchId?: string | number;
  homeTeamName?: string;
  awayTeamName?: string;
  dryRun?: boolean;
  debug?: boolean;
  fast?: boolean;
  maxStats?: string | number;
};
type Capture = { pageText: string; snapshots: Array<{ label: string; text: string }>; networkJson: Array<{ url: string; json: unknown }>; networkCount: number; likelyNetworkCount: number };
type DirectCapture = { jsonItems: Array<{ url: string; json: unknown }>; visited: string[]; failed: Array<{ url: string; status?: number; error?: string }>; discovered: string[] };

const METRICS: Record<string, { name: string; aliases: string[]; max: number }> = {
  possession: { name: 'Posse de bola', aliases: ['posse de bola', 'possession', 'ball possession'], max: 100 },
  goals: { name: 'Gols', aliases: ['gols', 'gol', 'goals'], max: 30 },
  goals_conceded: { name: 'Gols sofridos', aliases: ['gols sofridos', 'sofridos', 'goals conceded'], max: 30 },
  assists: { name: 'Assistências', aliases: ['assistências', 'assistencias', 'assists'], max: 30 },
  shots: { name: 'Finalizações', aliases: ['finalizações', 'finalizacoes', 'chutes', 'shots', 'total attempts', 'attempts'], max: 80 },
  shotsontarget: { name: 'Finalizações no gol', aliases: ['finalizações no gol', 'finalizacoes no gol', 'chutes no gol', 'shots on target', 'attempts on target', 'on target'], max: 60 },
  shots_off_target: { name: 'Finalizações para fora', aliases: ['para fora', 'shots off target', 'off target'], max: 60 },
  corners: { name: 'Escanteios', aliases: ['escanteios', 'cantos', 'corners', 'corner kicks'], max: 40 },
  yellowcards: { name: 'Cartões amarelos', aliases: ['cartões amarelos', 'cartoes amarelos', 'yellow cards', 'yellowcards'], max: 20 },
  redcards: { name: 'Cartões vermelhos', aliases: ['cartões vermelhos', 'cartoes vermelhos', 'red cards', 'redcards'], max: 10 },
  fouls: { name: 'Faltas', aliases: ['faltas', 'faltas recebidas', 'fouls'], max: 80 },
  offsides: { name: 'Impedimentos', aliases: ['impedimentos', 'offsides'], max: 30 },
  passes: { name: 'Passes totais', aliases: ['passes totais', 'total passes', 'passes'], max: 1500 },
  completedpasses: { name: 'Passes concluídos', aliases: ['passes concluídos', 'passes concluidos', 'completed passes'], max: 1500 },
  passaccuracy: { name: 'Precisão de passes', aliases: ['precisão de passes', 'precisao de passes', 'pass accuracy', 'passing accuracy'], max: 100 },
  crosses: { name: 'Cruzamentos', aliases: ['cruzamentos', 'crosses'], max: 120 },
  completedcrosses: { name: 'Cruzamentos concluídos', aliases: ['cruzamentos concluídos', 'cruzamentos concluidos', 'completed crosses'], max: 120 },
  freekicks: { name: 'Livres', aliases: ['livres', 'free kicks'], max: 80 },
  penaltiesconverted: { name: 'Pênaltis convertidos', aliases: ['pênaltis convertidos', 'penaltis convertidos', 'penalties converted'], max: 20 },
  saves: { name: 'Defesas do goleiro', aliases: ['defesas do goleiro', 'goalkeeper saves', 'saves'], max: 40 },
  expectedgoals: { name: 'Gols esperados (xG)', aliases: ['gols esperados', 'expected goals', 'expected goals xg', 'xg'], max: 15 },
  turnoversforced: { name: 'Erros forçados', aliases: ['erros forçados', 'erros forcados', 'forced turnovers'], max: 400 },
  defensivepressures: { name: 'Pressões defensivas exercidas', aliases: ['pressões defensivas exercidas', 'pressoes defensivas exercidas', 'defensive pressures'], max: 800 },
  tackles: { name: 'Desarmes', aliases: ['desarmes', 'tackles'], max: 120 },
  interceptions: { name: 'Interceptações', aliases: ['interceptações', 'interceptacoes', 'interceptions'], max: 120 },
  clearances: { name: 'Cortes defensivos', aliases: ['cortes defensivos', 'clearances'], max: 120 },
};
const KEYS = Object.keys(METRICS);

function normalize(value: unknown) { return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9,.%]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function compact(value: unknown) { return normalize(value).replace(/[\s,.%]/g, ''); }
function sameTeam(a: unknown, b: unknown) { const x = normalize(a).replace(/[,.%]/g, ''); const y = normalize(b).replace(/[,.%]/g, ''); return Boolean(x && y && (x === y || x.includes(y) || y.includes(x))); }
function idsFromUrl(url: string) { const m = url.match(/\/match-centre\/match\/(\d+)\/(\d+)\/(\d+)\/(\d+)/i); return m ? { competitionId: m[1], seasonId: m[2], stageId: m[3], matchId: m[4] } : null; }
function urlFromMatchId(matchId: string | number) { return `https://www.fifa.com/pt/match-centre/match/${COMPETITION_ID}/${SEASON_ID}/${STAGE_ID}/${matchId}`; }
function metricKey(value: unknown) { const c = compact(value); if (!c) return null; for (const key of KEYS) if (METRICS[key].aliases.some((a) => c.includes(compact(a)) || compact(a).includes(c))) return key; return null; }
function metricName(key: string) { return METRICS[key]?.name ?? key; }
function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') { const clean = value.replace('%', '').replace(',', '.').trim(); const n = Number(clean); return Number.isFinite(n) ? n : null; }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const key of ['value','Value','statValue','numericValue','total','count','home','away','displayValue','display','rawValue','score']) { const n = num(obj[key]); if (n !== null) return n; }
  }
  return null;
}
function valid(key: string, value: number | null) { return value !== null && value >= 0 && value <= (METRICS[key]?.max ?? 2000); }
function preview(value: unknown, max = 600) { return String(typeof value === 'string' ? value : JSON.stringify(value) ?? '').slice(0, max); }
function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }

function statFromObject(obj: Record<string, unknown>, path: string, sourceUrl?: string): Stat | null {
  const label = obj.name ?? obj.Name ?? obj.label ?? obj.title ?? obj.statName ?? obj.metricName ?? obj.metric ?? obj.key ?? obj.type ?? obj.identifier ?? obj.id ?? path.split('.').pop();
  const key = metricKey(label) ?? metricKey(path);
  if (!key) return null;
  const home = num(obj.home) ?? num(obj.homeValue) ?? num(obj.HomeValue) ?? num(obj.homeTeamValue) ?? num(obj.team1Value) ?? num(obj.valueHome) ?? num(obj.homeTeam) ?? num(obj.HomeTeam) ?? num(obj.homeCompetitor);
  const away = num(obj.away) ?? num(obj.awayValue) ?? num(obj.AwayValue) ?? num(obj.awayTeamValue) ?? num(obj.team2Value) ?? num(obj.valueAway) ?? num(obj.awayTeam) ?? num(obj.AwayTeam) ?? num(obj.awayCompetitor);
  if (valid(key, home) && valid(key, away)) return { metricKey: key, metricName: metricName(key), home, away, raw: obj, path, sourceUrl };
  for (const arrKey of ['values','items','teams','competitors','statistics','stats','data','children','participants']) {
    const arr = obj[arrKey]; if (!Array.isArray(arr) || arr.length < 2) continue;
    const a = num(arr[0]); const b = num(arr[1]);
    if (valid(key, a) && valid(key, b)) return { metricKey: key, metricName: metricName(key), home: a, away: b, raw: obj, path, sourceUrl };
    if (isObject(arr[0]) && isObject(arr[1])) {
      const av = num(arr[0].value ?? arr[0].Value ?? arr[0].displayValue ?? arr[0].statValue ?? arr[0].score);
      const bv = num(arr[1].value ?? arr[1].Value ?? arr[1].displayValue ?? arr[1].statValue ?? arr[1].score);
      if (valid(key, av) && valid(key, bv)) return { metricKey: key, metricName: metricName(key), home: av, away: bv, raw: obj, path, sourceUrl };
    }
  }
  return null;
}
function collect(value: unknown, path = '$', out: Stat[] = [], sourceUrl?: string) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) { value.forEach((item, index) => collect(item, `${path}[${index}]`, out, sourceUrl)); return out; }
  const obj = value as Record<string, unknown>; const direct = statFromObject(obj, path, sourceUrl); if (direct) out.push(direct);
  const home = obj.HomeTeam ?? obj.homeTeam ?? obj.home ?? obj.homeCompetitor; const away = obj.AwayTeam ?? obj.awayTeam ?? obj.away ?? obj.awayCompetitor;
  if (isObject(home) && isObject(away)) {
    for (const key of Object.keys(home)) { const mk = metricKey(key); const hv = num(home[key]); const av = num(away[key]); if (mk && valid(mk, hv) && valid(mk, av)) out.push({ metricKey: mk, metricName: metricName(mk), home: hv, away: av, raw: { home: home[key], away: away[key] }, path: `${path}.teams.${key}`, sourceUrl }); }
  }
  for (const [key, child] of Object.entries(obj)) { const mk = metricKey(key); if (mk && isObject(child)) { const nested = statFromObject({ ...child, key }, `${path}.${key}`, sourceUrl); if (nested) out.push(nested); } collect(child, `${path}.${key}`, out, sourceUrl); }
  return out;
}
function numbersNear(text: string, alias: string) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const patterns = [new RegExp(`(-?\\d+(?:[,.]\\d+)?%?)\\s+${escaped}\\s+(-?\\d+(?:[,.]\\d+)?%?)`, 'i'), new RegExp(`${escaped}\\s+(-?\\d+(?:[,.]\\d+)?%?)\\s+(-?\\d+(?:[,.]\\d+)?%?)`, 'i'), new RegExp(`(-?\\d+(?:[,.]\\d+)?%?)\\s+(-?\\d+(?:[,.]\\d+)?%?)\\s+${escaped}`, 'i')];
  for (const p of patterns) { const m = text.match(p); const a = num(m?.[1]); const b = num(m?.[2]); if (a !== null && b !== null) return [a, b] as const; }
  return null;
}
function valueLine(line: string) { return /^\d+(?:[,.]\d+)?%?$/.test(line.trim()); }
function readPair(lines: string[], start: number) {
  const values: number[] = [];
  for (let i = start + 1; i < Math.min(lines.length, start + 8); i += 1) {
    const n = normalize(lines[i]);
    if (n.includes('em disputa') || n.includes('dispute')) continue;
    if (valueLine(lines[i])) {
      const parsed = num(lines[i]);
      if (parsed !== null) values.push(parsed);
      if (values.length === 2) return { home: values[0], away: values[1] };
    } else if (values.length > 0 && !valueLine(lines[i])) break;
  }
  return null;
}
function keyFromOfficialLabel(label: string, section: string) {
  const n = normalize(label);
  const s = normalize(section);
  if (n === 'posse da bola') return 'possession';
  if (s === 'gol' && n === 'total') return 'goals';
  if (s === 'gol' && n === 'sofridos') return 'goals_conceded';
  if (n === 'assistencias') return 'assists';
  if (s === 'chutes' && n === 'total') return 'shots';
  if (s === 'chutes' && n === 'no gol') return 'shotsontarget';
  if (s === 'chutes' && n === 'para fora') return 'shots_off_target';
  if (n === 'cartoes amarelos') return 'yellowcards';
  if (n === 'cartoes vermelhos') return 'redcards';
  if (n === 'faltas recebidas' || n === 'faltas') return 'fouls';
  if (n === 'impedimentos') return 'offsides';
  if (n === 'passes') return 'passes';
  if (n === 'passes concluidos') return 'completedpasses';
  if (n === 'cruzamentos') return 'crosses';
  if (n === 'cruzamentos concluidos') return 'completedcrosses';
  if (n === 'cantos' || n === 'escanteios') return 'corners';
  if (n === 'livres') return 'freekicks';
  if (n === 'penaltis convertidos') return 'penaltiesconverted';
  if (n === 'erros forcados') return 'turnoversforced';
  if (n === 'pressoes defensivas exercidas') return 'defensivepressures';
  return null;
}
function extractOfficialStatsFromLines(lines: string[], label: string): Stat[] {
  const start = lines.findIndex((line) => normalize(line).includes('estatisticas oficiais'));
  if (start < 0) return [];
  const stats: Stat[] = [];
  let section = '';
  const sectionNames = new Set(['ataque','gol','chutes','penetracoes nas proximidades da area adversaria','pedidos de bola','penetracoes','disciplina','distribuicao de jogo','jogadas de bola parada','defesa']);
  for (let i = start + 1; i < lines.length; i += 1) {
    const raw = lines[i].trim();
    const n = normalize(raw);
    if (!n) continue;
    if (n.includes('confrontos diretos') || n.includes('estatisticas do jogador') || n.includes('encontros recentes')) break;
    if (sectionNames.has(n)) { section = raw; continue; }
    const key = keyFromOfficialLabel(raw, section);
    if (!key) continue;
    const pair = readPair(lines, i);
    if (!pair || !valid(key, pair.home) || !valid(key, pair.away)) continue;
    stats.push({ metricKey: key, metricName: metricName(key), home: pair.home, away: pair.away, path: `rendered-official:${label}:${section}:${raw}`, sourceUrl: 'fifa-rendered-official' });
  }
  return stats;
}
function extractRenderedTextStats(snapshots: Capture['snapshots'], pageText: string): Stat[] {
  const stats: Stat[] = [];
  const sources = [...snapshots, { label: 'final-body-text', text: pageText }];
  for (const source of sources) {
    const lines = source.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const official = extractOfficialStatsFromLines(lines, source.label);
    if (official.length > 0) { stats.push(...official); continue; }
    const text = source.text.replace(/\s+/g, ' ');
    for (const [key, def] of Object.entries(METRICS)) for (const alias of def.aliases) {
      const values = numbersNear(text, alias);
      if (values && valid(key, values[0]) && valid(key, values[1])) stats.push({ metricKey: key, metricName: def.name, home: values[0], away: values[1], path: `rendered-dom:${source.label}:${alias}`, sourceUrl: 'browser-dom' });
    }
  }
  return stats;
}
function dedupe(stats: Stat[]) {
  const rank = (s: Stat) => s.sourceUrl === 'fifa-rendered-official' ? 6 : s.sourceUrl?.includes('cxm-api.fifa.com') ? 5 : s.sourceUrl === 'browser-dom' ? 3 : s.sourceUrl?.startsWith('http') ? 2 : 1;
  const by = new Map<string, Stat>();
  for (const stat of stats) { if (!valid(stat.metricKey, stat.home) || !valid(stat.metricKey, stat.away)) continue; const current = by.get(stat.metricKey); if (!current || rank(stat) > rank(current) || String(stat.path).length < String(current.path).length) by.set(stat.metricKey, stat); }
  return Array.from(by.values());
}

function cxmEndpoint(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.replace(/^\/+/, '');
  return `${CXM_BASE}/${path}`;
}
function addEndpoint(urls: Set<string>, value: unknown) {
  if (typeof value !== 'string') return;
  const decoded = value.replace(/&amp;/g, '&');
  if (/^sections\//i.test(decoded) || /^pages\//i.test(decoded) || /\/fifaplusweb\/api\/sections\//i.test(decoded) || /\/fifaplusweb\/api\/pages\//i.test(decoded)) urls.add(cxmEndpoint(decoded));
}
function discoverEndpoints(value: unknown, urls = new Set<string>()) {
  if (!value || typeof value !== 'object') return urls;
  if (Array.isArray(value)) { value.forEach((item) => discoverEndpoints(item, urls)); return urls; }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/endpoint|url|href|api|resource/i.test(key)) addEndpoint(urls, child);
    discoverEndpoints(child, urls);
  }
  return urls;
}
function directSeedUrls(ids: { competitionId: string; seasonId: string; stageId: string; matchId: string }) {
  const query = `locale=pt&competitionId=${ids.competitionId}&seasonId=${ids.seasonId}&stageId=${ids.stageId}&matchId=${ids.matchId}`;
  const path = `pt/match-centre/match/${ids.competitionId}/${ids.seasonId}/${ids.stageId}/${ids.matchId}`;
  return [
    `${CXM_BASE}/pages/${path}`,
    `${CXM_BASE}/sections/matchdetails/header?${query}`,
    `${CXM_BASE}/sections/matchdetails/tabs?${query}`,
    `${CXM_BASE}/sections/matchdetails/statistics?${query}`,
    `${CXM_BASE}/sections/matchdetails/stats?${query}`,
    `${CXM_BASE}/sections/matchdetails/matchstats?${query}`,
    `${CXM_BASE}/sections/matchdetails/lineups?${query}`,
    `${CXM_BASE}/sections/matchdetails/timeline?${query}`,
  ];
}
async function fetchDirectJson(url: string) {
  const res = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json,text/plain,*/*', 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8', referer: 'https://www.fifa.com/' } });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
  try { return JSON.parse(text); } catch { return { text }; }
}
async function captureDirect(ids: { competitionId: string; seasonId: string; stageId: string; matchId: string }, maxRequests = 24): Promise<DirectCapture> {
  const queue = directSeedUrls(ids);
  const queued = new Set(queue);
  const visited: string[] = [];
  const failed: DirectCapture['failed'] = [];
  const jsonItems: DirectCapture['jsonItems'] = [];
  while (queue.length && visited.length < maxRequests) {
    const url = queue.shift()!;
    if (visited.includes(url)) continue;
    visited.push(url);
    try {
      const json = await fetchDirectJson(url);
      jsonItems.push({ url, json });
      for (const next of discoverEndpoints(json)) if (!queued.has(next) && !visited.includes(next)) { queued.add(next); queue.push(next); }
    } catch (error) {
      failed.push({ url, error: error instanceof Error ? error.message : 'erro ao buscar endpoint FIFA' });
    }
  }
  return { jsonItems, visited, failed, discovered: Array.from(queued) };
}

async function launchBrowser() {
  const chromium = await import('@sparticuz/chromium');
  const playwright = await import('playwright-core');
  const executablePath = await chromium.default.executablePath();
  return playwright.chromium.launch({ args: [...chromium.default.args, '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--no-sandbox'], executablePath, headless: true });
}
async function captureRendered(url: string, fast = true): Promise<Capture> {
  const browser = await launchBrowser();
  const networkJson: Capture['networkJson'] = []; let networkCount = 0; let likelyNetworkCount = 0;
  const startedAt = Date.now();
  const budgetMs = fast ? 17000 : 38000;
  try {
    const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36', locale: 'pt-BR', viewport: { width: 1280, height: 1200 } });
    await page.route('**/*', async (route) => { const type = route.request().resourceType(); if (['image','font','media'].includes(type)) return route.abort().catch(() => undefined); return route.continue().catch(() => undefined); });
    page.on('response', async (response) => {
      const responseUrl = response.url();
      if (!/fifa|match|football|api|graphql|stats|statistics|_next|cxm-api/i.test(responseUrl)) return;
      try {
        networkCount += 1;
        const ct = response.headers()['content-type'] ?? '';
        if (!/json|text|javascript/i.test(ct) && !/api|graphql|_next/i.test(responseUrl)) return;
        const txt = await response.text().catch(() => '');
        if (/stat|corner|possession|shot|foul|offside|pass|xg|attempt|escanteio|finaliza/i.test(`${responseUrl}\n${txt.slice(0, 8000)}`)) likelyNetworkCount += 1;
        let json: unknown = null;
        try { if (/json/i.test(ct) || /^[\[{]/.test(txt.trim())) json = JSON.parse(txt); } catch {}
        if (json) networkJson.push({ url: responseUrl, json });
      } catch {}
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: fast ? 14000 : 30000 }).catch(() => undefined);
    await page.waitForTimeout(fast ? 1600 : 3500);
    const snapshots: Capture['snapshots'] = [];
    async function snap(label: string) { const text = await page.locator('body').innerText({ timeout: 2500 }).catch(() => ''); snapshots.push({ label, text: text.slice(0, 12000) }); }
    await snap('initial');
    for (const label of ['Concordo', 'Rejeitar todos', 'Estatísticas', 'Estatisticas', 'Statistics', 'Stats', 'Match facts']) {
      if (Date.now() - startedAt > budgetMs - 3500) break;
      const locator = page.getByText(label, { exact: false }).first();
      if (await locator.count().catch(() => 0)) { await locator.click({ timeout: 1500 }).catch(() => undefined); await page.waitForTimeout(800); await snap(`clicked-${label}`); }
    }
    const scrolls = fast ? 2 : 5;
    for (let i = 0; i < scrolls; i += 1) {
      if (Date.now() - startedAt > budgetMs - 3000) break;
      await page.mouse.wheel(0, 1200).catch(() => undefined); await page.waitForTimeout(700); await snap(`scroll-${i + 1}`);
    }
    const pageText = await page.locator('body').innerText({ timeout: 2500 }).catch(() => '');
    return { pageText, snapshots, networkJson, networkCount, likelyNetworkCount };
  } finally { await browser.close().catch(() => undefined); }
}
async function findMatch(body: Body, url: string): Promise<MatchRow | null> {
  if (body.localMatchId) { const rows = await sql`SELECT id, home_team_id, away_team_id, home_team_name, away_team_name, fixture_key, fifa_match_id FROM world_cup_matches WHERE id = ${Number(body.localMatchId)} LIMIT 1`; if (rows[0]) return rows[0] as MatchRow; }
  const officialId = String(body.fifaMatchId ?? idsFromUrl(url)?.matchId ?? '');
  if (officialId) { const rows = await sql`SELECT id, home_team_id, away_team_id, home_team_name, away_team_name, fixture_key, fifa_match_id FROM world_cup_matches WHERE competition_key = ${WORLD_CUP_2026_KEY} AND fifa_match_id = ${officialId} LIMIT 1`; if (rows[0]) return rows[0] as MatchRow; }
  return null;
}
async function save(match: MatchRow, stat: Stat, url: string, officialId: string, reversed: boolean) {
  const rows = [{ teamId: reversed ? match.away_team_id : match.home_team_id, value: reversed ? stat.away : stat.home, side: 'home' }, { teamId: reversed ? match.home_team_id : match.away_team_id, value: reversed ? stat.home : stat.away, side: 'away' }];
  let count = 0;
  for (const row of rows) {
    if (!row.teamId || row.value === null) continue;
    const payload = JSON.stringify({ importedBy: 'fifa-cxm-api-first-timeout-safe', matchCentreUrl: url, fifaMatchId: officialId, sourceUrl: stat.sourceUrl, path: stat.path, raw: stat.raw, side: row.side });
    await sql`
      INSERT INTO world_cup_match_statistics (match_id, team_id, period, metric_key, metric_name, value_numeric, source_key, source_payload, source_updated_at)
      VALUES (${match.id}, ${row.teamId}, 'match', ${stat.metricKey}, ${stat.metricName}, ${Number(row.value)}, 'fifa', ${payload}::jsonb, NOW())
      ON CONFLICT ON CONSTRAINT world_cup_match_statistics_unique
      DO UPDATE SET metric_name = EXCLUDED.metric_name, value_numeric = EXCLUDED.value_numeric, source_key = EXCLUDED.source_key, source_payload = EXCLUDED.source_payload, source_updated_at = NOW()
    `;
    count += 1;
  }
  return count;
}

async function run(body: Body) {
  const url = body.matchCentreUrl ?? body.url ?? (body.fifaMatchId ? urlFromMatchId(body.fifaMatchId) : DEFAULT_URL);
  const urlIds = idsFromUrl(url);
  const officialId = String(body.fifaMatchId ?? urlIds?.matchId ?? DEFAULT_MATCH_ID);
  const ids = urlIds ?? { competitionId: COMPETITION_ID, seasonId: SEASON_ID, stageId: STAGE_ID, matchId: officialId };
  const maxStats = Math.max(1, Math.min(Number(body.maxStats ?? 16), 32));

  const direct = await captureDirect(ids);
  let allStats = dedupe(direct.jsonItems.flatMap((item, i) => collect(item.json, `$cxm[${i}]`, [], item.url)));
  let capture: Capture | null = null;
  if (allStats.length === 0) {
    capture = await captureRendered(url, body.fast !== false);
    allStats = dedupe([...capture.networkJson.flatMap((item, i) => collect(item.json, `$network[${i}]`, [], item.url)), ...extractRenderedTextStats(capture.snapshots, capture.pageText)]);
  }
  const stats = allStats.slice(0, maxStats);
  const match = await findMatch(body, url);
  if (!match) return NextResponse.json({ success: false, error: 'Partida não encontrada no banco.', detected: { officialId, url }, extractedStats: stats, parser: { directVisited: direct.visited.length, directJson: direct.jsonItems.length, directFailed: direct.failed.length, networkCount: capture?.networkCount ?? 0, likelyNetworkCount: capture?.likelyNetworkCount ?? 0, snapshots: capture?.snapshots.length ?? 0 } }, { status: 404 });
  const reversed = Boolean(body.homeTeamName && body.awayTeamName && sameTeam(match.home_team_name, body.awayTeamName) && sameTeam(match.away_team_name, body.homeTeamName));
  let savedValues = 0;
  if (!body.dryRun) {
    if (officialId) await sql`UPDATE world_cup_matches SET fifa_match_id = ${officialId}, source_payload = COALESCE(source_payload, '{}'::jsonb) || ${JSON.stringify({ fifaMatchId: officialId, matchCentreUrl: url, cxmApiFirst: true, directVisited: direct.visited.length })}::jsonb, source_updated_at = NOW(), updated_at = NOW() WHERE id = ${match.id}`;
    for (const stat of stats) savedValues += await save(match, stat, url, officialId, reversed);
  }
  return NextResponse.json({
    success: true,
    dryRun: Boolean(body.dryRun),
    strategy: 'FIFA CxM API first + parser oficial por bloco renderizado: lê pages/sections oficiais e usa DOM apenas para estatísticas oficiais.',
    match,
    detected: { fifaMatchId: officialId, matchCentreUrl: url },
    parser: {
      directVisited: direct.visited.length,
      directJson: direct.jsonItems.length,
      directFailed: direct.failed.length,
      directDiscovered: direct.discovered.length,
      networkCount: capture?.networkCount ?? 0,
      likelyNetworkCount: capture?.likelyNetworkCount ?? 0,
      snapshots: capture?.snapshots.length ?? 0,
      pageTextLength: capture?.pageText.length ?? 0,
      extractedTotal: allStats.length,
      processedStats: stats.length,
      maxStats,
      strategy: allStats.length > 0 && !capture ? 'cxm-api-recursive' : 'browser-official-stats-block',
    },
    extractedStats: stats,
    savedValues,
    warning: stats.length === 0 ? 'A FIFA respondeu os endpoints oficiais, mas ainda não publicou estatísticas reconhecíveis para essa partida ou alterou o contrato de dados.' : null,
    debug: body.debug ? { directVisited: direct.visited, directFailed: direct.failed, directSamples: direct.jsonItems.slice(0, 8).map((n) => ({ url: n.url, preview: preview(n.json, 1200) })), networkSamples: capture?.networkJson.slice(0, 8).map((n) => ({ url: n.url, preview: preview(n.json, 1200) })) ?? [], snapshots: capture?.snapshots.map((s) => ({ label: s.label, text: s.text.slice(0, 2500) })) ?? [] } : undefined,
    lastUpdated: new Date().toISOString(),
  });
}
export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams;
    return await run({ url: p.get('url') ?? undefined, matchCentreUrl: p.get('matchCentreUrl') ?? undefined, fifaMatchId: p.get('fifaMatchId') ?? undefined, localMatchId: p.get('localMatchId') ?? undefined, homeTeamName: p.get('homeTeamName') ?? undefined, awayTeamName: p.get('awayTeamName') ?? undefined, dryRun: p.get('dryRun') !== 'false', debug: p.get('debug') === 'true', fast: p.get('fast') !== 'false', maxStats: p.get('maxStats') ?? undefined });
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro no importador FIFA CxM API first.' }, { status: 500 }); }
}
export async function POST(request: NextRequest) { try { return await run(await request.json().catch(() => ({}))); } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro no importador FIFA CxM API first.' }, { status: 500 }); } }
