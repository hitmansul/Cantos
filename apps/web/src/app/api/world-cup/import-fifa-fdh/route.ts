import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const WORLD_CUP_2026_KEY = 'world_cup_2026';
const COMPETITION_ID = '17';
const SEASON_ID = '285023';
const STAGE_ID = '289287';
const DEFAULT_MATCH_ID = '400021526';

type Body = {
  fifaMatchId?: string | number;
  localMatchId?: string | number;
  matchCentreUrl?: string;
  dryRun?: boolean;
  debug?: boolean;
};
type MatchRow = {
  id: number;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team_name: string;
  away_team_name: string;
  fixture_key: string;
  fifa_match_id?: string | null;
};
type Stat = { metricKey: string; metricName: string; home: number; away: number; rawKey: string; sourceUrl: string; fdhMatchId: string };

const METRICS: Record<string, string> = {
  possession: 'Posse de bola',
  goals: 'Gols',
  goals_conceded: 'Gols sofridos',
  assists: 'Assistências',
  shots: 'Finalizações',
  shotsontarget: 'Finalizações no gol',
  shots_off_target: 'Finalizações para fora',
  corners: 'Escanteios',
  yellowcards: 'Cartões amarelos',
  redcards: 'Cartões vermelhos',
  fouls: 'Faltas',
  offsides: 'Impedimentos',
  passes: 'Passes totais',
  completedpasses: 'Passes concluídos',
  crosses: 'Cruzamentos',
  completedcrosses: 'Cruzamentos concluídos',
  freekicks: 'Livres',
  penaltiesconverted: 'Pênaltis convertidos',
  saves: 'Defesas do goleiro',
  expectedgoals: 'Gols esperados (xG)',
  turnoversforced: 'Erros forçados',
  defensivepressures: 'Pressões defensivas exercidas',
  tackles: 'Desarmes',
  interceptions: 'Interceptações',
  clearances: 'Cortes defensivos',
};
const FDH_KEY_MAP: Record<string, string> = {
  assists: 'assists',
  attemptatgoal: 'shots',
  attemptatgoalontarget: 'shotsontarget',
  attemptatgoalofftarget: 'shots_off_target',
  corners: 'corners',
  crosses: 'crosses',
  crossescompleted: 'completedcrosses',
  directfreekicks: 'freekicks',
  directredcards: 'redcards',
  redcards: 'redcards',
  yellowcards: 'yellowcards',
  foulscommitted: 'fouls',
  fouls: 'fouls',
  offsides: 'offsides',
  passes: 'passes',
  distributions: 'passes',
  passescompleted: 'completedpasses',
  distributionscompleted: 'completedpasses',
  distributionscompletedunderpressure: 'completedpasses',
  possession: 'possession',
  possessionpercentage: 'possession',
  goals: 'goals',
  goalsconceded: 'goals_conceded',
  goalsagainst: 'goals_conceded',
  penaltiesconverted: 'penaltiesconverted',
  penalties: 'penaltiesconverted',
  saves: 'saves',
  goalkeepersaves: 'saves',
  expectedgoals: 'expectedgoals',
  xg: 'expectedgoals',
  forcedturnovers: 'turnoversforced',
  turnoversforced: 'turnoversforced',
  defensivepressuresapplied: 'defensivepressures',
  defensivepressures: 'defensivepressures',
  tackles: 'tackles',
  interceptions: 'interceptions',
  clearances: 'clearances',
};
const ORDER = ['possession','goals','goals_conceded','assists','shots','shotsontarget','shots_off_target','corners','yellowcards','redcards','fouls','offsides','passes','completedpasses','crosses','completedcrosses','freekicks','penaltiesconverted','saves','expectedgoals','turnoversforced','defensivepressures','tackles','interceptions','clearances'];

function cleanKey(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
}
function urlFromMatchId(matchId: string | number) {
  return `https://www.fifa.com/pt/match-centre/match/${COMPETITION_ID}/${SEASON_ID}/${STAGE_ID}/${matchId}`;
}
function idsFromUrl(url: string) {
  const m = url.match(/\/match-centre\/match\/(\d+)\/(\d+)\/(\d+)\/(\d+)/i);
  return m ? { competitionId: m[1], seasonId: m[2], stageId: m[3], matchId: m[4] } : null;
}
function num(value: unknown): number | null {
  const n = Number(String(value ?? '').replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function preview(value: unknown, max = 1200) {
  return String(typeof value === 'string' ? value : JSON.stringify(value) ?? '').replace(/\s+/g, ' ').slice(0, max);
}
async function fetchJson(url: string) {
  const res = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json,text/plain,*/*', 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8', referer: 'https://www.fifa.com/' } });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
  return JSON.parse(text);
}
async function findMatch(body: Body, fifaMatchId: string): Promise<MatchRow | null> {
  if (body.localMatchId) {
    const rows = await sql`SELECT id, home_team_id, away_team_id, home_team_name, away_team_name, fixture_key, fifa_match_id FROM world_cup_matches WHERE id = ${Number(body.localMatchId)} LIMIT 1`;
    if (rows[0]) return rows[0] as MatchRow;
  }
  const rows = await sql`SELECT id, home_team_id, away_team_id, home_team_name, away_team_name, fixture_key, fifa_match_id FROM world_cup_matches WHERE competition_key = ${WORLD_CUP_2026_KEY} AND fifa_match_id = ${fifaMatchId} LIMIT 1`;
  return (rows[0] as MatchRow) ?? null;
}
function localizedName(value: unknown) {
  if (!Array.isArray(value)) return null;
  const pt = value.find((item) => item && typeof item === 'object' && String((item as Record<string, unknown>).Locale ?? '').toLowerCase().startsWith('pt')) as Record<string, unknown> | undefined;
  const any = value[0] as Record<string, unknown> | undefined;
  return String(pt?.Description ?? any?.Description ?? '') || null;
}
function findMatchObject(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object') return null;
  const obj = json as Record<string, unknown>;
  if (obj.Home && obj.Away) return obj;
  const list = obj.MatchesList;
  if (Array.isArray(list) && list[0] && typeof list[0] === 'object') return list[0] as Record<string, unknown>;
  return null;
}
async function getCalendarInfo(fifaMatchId: string) {
  const urls = [
    `https://api.fifa.com/api/v3/live/football/${COMPETITION_ID}/${SEASON_ID}/${STAGE_ID}/${fifaMatchId}?language=pt`,
    `https://api.fifa.com/api/v3/live/football/${fifaMatchId}?language=pt`,
    `https://api.fifa.com/api/v3/calendar/${fifaMatchId}?language=pt`,
    `https://api.fifa.com/api/v3/calendar/matches?language=pt&idCompetition=${COMPETITION_ID}&idSeason=${SEASON_ID}&idStage=${STAGE_ID}&idMatch=${fifaMatchId}&count=400`,
  ];
  const attempts: Array<{ url: string; ok: boolean; preview?: string; error?: string }> = [];
  for (const url of urls) {
    try {
      const json = await fetchJson(url);
      attempts.push({ url, ok: true, preview: preview(json, 500) });
      const match = findMatchObject(json);
      if (!match) continue;
      const home = match.HomeTeam ?? match.Home;
      const away = match.AwayTeam ?? match.Away;
      if (home && away && typeof home === 'object' && typeof away === 'object') {
        const h = home as Record<string, unknown>;
        const a = away as Record<string, unknown>;
        return {
          homeFifaTeamId: String(h.IdTeam ?? ''),
          awayFifaTeamId: String(a.IdTeam ?? ''),
          homeName: localizedName(h.TeamName) ?? String(h.ShortClubName ?? h.Abbreviation ?? ''),
          awayName: localizedName(a.TeamName) ?? String(a.ShortClubName ?? a.Abbreviation ?? ''),
          attempts,
        };
      }
    } catch (error) {
      attempts.push({ url, ok: false, error: error instanceof Error ? error.message : 'erro calendário' });
    }
  }
  return { homeFifaTeamId: '', awayFifaTeamId: '', homeName: '', awayName: '', attempts };
}
async function launchBrowser() {
  const chromium = await import('@sparticuz/chromium');
  const playwright = await import('playwright-core');
  const executablePath = await chromium.default.executablePath();
  return playwright.chromium.launch({ args: [...chromium.default.args, '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--no-sandbox'], executablePath, headless: true });
}
async function discoverFdhTeams(url: string) {
  const browser = await launchBrowser();
  const seen: string[] = [];
  let teamsUrl = '';
  let teamsJson: unknown = null;
  try {
    const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36', locale: 'pt-BR', viewport: { width: 1365, height: 1600 } });
    await page.route('**/*', async (route) => {
      const type = route.request().resourceType();
      if (['image','font','media'].includes(type)) return route.abort().catch(() => undefined);
      return route.continue().catch(() => undefined);
    });
    page.on('response', async (response) => {
      const responseUrl = response.url();
      if (/fdh-api\.fifa\.com\/v1\/stats\/match\/\d+\/teams\.json/i.test(responseUrl)) {
        seen.push(responseUrl);
        if (!teamsJson) {
          teamsUrl = responseUrl;
          teamsJson = await response.json().catch(() => null);
        }
      }
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => undefined);
    await page.waitForTimeout(4200);
    for (const label of ['Rejeitar todos','Concordo','Estatísticas','Estatisticas','Statistics','Stats']) {
      const locator = page.getByText(label, { exact: false }).first();
      if (await locator.count().catch(() => 0)) {
        await locator.click({ timeout: 1800 }).catch(() => undefined);
        await page.waitForTimeout(1700);
      }
    }
    for (let i = 0; i < 5 && !teamsJson; i += 1) {
      await page.mouse.wheel(0, 1400).catch(() => undefined);
      await page.waitForTimeout(900);
    }
    if (teamsUrl && !teamsJson) teamsJson = await fetchJson(teamsUrl).catch(() => null);
    return { teamsUrl, teamsJson, seen };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
function parseFdhStats(json: unknown, homeFifaTeamId: string, awayFifaTeamId: string, teamsUrl: string): Stat[] {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return [];
  const data = json as Record<string, unknown>;
  const keys = Object.keys(data);
  const homeKey = data[homeFifaTeamId] ? homeFifaTeamId : keys[0];
  const awayKey = data[awayFifaTeamId] ? awayFifaTeamId : keys.find((k) => k !== homeKey) ?? keys[1];
  const homeRows = Array.isArray(data[homeKey]) ? data[homeKey] as unknown[] : [];
  const awayRows = Array.isArray(data[awayKey]) ? data[awayKey] as unknown[] : [];
  const toMap = (rows: unknown[]) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 2) continue;
      const rawKey = String(row[0] ?? '');
      const value = num(row[1]);
      if (value === null) continue;
      map.set(cleanKey(rawKey), value);
    }
    return map;
  };
  const h = toMap(homeRows);
  const a = toMap(awayRows);
  const stats: Stat[] = [];
  const used = new Set<string>();
  for (const [fdhKey, metricKey] of Object.entries(FDH_KEY_MAP)) {
    if (used.has(metricKey)) continue;
    const home = h.get(fdhKey);
    const away = a.get(fdhKey);
    if (home === undefined || away === undefined) continue;
    if (!Number.isFinite(home) || !Number.isFinite(away)) continue;
    used.add(metricKey);
    const match = teamsUrl.match(/\/match\/(\d+)\//);
    stats.push({ metricKey, metricName: METRICS[metricKey] ?? metricKey, home, away, rawKey: fdhKey, sourceUrl: teamsUrl, fdhMatchId: match?.[1] ?? '' });
  }
  return stats.sort((x, y) => ORDER.indexOf(x.metricKey) - ORDER.indexOf(y.metricKey));
}
async function save(match: MatchRow, stat: Stat, fifaMatchId: string, matchCentreUrl: string) {
  const rows = [
    { teamId: match.home_team_id, value: stat.home, side: 'home' },
    { teamId: match.away_team_id, value: stat.away, side: 'away' },
  ];
  let count = 0;
  for (const row of rows) {
    if (!row.teamId) continue;
    const payload = JSON.stringify({ importedBy: 'fifa-fdh-api', fifaMatchId, fdhMatchId: stat.fdhMatchId, matchCentreUrl, sourceUrl: stat.sourceUrl, rawKey: stat.rawKey, side: row.side });
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
  const matchCentreUrl = body.matchCentreUrl ?? urlFromMatchId(body.fifaMatchId ?? DEFAULT_MATCH_ID);
  const fifaMatchId = String(body.fifaMatchId ?? idsFromUrl(matchCentreUrl)?.matchId ?? DEFAULT_MATCH_ID);
  const [match, calendar] = await Promise.all([findMatch(body, fifaMatchId), getCalendarInfo(fifaMatchId)]);
  const discovered = await discoverFdhTeams(matchCentreUrl);
  const teamsUrl = discovered.teamsUrl;
  const fdhJson = discovered.teamsJson;
  const stats = parseFdhStats(fdhJson, calendar.homeFifaTeamId, calendar.awayFifaTeamId, teamsUrl).slice(0, 32);
  if (!match) {
    return NextResponse.json({ success: false, error: 'Partida não encontrada no banco.', detected: { fifaMatchId, matchCentreUrl, teamsUrl, calendar }, extractedStats: stats }, { status: 404 });
  }
  let savedValues = 0;
  if (!body.dryRun && stats.length > 0) {
    await sql`UPDATE world_cup_matches SET fifa_match_id = ${fifaMatchId}, source_payload = COALESCE(source_payload, '{}'::jsonb) || ${JSON.stringify({ fifaMatchId, fdhTeamsUrl: teamsUrl, fdhImport: true })}::jsonb, source_updated_at = NOW(), updated_at = NOW() WHERE id = ${match.id}`;
    for (const stat of stats) savedValues += await save(match, stat, fifaMatchId, matchCentreUrl);
  }
  return NextResponse.json({
    success: true,
    dryRun: Boolean(body.dryRun),
    strategy: 'FIFA FDH API: descobre fdhMatchId pela página, lê teams.json e grava estatísticas oficiais por equipe.',
    match,
    detected: { fifaMatchId, matchCentreUrl, fdhTeamsUrl: teamsUrl, fdhMatchId: teamsUrl.match(/\/match\/(\d+)\//)?.[1] ?? null, calendar },
    parser: { source: 'fdh-api', discoveredFdhUrls: discovered.seen, processedStats: stats.length, savedValues },
    extractedStats: stats,
    savedValues,
    warning: stats.length === 0 ? 'Não foi possível extrair estatísticas do FDH teams.json nesta execução.' : null,
    debug: body.debug ? { fdhPreview: preview(fdhJson, 2500), calendar } : undefined,
    lastUpdated: new Date().toISOString(),
  });
}
export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams;
    return await run({ fifaMatchId: p.get('fifaMatchId') ?? undefined, localMatchId: p.get('localMatchId') ?? undefined, matchCentreUrl: p.get('matchCentreUrl') ?? undefined, dryRun: p.get('dryRun') !== 'false', debug: p.get('debug') === 'true' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro no importador FIFA FDH.' }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  try {
    return await run(await request.json().catch(() => ({})));
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro no importador FIFA FDH.' }, { status: 500 });
  }
}
