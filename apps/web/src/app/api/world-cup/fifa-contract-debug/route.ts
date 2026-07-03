import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const COMPETITION_ID = '17';
const SEASON_ID = '285023';
const STAGE_ID = '289287';
const CXM_BASE = 'https://cxm-api.fifa.com/fifaplusweb/api';
const KEYWORDS = /estat[íi]st|statistics|stats|matchfacts|facts|boxscore|teamstats|possession|corner|cantos|escanteio|shot|chute|finaliza|foul|faltas|offside|imped|passes|xg|expected|attempt|cart/i;

function urlFromMatchId(matchId: string | number) {
  return `https://www.fifa.com/pt/match-centre/match/${COMPETITION_ID}/${SEASON_ID}/${STAGE_ID}/${matchId}`;
}
function idsFromUrl(url: string) {
  const m = url.match(/\/match-centre\/match\/(\d+)\/(\d+)\/(\d+)\/(\d+)/i);
  return m ? { competitionId: m[1], seasonId: m[2], stageId: m[3], matchId: m[4] } : null;
}
function preview(value: unknown, max = 1600) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
  return raw.replace(/\s+/g, ' ').slice(0, max);
}
function cxmEndpoint(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${CXM_BASE}/${pathOrUrl.replace(/^\/+/, '')}`;
}
function addEndpoint(urls: Set<string>, value: unknown) {
  if (typeof value !== 'string') return;
  const decoded = value.replace(/&amp;/g, '&');
  if (/^sections\//i.test(decoded) || /^pages\//i.test(decoded) || /\/fifaplusweb\/api\/(sections|pages)\//i.test(decoded)) urls.add(cxmEndpoint(decoded));
}
function discoverEndpoints(value: unknown, urls = new Set<string>()) {
  if (!value || typeof value !== 'object') return urls;
  if (Array.isArray(value)) {
    for (const item of value) discoverEndpoints(item, urls);
    return urls;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/endpoint|url|href|api|resource/i.test(key)) addEndpoint(urls, child);
    discoverEndpoints(child, urls);
  }
  return urls;
}
function seedUrls(ids: { competitionId: string; seasonId: string; stageId: string; matchId: string }) {
  const query = `locale=pt&competitionId=${ids.competitionId}&seasonId=${ids.seasonId}&stageId=${ids.stageId}&matchId=${ids.matchId}`;
  const pagePath = `pt/match-centre/match/${ids.competitionId}/${ids.seasonId}/${ids.stageId}/${ids.matchId}`;
  return [
    `${CXM_BASE}/pages/${pagePath}`,
    `${CXM_BASE}/sections/matchdetails/header?${query}`,
    `${CXM_BASE}/sections/matchdetails/tabs?${query}`,
    `${CXM_BASE}/sections/matchdetails/videos?${query}`,
    `${CXM_BASE}/sections/matchdetails/statistics?${query}`,
    `${CXM_BASE}/sections/matchdetails/stats?${query}`,
    `${CXM_BASE}/sections/matchdetails/matchstats?${query}`,
    `${CXM_BASE}/sections/matchdetails/timeline?${query}`,
    `${CXM_BASE}/sections/matchdetails/lineups?${query}`,
  ];
}
async function fetchDirect(url: string) {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { accept: 'application/json,text/plain,*/*', 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8', referer: 'https://www.fifa.com/' },
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch {}
  return { url, ok: res.ok, status: res.status, contentType: res.headers.get('content-type') ?? '', hasKeywords: KEYWORDS.test(`${url}\n${text.slice(0, 10000)}`), preview: preview(json ?? text, 1800), json };
}
async function captureDirect(ids: { competitionId: string; seasonId: string; stageId: string; matchId: string }) {
  const queue = seedUrls(ids);
  const queued = new Set(queue);
  const responses: Array<ReturnType<typeof stripJson>> = [];
  const failed: Array<{ url: string; error: string }> = [];
  while (queue.length && responses.length + failed.length < 28) {
    const url = queue.shift()!;
    try {
      const response = await fetchDirect(url);
      responses.push(stripJson(response));
      if (response.json) {
        for (const next of discoverEndpoints(response.json)) {
          if (!queued.has(next)) { queued.add(next); queue.push(next); }
        }
      }
    } catch (error) {
      failed.push({ url, error: error instanceof Error ? error.message : 'erro ao buscar endpoint' });
    }
  }
  return { visited: responses.length + failed.length, responses, failed, discovered: Array.from(queued) };
}
function stripJson(input: Awaited<ReturnType<typeof fetchDirect>>) {
  return { url: input.url, ok: input.ok, status: input.status, contentType: input.contentType, hasKeywords: input.hasKeywords, preview: input.preview };
}
async function launchBrowser() {
  const chromium = await import('@sparticuz/chromium');
  const playwright = await import('playwright-core');
  const executablePath = await chromium.default.executablePath();
  return playwright.chromium.launch({ args: [...chromium.default.args, '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--no-sandbox'], executablePath, headless: true });
}
async function captureRendered(url: string) {
  const browser = await launchBrowser();
  const network: Array<{ url: string; status: number; contentType: string; hasKeywords: boolean; preview: string }> = [];
  const allUrls: string[] = [];
  try {
    const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36', locale: 'pt-BR', viewport: { width: 1365, height: 1400 } });
    await page.route('**/*', async (route) => {
      const type = route.request().resourceType();
      if (['image', 'font', 'media'].includes(type)) return route.abort().catch(() => undefined);
      return route.continue().catch(() => undefined);
    });
    page.on('request', (request) => {
      const reqUrl = request.url();
      if (/fifa|cxm|api|graphql|_next|stats|match/i.test(reqUrl)) allUrls.push(reqUrl);
    });
    page.on('response', async (response) => {
      const responseUrl = response.url();
      if (!/fifa|cxm|api|graphql|_next|stats|match|football/i.test(responseUrl)) return;
      try {
        const ct = response.headers()['content-type'] ?? '';
        const text = await response.text().catch(() => '');
        const useful = KEYWORDS.test(`${responseUrl}\n${text.slice(0, 12000)}`);
        if (useful || /api|graphql|_next|cxm/i.test(responseUrl)) {
          network.push({ url: responseUrl, status: response.status(), contentType: ct, hasKeywords: useful, preview: preview(text, 1800) });
        }
      } catch {}
    });
    const snapshots: Array<{ label: string; length: number; text: string }> = [];
    async function snap(label: string) {
      const text = await page.locator('body').innerText({ timeout: 4000 }).catch(() => '');
      snapshots.push({ label, length: text.length, text: text.slice(0, 3500) });
    }
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => undefined);
    await page.waitForTimeout(3500);
    await snap('after-domcontentloaded');
    for (const label of ['Rejeitar todos', 'Concordo', 'Estatísticas', 'Estatisticas', 'Statistics', 'Stats', 'Match facts']) {
      const locator = page.getByText(label, { exact: false }).first();
      if (await locator.count().catch(() => 0)) {
        await locator.click({ timeout: 1800 }).catch(() => undefined);
        await page.waitForTimeout(1300);
        await snap(`clicked-${label}`);
      }
    }
    for (let i = 0; i < 5; i += 1) {
      await page.mouse.wheel(0, 1200).catch(() => undefined);
      await page.waitForTimeout(900);
      await snap(`scroll-${i + 1}`);
    }
    const html = await page.content().catch(() => '');
    const title = await page.title().catch(() => '');
    const finalUrl = page.url();
    return { title, finalUrl, htmlLength: html.length, htmlPreview: preview(html, 2200), requestUrls: Array.from(new Set(allUrls)).slice(0, 80), network: network.slice(0, 60), snapshots };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams;
    const fifaMatchId = p.get('fifaMatchId') ?? '400021526';
    const url = p.get('url') ?? urlFromMatchId(fifaMatchId);
    const ids = idsFromUrl(url) ?? { competitionId: COMPETITION_ID, seasonId: SEASON_ID, stageId: STAGE_ID, matchId: fifaMatchId };
    const [direct, rendered] = await Promise.all([captureDirect(ids), captureRendered(url)]);
    const likelyDirect = direct.responses.filter((item) => item.hasKeywords).map((item) => item.url);
    const likelyNetwork = rendered.network.filter((item) => item.hasKeywords).map((item) => item.url);
    return NextResponse.json({
      success: true,
      fifaMatchId,
      url,
      purpose: 'Diagnóstico do contrato FIFA: lista endpoints oficiais, chamadas de rede, previews e textos renderizados para localizar onde as estatísticas são carregadas.',
      summary: {
        directVisited: direct.visited,
        directKeywordEndpoints: likelyDirect.length,
        networkCaptured: rendered.network.length,
        networkKeywordEndpoints: likelyNetwork.length,
        snapshots: rendered.snapshots.length,
        nonEmptySnapshots: rendered.snapshots.filter((s) => s.length > 0).length,
        htmlLength: rendered.htmlLength,
      },
      likelyDirect,
      likelyNetwork,
      direct,
      rendered,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro no diagnóstico FIFA.' }, { status: 500 });
  }
}
