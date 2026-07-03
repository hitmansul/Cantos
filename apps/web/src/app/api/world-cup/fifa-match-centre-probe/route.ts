import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const DEFAULT_URL = 'https://www.fifa.com/pt/match-centre/match/17/285023/289287/400065454';

type NetworkItem = {
  url: string;
  status: number;
  contentType: string;
  sample: string;
  hasStatsHint: boolean;
};

function clip(value: unknown, max = 2000) {
  return String(value ?? '').replace(/\s+/g, ' ').slice(0, max);
}

function hasStatsHint(text: string) {
  return /stat|statistics|possession|corner|corners|shot|shots|foul|fouls|offside|xg|expected|pass|passes|cart[oõ]es|yellow|red|escanteio|finaliza/i.test(text);
}

async function launchBrowser() {
  const chromium = await import('@sparticuz/chromium');
  const playwright = await import('playwright-core');
  const executablePath = await chromium.default.executablePath();
  return playwright.chromium.launch({
    args: [...chromium.default.args, '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--no-sandbox'],
    executablePath,
    headless: true,
  });
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url') ?? DEFAULT_URL;
  const waitMs = Math.max(1000, Math.min(Number(request.nextUrl.searchParams.get('waitMs') ?? 2500), 7000));
  const startedAt = Date.now();
  const browser = await launchBrowser();
  const network: NetworkItem[] = [];
  const failed: Array<{ url: string; error: string }> = [];
  try {
    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
      locale: 'pt-BR',
      viewport: { width: 1280, height: 1400 },
    });
    await page.route('**/*', async (route) => {
      const type = route.request().resourceType();
      if (['image', 'font', 'media'].includes(type)) return route.abort().catch(() => undefined);
      return route.continue().catch(() => undefined);
    });
    page.on('requestfailed', (req) => {
      const u = req.url();
      if (/fifa|api|stats|match|graphql|_next/i.test(u)) failed.push({ url: u, error: req.failure()?.errorText ?? 'request failed' });
    });
    page.on('response', async (response) => {
      const responseUrl = response.url();
      if (!/fifa|api|stats|statistics|match|graphql|_next|football/i.test(responseUrl)) return;
      try {
        const contentType = response.headers()['content-type'] ?? '';
        if (!/json|text|javascript|html/i.test(contentType) && !/api|graphql|_next/i.test(responseUrl)) return;
        const text = await response.text().catch(() => '');
        network.push({
          url: responseUrl,
          status: response.status(),
          contentType,
          sample: clip(text, 2500),
          hasStatsHint: hasStatsHint(`${responseUrl}\n${text.slice(0, 5000)}`),
        });
      } catch {}
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18000 }).catch(() => undefined);
    await page.waitForTimeout(waitMs);
    for (const label of ['Estatísticas', 'Estatisticas', 'Statistics', 'Stats', 'Match facts']) {
      const locator = page.getByText(label, { exact: false }).first();
      if (await locator.count().catch(() => 0)) {
        await locator.click({ timeout: 1200 }).catch(() => undefined);
        await page.waitForTimeout(700);
      }
    }
    await page.mouse.wheel(0, 1400).catch(() => undefined);
    await page.waitForTimeout(500);

    const bodyText = await page.locator('body').innerText({ timeout: 4000 }).catch(() => '');
    const html = await page.content().catch(() => '');
    const scripts = await page.locator('script').evaluateAll((els) => els.map((el, index) => ({
      index,
      src: (el as HTMLScriptElement).src || null,
      textSample: ((el.textContent || '').replace(/\s+/g, ' ').slice(0, 2000)),
      hasStatsHint: /stat|statistics|possession|corner|shot|foul|offside|pass|xg|match/i.test(el.textContent || ''),
    })).slice(0, 80)).catch(() => []);
    const windowProbe = await page.evaluate(() => {
      const keys = Object.keys(window).filter((key) => /fifa|match|stat|stats|data|apollo|redux|next|graphql|fixture|football/i.test(key)).slice(0, 80);
      const values = keys.map((key) => {
        try {
          const value = (window as unknown as Record<string, unknown>)[key];
          const type = typeof value;
          const sample = type === 'string' ? String(value).slice(0, 1200) : JSON.stringify(value).slice(0, 1200);
          return { key, type, sample };
        } catch {
          return { key, type: 'unreadable', sample: '' };
        }
      });
      return values;
    }).catch(() => []);

    const likelyNetwork = network.filter((item) => item.hasStatsHint).slice(0, 30);
    return NextResponse.json({
      success: true,
      strategy: 'FIFA Match Centre probe: network, HTML, scripts and window globals.',
      url,
      durationMs: Date.now() - startedAt,
      bodyTextLength: bodyText.length,
      htmlLength: html.length,
      bodyTextSample: clip(bodyText, 3000),
      htmlStatsHints: {
        hasStatsHint: hasStatsHint(html),
        firstStatsIndex: html.search(/stat|statistics|possession|corner|shot|foul|offside|pass|xg/i),
        sampleAroundHint: (() => {
          const idx = html.search(/stat|statistics|possession|corner|shot|foul|offside|pass|xg/i);
          return idx >= 0 ? clip(html.slice(Math.max(0, idx - 1200), idx + 2500), 3500) : null;
        })(),
      },
      networkCount: network.length,
      likelyNetworkCount: likelyNetwork.length,
      likelyNetwork,
      networkUrls: network.map((item) => ({ url: item.url, status: item.status, contentType: item.contentType, hasStatsHint: item.hasStatsHint })).slice(0, 120),
      failed: failed.slice(0, 40),
      scripts,
      windowProbe,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro no probe FIFA.' }, { status: 500 });
  } finally {
    await browser.close().catch(() => undefined);
  }
}
