import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

type CapturedResponse = {
  url: string;
  status: number;
  contentType: string;
  method: string;
  resourceType: string;
  length: number;
  score: number;
  json?: unknown;
  textPreview?: string;
  error?: string;
};

const DEFAULT_URL = 'https://www.fifa.com/pt/match-centre/match/17/285023/289287/400021516';
const STAT_TERMS = [
  'statistics', 'stats', 'matchstats', 'match-stat', 'possession', 'corners', 'corner', 'shots', 'attempts',
  'cards', 'fouls', 'offsides', 'passes', 'crosses', 'tackles', 'interceptions', 'clearances', 'expectedgoals', 'xg',
  'estatisticas', 'escanteios', 'finalizacoes', 'posse', 'cartoes', 'faltas', 'impedimentos'
];

function scorePayload(url: string, contentType: string, text: string) {
  const haystack = `${url}\n${contentType}\n${text.slice(0, 15000)}`.toLowerCase();
  let score = 0;
  for (const term of STAT_TERMS) if (haystack.includes(term)) score += 2;
  if (/api|graphql|query|statistics|stats|football|match/i.test(url)) score += 3;
  if (/application\/json/i.test(contentType) || /^[\[{]/.test(text.trim())) score += 3;
  if (/home|away|hometeam|awayteam|team/i.test(text.toLowerCase())) score += 1;
  if (/corner|corners|possession|shots|attempts|passes|xg|expected/i.test(text.toLowerCase())) score += 5;
  return score;
}

async function launchBrowser() {
  const chromium = await import('@sparticuz/chromium');
  const playwright = await import('playwright-core');
  const executablePath = await chromium.default.executablePath();
  return playwright.chromium.launch({
    args: [...chromium.default.args, '--disable-web-security', '--disable-features=IsolateOrigins,site-per-process'],
    executablePath,
    headless: true,
  });
}

async function capture(url: string, waitMs: number) {
  const browser = await launchBrowser();
  const responses: CapturedResponse[] = [];
  try {
    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
      locale: 'pt-BR',
      viewport: { width: 1440, height: 1100 },
    });
    await page.route('**/*', async (route) => {
      const req = route.request();
      if (['image', 'font', 'media'].includes(req.resourceType())) return route.abort().catch(() => undefined);
      return route.continue().catch(() => undefined);
    });
    page.on('response', async (response) => {
      const request = response.request();
      const responseUrl = response.url();
      if (!/fifa|match|football|api|graphql|stats|statistics|_next/i.test(responseUrl)) return;
      try {
        const headers = response.headers();
        const contentType = headers['content-type'] ?? '';
        if (!/json|text|javascript|octet-stream/i.test(contentType) && !/api|graphql|_next\/data/i.test(responseUrl)) return;
        const text = await response.text().catch(() => '');
        const score = scorePayload(responseUrl, contentType, text);
        if (score < 5 && responses.length > 80) return;
        let json: unknown = undefined;
        try { if (/json/i.test(contentType) || /^[\[{]/.test(text.trim())) json = JSON.parse(text); } catch {}
        responses.push({
          url: responseUrl,
          status: response.status(),
          contentType,
          method: request.method(),
          resourceType: request.resourceType(),
          length: text.length,
          score,
          json,
          textPreview: text.slice(0, 1200),
        });
      } catch (error) {
        responses.push({ url: responseUrl, status: response.status(), contentType: '', method: request.method(), resourceType: request.resourceType(), length: 0, score: 0, error: error instanceof Error ? error.message : 'capture error' });
      }
    });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    await page.waitForTimeout(waitMs);
    await page.mouse.wheel(0, 1600).catch(() => undefined);
    await page.waitForTimeout(Math.min(3500, waitMs));
    const pageText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    return { responses: responses.sort((a, b) => b.score - a.score || b.length - a.length).slice(0, 80), pageText: pageText.slice(0, 6000) };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url') ?? DEFAULT_URL;
  const waitMs = Math.max(1000, Math.min(Number(request.nextUrl.searchParams.get('waitMs') ?? 6000), 12000));
  if (!/^https:\/\/www\.fifa\.com\/pt\/match-centre\/match\//i.test(url)) {
    return NextResponse.json({ success: false, error: 'Informe uma URL válida do Match Centre da FIFA.' }, { status: 400 });
  }
  try {
    const result = await capture(url, waitMs);
    const likelyStats = result.responses.filter((item) => item.score >= 10 || /statistics|stats|graphql|live\/football/i.test(item.url)).slice(0, 25);
    return NextResponse.json({
      success: true,
      strategy: 'Playwright + Chromium serverless: captura XHR/fetch reais disparados pela página FIFA.',
      url,
      waitMs,
      capturedCount: result.responses.length,
      likelyStatsCount: likelyStats.length,
      likelyStats,
      responses: result.responses,
      pageText: result.pageText,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao capturar rede do Match Centre.',
      hint: 'Se o erro for de Chromium no Vercel, confirmar instalação de @sparticuz/chromium e playwright-core no deploy.',
      lastUpdated: new Date().toISOString(),
    }, { status: 500 });
  }
}
