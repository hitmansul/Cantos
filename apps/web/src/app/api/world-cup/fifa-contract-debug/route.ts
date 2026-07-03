import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const COMPETITION_ID = '17';
const SEASON_ID = '285023';
const STAGE_ID = '289287';
const CXM_BASE = 'https://cxm-api.fifa.com/fifaplusweb/api';
const KEYWORDS = /estat[íi]st|statistics|stats|matchfacts|facts|boxscore|teamstats|possession|corner|cantos|escanteio|shot|chute|finaliza|foul|faltas|offside|imped|passes|xg|expected|attempt|cart|discipline|attack|defence|defense|distribution/i;

function urlFromMatchId(matchId: string | number) {
  return `https://www.fifa.com/pt/match-centre/match/${COMPETITION_ID}/${SEASON_ID}/${STAGE_ID}/${matchId}`;
}
function idsFromUrl(url: string) {
  const m = url.match(/\/match-centre\/match\/(\d+)\/(\d+)\/(\d+)\/(\d+)/i);
  return m ? { competitionId: m[1], seasonId: m[2], stageId: m[3], matchId: m[4] } : null;
}
function preview(value: unknown, max = 2200) {
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
  return { url, ok: res.ok, status: res.status, contentType: res.headers.get('content-type') ?? '', hasKeywords: KEYWORDS.test(`${url}\n${text.slice(0, 20000)}`), preview: preview(json ?? text), json };
}
async function captureDirect(ids: { competitionId: string; seasonId: string; stageId: string; matchId: string }) {
  const queue = seedUrls(ids);
  const queued = new Set(queue);
  const responses: Array<ReturnType<typeof stripJson>> = [];
  const failed: Array<{ url: string; error: string }> = [];
  while (queue.length && responses.length + failed.length < 36) {
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
function browserSpyScript() {
  return `
(() => {
  const KEYWORDS = /estat[íi]st|statistics|stats|matchfacts|facts|boxscore|teamstats|possession|corner|cantos|escanteio|shot|chute|finaliza|foul|faltas|offside|imped|passes|xg|expected|attempt|cart|discipline|attack|defence|defense|distribution/i;
  window.__fifaDebug = { fetches: [], xhrs: [], errors: [] };
  const save = (bucket, item) => {
    try {
      const text = String(item.body || '');
      const hit = KEYWORDS.test(String(item.url || '') + '\n' + text.slice(0, 30000));
      window.__fifaDebug[bucket].push({ ...item, hasKeywords: hit, preview: text.replace(/\s+/g, ' ').slice(0, 2500) });
      if (window.__fifaDebug[bucket].length > 90) window.__fifaDebug[bucket].shift();
    } catch (e) { window.__fifaDebug.errors.push(String(e)); }
  };
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
    const startedAt = Date.now();
    try {
      const response = await originalFetch(...args);
      const clone = response.clone();
      clone.text().then((body) => save('fetches', { url, status: response.status, method: (args[1] && args[1].method) || 'GET', durationMs: Date.now() - startedAt, body })).catch((e) => save('fetches', { url, status: response.status, error: String(e), body: '' }));
      return response;
    } catch (e) {
      save('fetches', { url, status: 0, error: String(e), body: '' });
      throw e;
    }
  };
  const OriginalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    let method = 'GET';
    let url = '';
    const open = xhr.open;
    xhr.open = function(m, u, ...rest) { method = m; url = String(u || ''); return open.call(xhr, m, u, ...rest); };
    xhr.addEventListener('loadend', () => {
      try { save('xhrs', { url, method, status: xhr.status, body: typeof xhr.responseText === 'string' ? xhr.responseText : '' }); } catch (e) { window.__fifaDebug.errors.push(String(e)); }
    });
    return xhr;
  };
})();`;
}
async function captureRendered(url: string) {
  const browser = await launchBrowser();
  const network: Array<{ url: string; method: string; resourceType: string; status: number; contentType: string; hasKeywords: boolean; preview: string }> = [];
  const allUrls: string[] = [];
  try {
    const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36', locale: 'pt-BR', viewport: { width: 1365, height: 1800 } });
    await page.addInitScript(browserSpyScript());
    await page.route('**/*', async (route) => {
      const type = route.request().resourceType();
      if (['image', 'font', 'media'].includes(type)) return route.abort().catch(() => undefined);
      return route.continue().catch(() => undefined);
    });
    page.on('request', (request) => {
      const reqUrl = request.url();
      if (/fifa|cxm|api|graphql|_next|stats|match|football|contentstack|cdn|edge/i.test(reqUrl)) allUrls.push(`${request.method()} ${request.resourceType()} ${reqUrl}`);
    });
    page.on('response', async (response) => {
      const responseUrl = response.url();
      if (!/fifa|cxm|api|graphql|_next|stats|match|football|contentstack|cdn|edge/i.test(responseUrl)) return;
      try {
        const request = response.request();
        const ct = response.headers()['content-type'] ?? '';
        const text = await response.text().catch(() => '');
        const useful = KEYWORDS.test(`${responseUrl}\n${text.slice(0, 30000)}`);
        network.push({ url: responseUrl, method: request.method(), resourceType: request.resourceType(), status: response.status(), contentType: ct, hasKeywords: useful, preview: preview(text, useful ? 3500 : 1400) });
      } catch {}
    });
    const snapshots: Array<{ label: string; length: number; text: string }> = [];
    async function snap(label: string) {
      const text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
      snapshots.push({ label, length: text.length, text: text.slice(0, 5000) });
    }
    await page.goto(url, { waitUntil: 'networkidle', timeout: 42000 }).catch(async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => undefined);
    });
    await page.waitForTimeout(5000);
    await snap('after-networkidle');
    for (const label of ['Rejeitar todos', 'Concordo', 'Aceitar', 'Reject all', 'Accept all']) {
      const locator = page.getByText(label, { exact: false }).first();
      if (await locator.count().catch(() => 0)) {
        await locator.click({ timeout: 2200 }).catch(() => undefined);
        await page.waitForTimeout(1800);
        await snap(`clicked-${label}`);
        break;
      }
    }
    for (const label of ['ESTATÍSTICAS', 'Estatísticas', 'Estatisticas', 'STATISTICS', 'Statistics', 'Stats', 'Match facts']) {
      const locator = page.getByText(label, { exact: false }).first();
      if (await locator.count().catch(() => 0)) {
        await locator.click({ timeout: 2600 }).catch(() => undefined);
        await page.waitForTimeout(2500);
        await snap(`clicked-${label}`);
      }
    }
    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button,a,[role="tab"],[role="button"]')) as HTMLElement[];
      for (const el of candidates) {
        const txt = (el.innerText || el.textContent || '').toLowerCase();
        if (txt.includes('estat') || txt.includes('stat')) el.click();
      }
    }).catch(() => undefined);
    await page.waitForTimeout(2500);
    await snap('after-dom-tab-clicks');
    for (let i = 0; i < 10; i += 1) {
      await page.mouse.wheel(0, 1400).catch(() => undefined);
      await page.waitForTimeout(900);
      if (i === 1 || i === 4 || i === 9) await snap(`scroll-${i + 1}`);
    }
    await page.waitForTimeout(3500);
    const html = await page.content().catch(() => '');
    const title = await page.title().catch(() => '');
    const finalUrl = page.url();
    const spy = await page.evaluate(() => (window as unknown as { __fifaDebug?: unknown }).__fifaDebug ?? null).catch(() => null);
    return { title, finalUrl, htmlLength: html.length, htmlPreview: preview(html, 3000), requestUrls: Array.from(new Set(allUrls)).slice(0, 140), network: network.slice(0, 120), snapshots, spy };
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
    const spyObj = rendered.spy && typeof rendered.spy === 'object' ? rendered.spy as { fetches?: Array<{ url?: string; hasKeywords?: boolean }>; xhrs?: Array<{ url?: string; hasKeywords?: boolean }> } : {};
    const likelySpyFetches = (spyObj.fetches ?? []).filter((item) => item.hasKeywords).map((item) => item.url);
    const likelySpyXhrs = (spyObj.xhrs ?? []).filter((item) => item.hasKeywords).map((item) => item.url);
    return NextResponse.json({
      success: true,
      fifaMatchId,
      url,
      purpose: 'Diagnóstico profundo FIFA: captura endpoints oficiais, network, monkey-patch de fetch/XHR, snapshots e previews para localizar onde estatísticas são carregadas.',
      summary: {
        directVisited: direct.visited,
        directKeywordEndpoints: likelyDirect.length,
        networkCaptured: rendered.network.length,
        networkKeywordEndpoints: likelyNetwork.length,
        spyFetches: spyObj.fetches?.length ?? 0,
        spyFetchKeywordEndpoints: likelySpyFetches.length,
        spyXhrs: spyObj.xhrs?.length ?? 0,
        spyXhrKeywordEndpoints: likelySpyXhrs.length,
        snapshots: rendered.snapshots.length,
        nonEmptySnapshots: rendered.snapshots.filter((s) => s.length > 0).length,
        htmlLength: rendered.htmlLength,
      },
      likelyDirect,
      likelyNetwork,
      likelySpyFetches,
      likelySpyXhrs,
      direct,
      rendered,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro no diagnóstico FIFA.' }, { status: 500 });
  }
}
