import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const HUB_URL = 'https://www.fifatrainingcentre.com/en/fifa-world-cup-2026/match-report-hub.php';
const FIFA_ORIGIN = 'https://www.fifatrainingcentre.com';

type SyncBody = {
  dryRun?: boolean;
  limit?: number;
  hubUrl?: string;
  onlyMissing?: boolean;
};

type ImportResult = {
  url: string;
  ok: boolean;
  status: number;
  payload?: unknown;
  error?: string;
};

function absoluteUrl(href: string) {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/')) return `${FIFA_ORIGIN}${href}`;
  return `${FIFA_ORIGIN}/${href.replace(/^\.\//, '')}`;
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function extractPmsrLinks(html: string) {
  const links: string[] = [];
  const hrefRegex = /href=["']([^"']+PMSR[^"']+\.pdf)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html))) links.push(absoluteUrl(match[1]));

  const rawPdfRegex = /(https?:\/\/[^\s"'<>]+PMSR[^\s"'<>]+\.pdf|\/media\/[^\s"'<>]+PMSR[^\s"'<>]+\.pdf)/gi;
  while ((match = rawPdfRegex.exec(html))) links.push(absoluteUrl(match[1]));

  return unique(links).filter((url) => /PMSR/i.test(url) && /\.pdf($|\?)/i.test(url));
}

async function fetchMissingFifa(origin: string) {
  try {
    const response = await fetch(`${origin}/api/world-cup/fifa-missing-stats`, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as { missingFifa?: Array<{ fixture_key?: string; home_team_name?: string; away_team_name?: string }> };
  } catch {
    return null;
  }
}

function normalize(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function maybeRelevantToMissing(url: string, missing: Awaited<ReturnType<typeof fetchMissingFifa>>) {
  if (!missing?.missingFifa?.length) return true;
  const haystack = normalize(decodeURIComponent(url));
  return missing.missingFifa.some((item) => {
    const fixture = normalize(item.fixture_key);
    const home = normalize(item.home_team_name);
    const away = normalize(item.away_team_name);
    return (fixture && fixture.split(' ').some((part) => part.length >= 3 && haystack.includes(part))) || (home && haystack.includes(home)) || (away && haystack.includes(away));
  });
}

async function importOne(origin: string, pdfUrl: string, dryRun: boolean): Promise<ImportResult> {
  try {
    const response = await fetch(`${origin}/api/world-cup/import-fifa-pmsr`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pdfUrl, dryRun }),
      cache: 'no-store',
    });
    let payload: unknown = null;
    try { payload = await response.json(); } catch { payload = await response.text(); }
    return { url: pdfUrl, ok: response.ok, status: response.status, payload };
  } catch (error) {
    return { url: pdfUrl, ok: false, status: 0, error: error instanceof Error ? error.message : 'Erro ao importar PDF.' };
  }
}

async function runSync(request: NextRequest, body: SyncBody) {
  const hubUrl = body.hubUrl ?? HUB_URL;
  const dryRun = body.dryRun !== false;
  const limit = Math.max(1, Math.min(Number(body.limit ?? 10), 50));
  const origin = request.nextUrl.origin;

  const hubResponse = await fetch(hubUrl, { cache: 'no-store' });
  if (!hubResponse.ok) {
    return NextResponse.json({ success: false, error: `Falha ao acessar hub FIFA: HTTP ${hubResponse.status}`, hubUrl }, { status: 502 });
  }

  const html = await hubResponse.text();
  const discovered = extractPmsrLinks(html);
  const missing = body.onlyMissing === false ? null : await fetchMissingFifa(origin);
  const selected = discovered.filter((url) => maybeRelevantToMissing(url, missing)).slice(0, limit);

  const results: ImportResult[] = [];
  for (const pdfUrl of selected) {
    results.push(await importOne(origin, pdfUrl, dryRun));
  }

  return NextResponse.json({
    success: true,
    dryRun,
    scope: 'Somente Copa do Mundo 2026. Não altera tabelas ou endpoints de outros campeonatos.',
    hubUrl,
    discoveredCount: discovered.length,
    selectedCount: selected.length,
    importedOk: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    selected,
    results,
    missingSummary: missing ? { missingFifa: missing.missingFifa?.length ?? 0 } : null,
    lastUpdated: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return runSync(request, {
    dryRun: params.get('dryRun') !== 'false',
    limit: Number(params.get('limit') ?? 10),
    onlyMissing: params.get('onlyMissing') !== 'false',
    hubUrl: params.get('hubUrl') ?? undefined,
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as SyncBody;
  return runSync(request, body);
}
