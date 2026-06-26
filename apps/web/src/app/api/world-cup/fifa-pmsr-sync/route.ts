import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const HUB_URL = 'https://www.fifatrainingcentre.com/en/fifa-world-cup-2026/match-report-hub.php';
const FIFA_ORIGIN = 'https://www.fifatrainingcentre.com';
const PMSR_BASE = 'https://www.fifatrainingcentre.com/media/native/tournaments/fifa-world-cup/2026';

type SyncBody = {
  dryRun?: boolean;
  limit?: number;
  hubUrl?: string;
  onlyMissing?: boolean;
  mode?: 'hub' | 'backfill' | 'both';
  maxMatchNumber?: number;
  minMatchNumber?: number;
};

type MissingMatch = {
  id?: string | number;
  fixture_key?: string;
  home_team_name?: string;
  away_team_name?: string;
};

type ImportResult = {
  url: string;
  ok: boolean;
  status: number;
  payload?: unknown;
  error?: string;
  missingMatch?: MissingMatch;
};

const CODE_BY_TEAM: Record<string, string[]> = {
  brazil: ['BRA'], brasil: ['BRA'],
  scotland: ['SCO'], escocia: ['SCO'],
  czechia: ['CZE'], tchequia: ['CZE'], 'czech republic': ['CZE'],
  mexico: ['MEX'],
  'south africa': ['RSA', 'ZAF'], 'africa do sul': ['RSA', 'ZAF'],
  'korea republic': ['KOR'], 'coreia do sul': ['KOR'], 'south korea': ['KOR'],
  morocco: ['MAR'], marrocos: ['MAR'],
  haiti: ['HAI'],
  switzerland: ['SUI'], suica: ['SUI'],
  canada: ['CAN'],
  usa: ['USA'], eua: ['USA'], 'united states': ['USA'],
  turkiye: ['TUR'], turkey: ['TUR'], turquia: ['TUR'],
  paraguay: ['PAR'], paraguai: ['PAR'],
  australia: ['AUS'],
  france: ['FRA'], franca: ['FRA'],
  norway: ['NOR'], noruega: ['NOR'],
  senegal: ['SEN'],
  iraq: ['IRQ'], iraque: ['IRQ'],
  uruguay: ['URU'], uruguai: ['URU'],
  'cape verde islands': ['CPV'], 'cabo verde': ['CPV'], 'cape verde': ['CPV'],
  belgium: ['BEL'], belgica: ['BEL'],
  'ir iran': ['IRN'], iran: ['IRN'], ira: ['IRN'],
  spain: ['ESP'], espanha: ['ESP'],
  'saudi arabia': ['KSA'], 'arabia saudita': ['KSA'],
  tunisia: ['TUN'],
  japan: ['JPN'], japao: ['JPN'],
  ecuador: ['ECU'], equador: ['ECU'],
  curacao: ['CUW'], curacau: ['CUW'],
  germany: ['GER'], alemanha: ['GER'],
  "cote d'ivoire": ['CIV'], 'cote d ivoire': ['CIV'], 'ivory coast': ['CIV'], 'costa do marfim': ['CIV'],
  netherlands: ['NED'], holanda: ['NED'],
  sweden: ['SWE'], suecia: ['SWE'],
  england: ['ENG'], inglaterra: ['ENG'],
  ghana: ['GHA'], gana: ['GHA'],
  panama: ['PAN'],
  croatia: ['CRO'], croacia: ['CRO'],
  portugal: ['POR'],
  uzbekistan: ['UZB'], uzbequistao: ['UZB'],
  colombia: ['COL'],
  'congo dr': ['COD'], 'rd congo': ['COD'], 'dr congo': ['COD'],
  argentina: ['ARG'],
  austria: ['AUT'],
  jordan: ['JOR'], jordania: ['JOR'],
  algeria: ['ALG'], argelia: ['ALG'],
  qatar: ['QAT'], catar: ['QAT'],
  'bosnia and herzegovina': ['BIH'], 'bosnia e herzegovina': ['BIH'], bosnia: ['BIH'],
  egypt: ['EGY'], egito: ['EGY'],
  'new zealand': ['NZL'], 'nova zelandia': ['NZL'],
};

function absoluteUrl(href: string) {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/')) return `${FIFA_ORIGIN}${href}`;
  return `${FIFA_ORIGIN}/${href.replace(/^\.\//, '')}`;
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function normalize(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
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
    return (await response.json()) as { missingFifa?: MissingMatch[]; missingAllStats?: MissingMatch[] };
  } catch {
    return null;
  }
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

function codesForTeam(teamName?: string) {
  const key = normalize(teamName);
  const codes = CODE_BY_TEAM[key];
  if (codes?.length) return codes;
  return [];
}

function buildCandidateUrls(match: MissingMatch, minMatchNumber: number, maxMatchNumber: number) {
  const homeCodes = codesForTeam(match.home_team_name);
  const awayCodes = codesForTeam(match.away_team_name);
  const urls: string[] = [];
  if (!homeCodes.length || !awayCodes.length) return urls;
  for (let number = minMatchNumber; number <= maxMatchNumber; number += 1) {
    for (const home of homeCodes) {
      for (const away of awayCodes) {
        urls.push(`${PMSR_BASE}/PMSR-M${number}-${home}-V-${away}.pdf`);
        urls.push(`${PMSR_BASE}/PMSR-M${number}-${away}-V-${home}.pdf`);
      }
    }
  }
  return unique(urls);
}

async function urlExists(url: string) {
  try {
    let response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (response.ok) return true;
    if ([403, 405].includes(response.status)) {
      response = await fetch(url, { method: 'GET', headers: { range: 'bytes=0-64' }, cache: 'no-store' });
      return response.ok || response.status === 206;
    }
    return false;
  } catch {
    return false;
  }
}

async function importOne(origin: string, pdfUrl: string, dryRun: boolean, missingMatch?: MissingMatch): Promise<ImportResult> {
  try {
    const response = await fetch(`${origin}/api/world-cup/import-fifa-pmsr`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pdfUrl, dryRun }),
      cache: 'no-store',
    });
    let payload: unknown = null;
    try { payload = await response.json(); } catch { payload = await response.text(); }
    return { url: pdfUrl, ok: response.ok, status: response.status, payload, missingMatch };
  } catch (error) {
    return { url: pdfUrl, ok: false, status: 0, error: error instanceof Error ? error.message : 'Erro ao importar PDF.', missingMatch };
  }
}

async function discoverFromHub(hubUrl: string, missing: Awaited<ReturnType<typeof fetchMissingFifa>>, limit: number) {
  const hubResponse = await fetch(hubUrl, { cache: 'no-store' });
  if (!hubResponse.ok) return { hubError: `HTTP ${hubResponse.status}`, discovered: [], selected: [] };
  const html = await hubResponse.text();
  const discovered = extractPmsrLinks(html);
  const selected = discovered.filter((url) => maybeRelevantToMissing(url, missing)).slice(0, limit);
  return { hubError: null, discovered, selected };
}

async function discoverByBackfill(missing: Awaited<ReturnType<typeof fetchMissingFifa>>, limit: number, minMatchNumber: number, maxMatchNumber: number) {
  const missingMatches = missing?.missingFifa ?? [];
  const found: Array<{ url: string; missingMatch: MissingMatch }> = [];
  for (const match of missingMatches) {
    const candidates = buildCandidateUrls(match, minMatchNumber, maxMatchNumber);
    for (const url of candidates) {
      if (found.length >= limit) return found;
      if (await urlExists(url)) {
        found.push({ url, missingMatch: match });
        break;
      }
    }
  }
  return found;
}

async function runSync(request: NextRequest, body: SyncBody) {
  const hubUrl = body.hubUrl ?? HUB_URL;
  const dryRun = body.dryRun !== false;
  const limit = Math.max(1, Math.min(Number(body.limit ?? 10), 50));
  const mode = body.mode ?? 'both';
  const minMatchNumber = Math.max(1, Math.min(Number(body.minMatchNumber ?? 1), 104));
  const maxMatchNumber = Math.max(minMatchNumber, Math.min(Number(body.maxMatchNumber ?? 104), 104));
  const origin = request.nextUrl.origin;
  const missing = body.onlyMissing === false ? null : await fetchMissingFifa(origin);

  const selected: Array<{ url: string; missingMatch?: MissingMatch; source: 'hub' | 'backfill' }> = [];
  let hubDiscoveredCount = 0;
  let hubError: string | null = null;

  if (mode === 'hub' || mode === 'both') {
    const hub = await discoverFromHub(hubUrl, missing, limit);
    hubDiscoveredCount = hub.discovered.length;
    hubError = hub.hubError;
    selected.push(...hub.selected.map((url) => ({ url, source: 'hub' as const })));
  }

  if ((mode === 'backfill' || mode === 'both') && selected.length < limit) {
    const backfill = await discoverByBackfill(missing, limit - selected.length, minMatchNumber, maxMatchNumber);
    selected.push(...backfill.map((item) => ({ url: item.url, missingMatch: item.missingMatch, source: 'backfill' as const })));
  }

  const deduped = Array.from(new Map(selected.map((item) => [item.url, item])).values()).slice(0, limit);
  const results: ImportResult[] = [];
  for (const item of deduped) results.push(await importOne(origin, item.url, dryRun, item.missingMatch));

  return NextResponse.json({
    success: true,
    dryRun,
    mode,
    scope: 'Somente Copa do Mundo 2026. Não altera tabelas ou endpoints de outros campeonatos.',
    hubUrl,
    hubError,
    hubDiscoveredCount,
    selectedCount: deduped.length,
    importedOk: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    searchWindow: { minMatchNumber, maxMatchNumber },
    selected: deduped,
    results,
    missingSummary: missing ? { missingFifa: missing.missingFifa?.length ?? 0, missingAllStats: missing.missingAllStats?.length ?? 0 } : null,
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
    mode: (params.get('mode') as SyncBody['mode']) ?? 'both',
    minMatchNumber: Number(params.get('minMatchNumber') ?? 1),
    maxMatchNumber: Number(params.get('maxMatchNumber') ?? 104),
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as SyncBody;
  return runSync(request, body);
}
