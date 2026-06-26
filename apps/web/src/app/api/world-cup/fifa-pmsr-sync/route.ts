import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';

const HUB_URL = 'https://www.fifatrainingcentre.com/en/fifa-world-cup-2026/match-report-hub.php';
const FIFA_ORIGIN = 'https://www.fifatrainingcentre.com';
const PMSR_BASE = 'https://www.fifatrainingcentre.com/media/native/tournaments/fifa-world-cup/2026';
const WORLD_CUP_2026_KEY = 'world_cup_2026';

type SyncBody = {
  dryRun?: boolean;
  limit?: number | string;
  hubUrl?: string;
  onlyMissing?: boolean;
  mode?: 'hub' | 'backfill' | 'both';
  maxMatchNumber?: number;
  minMatchNumber?: number;
  all?: boolean;
  force?: boolean;
};

type MissingMatch = { id?: string | number; fixture_key?: string; home_team_name?: string; away_team_name?: string };
type ImportResult = { url: string; ok: boolean; status: number; payload?: unknown; error?: string; missingMatch?: MissingMatch; skipped?: boolean; source?: 'hub' | 'backfill' };

const CODE_BY_TEAM: Record<string, string[]> = {
  brazil: ['BRA'], brasil: ['BRA'], scotland: ['SCO'], escocia: ['SCO'], czechia: ['CZE'], tchequia: ['CZE'], 'czech republic': ['CZE'], mexico: ['MEX'],
  'south africa': ['RSA', 'ZAF'], 'africa do sul': ['RSA', 'ZAF'], 'korea republic': ['KOR'], 'coreia do sul': ['KOR'], 'south korea': ['KOR'], morocco: ['MAR'], marrocos: ['MAR'], haiti: ['HAI'],
  switzerland: ['SUI'], suica: ['SUI'], canada: ['CAN'], usa: ['USA'], eua: ['USA'], 'united states': ['USA'], turkiye: ['TUR'], turkey: ['TUR'], turquia: ['TUR'],
  paraguay: ['PAR'], paraguai: ['PAR'], australia: ['AUS'], france: ['FRA'], franca: ['FRA'], norway: ['NOR'], noruega: ['NOR'], senegal: ['SEN'], iraq: ['IRQ'], iraque: ['IRQ'],
  uruguay: ['URU'], uruguai: ['URU'], 'cape verde islands': ['CPV'], 'cabo verde': ['CPV'], 'cape verde': ['CPV'], belgium: ['BEL'], belgica: ['BEL'], 'ir iran': ['IRN'], iran: ['IRN'], ira: ['IRN'],
  spain: ['ESP'], espanha: ['ESP'], 'saudi arabia': ['KSA'], 'arabia saudita': ['KSA'], tunisia: ['TUN'], japan: ['JPN'], japao: ['JPN'], ecuador: ['ECU'], equador: ['ECU'], curacao: ['CUW'], curacau: ['CUW'],
  germany: ['GER'], alemanha: ['GER'], "cote d'ivoire": ['CIV'], 'cote d ivoire': ['CIV'], 'ivory coast': ['CIV'], 'costa do marfim': ['CIV'], netherlands: ['NED'], holanda: ['NED'],
  sweden: ['SWE'], suecia: ['SWE'], england: ['ENG'], inglaterra: ['ENG'], ghana: ['GHA'], gana: ['GHA'], panama: ['PAN'], croatia: ['CRO'], croacia: ['CRO'], portugal: ['POR'],
  uzbekistan: ['UZB'], uzbequistao: ['UZB'], colombia: ['COL'], 'congo dr': ['COD'], 'rd congo': ['COD'], 'dr congo': ['COD'], argentina: ['ARG'], austria: ['AUT'],
  jordan: ['JOR'], jordania: ['JOR'], algeria: ['ALG'], argelia: ['ALG'], qatar: ['QAT'], catar: ['QAT'], 'bosnia and herzegovina': ['BIH'], 'bosnia e herzegovina': ['BIH'], bosnia: ['BIH'], egypt: ['EGY'], egito: ['EGY'], 'new zealand': ['NZL'], 'nova zelandia': ['NZL'],
};

function absoluteUrl(href: string) { if (/^https?:\/\//i.test(href)) return href; if (href.startsWith('/')) return `${FIFA_ORIGIN}${href}`; return `${FIFA_ORIGIN}/${href.replace(/^\.\//, '')}`; }
function unique<T>(items: T[]) { return Array.from(new Set(items)); }
function normalize(value: unknown) { return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function pdfKey(url: string) { return decodeURIComponent(url.split('/').pop() ?? url).replace(/\.pdf(?:\?.*)?$/i, '').toUpperCase(); }
function extractPmsrLinks(html: string) {
  const links: string[] = [];
  const hrefRegex = /href=["']([^"']+PMSR[^"']+\.pdf)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html))) links.push(absoluteUrl(match[1]));
  const rawPdfRegex = /(https?:\/\/[^\s"'<>]+PMSR[^\s"'<>]+\.pdf|\/media\/[^\s"'<>]+PMSR[^\s"'<>]+\.pdf)/gi;
  while ((match = rawPdfRegex.exec(html))) links.push(absoluteUrl(match[1]));
  return unique(links).filter((url) => /PMSR/i.test(url) && /\.pdf($|\?)/i.test(url));
}

async function ensureImportLogTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS world_cup_pmsr_import_log (
      id SERIAL PRIMARY KEY,
      competition_key TEXT NOT NULL DEFAULT 'world_cup_2026',
      pdf_url TEXT NOT NULL,
      pdf_key TEXT NOT NULL,
      status TEXT NOT NULL,
      http_status INTEGER,
      saved_values INTEGER DEFAULT 0,
      metrics_count INTEGER DEFAULT 0,
      dry_run BOOLEAN DEFAULT false,
      source TEXT,
      error_message TEXT,
      payload JSONB,
      imported_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_world_cup_pmsr_log_key ON world_cup_pmsr_import_log (competition_key, pdf_key)`;
}

async function alreadyImportedMap() {
  await ensureImportLogTable();
  const rows = await sql`
    SELECT DISTINCT ON (pdf_key) pdf_key, status, saved_values, metrics_count, imported_at
    FROM world_cup_pmsr_import_log
    WHERE competition_key = ${WORLD_CUP_2026_KEY} AND dry_run = false
    ORDER BY pdf_key, imported_at DESC
  `;
  return new Map(rows.map((row: any) => [String(row.pdf_key), row]));
}

async function recordLog(result: ImportResult, dryRun: boolean) {
  if (result.skipped) return;
  await ensureImportLogTable();
  const payload: any = result.payload ?? {};
  const status = result.ok ? 'success' : 'failed';
  const metricsCount = Array.isArray(payload.extractedStats) ? payload.extractedStats.length : 0;
  const savedValues = Number(payload.savedValues ?? 0);
  const errorMessage = result.error ?? payload.error ?? payload.warning ?? null;
  await sql`
    INSERT INTO world_cup_pmsr_import_log (competition_key, pdf_url, pdf_key, status, http_status, saved_values, metrics_count, dry_run, source, error_message, payload, imported_at, updated_at)
    VALUES (${WORLD_CUP_2026_KEY}, ${result.url}, ${pdfKey(result.url)}, ${status}, ${result.status}, ${savedValues}, ${metricsCount}, ${dryRun}, ${result.source ?? null}, ${errorMessage}, ${JSON.stringify(payload)}::jsonb, NOW(), NOW())
  `;
}

async function fetchMissingFifa(origin: string) {
  try { const response = await fetch(`${origin}/api/world-cup/fifa-missing-stats`, { cache: 'no-store' }); if (!response.ok) return null; return (await response.json()) as { missingFifa?: MissingMatch[]; missingAllStats?: MissingMatch[] }; } catch { return null; }
}

function maybeRelevantToMissing(url: string, missing: Awaited<ReturnType<typeof fetchMissingFifa>>) {
  if (!missing?.missingFifa?.length) return true;
  const haystack = normalize(decodeURIComponent(url));
  return missing.missingFifa.some((item) => {
    const fixture = normalize(item.fixture_key); const home = normalize(item.home_team_name); const away = normalize(item.away_team_name);
    return (fixture && fixture.split(' ').some((part) => part.length >= 3 && haystack.includes(part))) || (home && haystack.includes(home)) || (away && haystack.includes(away));
  });
}

function codesForTeam(teamName?: string) { return CODE_BY_TEAM[normalize(teamName)] ?? []; }
function buildCandidateUrls(match: MissingMatch, minMatchNumber: number, maxMatchNumber: number) {
  const homeCodes = codesForTeam(match.home_team_name); const awayCodes = codesForTeam(match.away_team_name); const urls: string[] = [];
  if (!homeCodes.length || !awayCodes.length) return urls;
  for (let number = minMatchNumber; number <= maxMatchNumber; number += 1) for (const home of homeCodes) for (const away of awayCodes) { urls.push(`${PMSR_BASE}/PMSR-M${number}-${home}-V-${away}.pdf`); urls.push(`${PMSR_BASE}/PMSR-M${number}-${away}-V-${home}.pdf`); }
  return unique(urls);
}

async function urlExists(url: string) {
  try { let response = await fetch(url, { method: 'HEAD', cache: 'no-store' }); if (response.ok) return true; if ([403, 405].includes(response.status)) { response = await fetch(url, { method: 'GET', headers: { range: 'bytes=0-64' }, cache: 'no-store' }); return response.ok || response.status === 206; } return false; } catch { return false; }
}

async function importOne(origin: string, pdfUrl: string, dryRun: boolean, source: 'hub' | 'backfill', missingMatch?: MissingMatch): Promise<ImportResult> {
  try {
    const response = await fetch(`${origin}/api/world-cup/import-fifa-pmsr-safe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pdfUrl, dryRun }), cache: 'no-store' });
    let payload: unknown = null; try { payload = await response.json(); } catch { payload = await response.text(); }
    return { url: pdfUrl, ok: response.ok, status: response.status, payload, missingMatch, source };
  } catch (error) { return { url: pdfUrl, ok: false, status: 0, error: error instanceof Error ? error.message : 'Erro ao importar PDF.', missingMatch, source }; }
}

async function discoverFromHub(hubUrl: string, missing: Awaited<ReturnType<typeof fetchMissingFifa>>, limit: number, includeAll: boolean) {
  const hubResponse = await fetch(hubUrl, { cache: 'no-store' });
  if (!hubResponse.ok) return { hubError: `HTTP ${hubResponse.status}`, discovered: [], selected: [] };
  const html = await hubResponse.text();
  const discovered = extractPmsrLinks(html);
  const pool = includeAll ? discovered : discovered.filter((url) => maybeRelevantToMissing(url, missing));
  return { hubError: null, discovered, selected: pool.slice(0, limit) };
}

async function discoverByBackfill(missing: Awaited<ReturnType<typeof fetchMissingFifa>>, limit: number, minMatchNumber: number, maxMatchNumber: number) {
  const missingMatches = missing?.missingFifa ?? []; const found: Array<{ url: string; missingMatch: MissingMatch }> = [];
  for (const match of missingMatches) {
    const candidates = buildCandidateUrls(match, minMatchNumber, maxMatchNumber);
    for (const url of candidates) { if (found.length >= limit) return found; if (await urlExists(url)) { found.push({ url, missingMatch: match }); break; } }
  }
  return found;
}

function readLimit(value: SyncBody['limit'], all: boolean) {
  if (all || String(value).toLowerCase() === 'all') return 104;
  return Math.max(1, Math.min(Number(value ?? 20), 104));
}

async function runSync(request: NextRequest, body: SyncBody) {
  const hubUrl = body.hubUrl ?? HUB_URL;
  const dryRun = body.dryRun !== false;
  const all = body.all === true || String(body.limit).toLowerCase() === 'all';
  const force = body.force === true;
  const limit = readLimit(body.limit, all);
  const mode = body.mode ?? 'both';
  const minMatchNumber = Math.max(1, Math.min(Number(body.minMatchNumber ?? 1), 104));
  const maxMatchNumber = Math.max(minMatchNumber, Math.min(Number(body.maxMatchNumber ?? 104), 104));
  const origin = request.nextUrl.origin;
  const includeAllHub = all || body.onlyMissing === false;
  const missing = body.onlyMissing === false ? null : await fetchMissingFifa(origin);
  const importedMap = dryRun || force ? new Map() : await alreadyImportedMap();

  const selected: Array<{ url: string; missingMatch?: MissingMatch; source: 'hub' | 'backfill' }> = [];
  let hubDiscoveredCount = 0; let hubError: string | null = null;

  if (mode === 'hub' || mode === 'both') {
    const hub = await discoverFromHub(hubUrl, missing, limit, includeAllHub);
    hubDiscoveredCount = hub.discovered.length; hubError = hub.hubError;
    selected.push(...hub.selected.map((url) => ({ url, source: 'hub' as const })));
  }
  if ((mode === 'backfill' || mode === 'both') && selected.length < limit) {
    const backfill = await discoverByBackfill(missing, limit - selected.length, minMatchNumber, maxMatchNumber);
    selected.push(...backfill.map((item) => ({ url: item.url, missingMatch: item.missingMatch, source: 'backfill' as const })));
  }

  const deduped = Array.from(new Map(selected.map((item) => [item.url, item])).values()).slice(0, limit);
  const results: ImportResult[] = [];
  for (const item of deduped) {
    const previous = importedMap.get(pdfKey(item.url));
    if (previous?.status === 'success' && Number(previous.saved_values ?? 0) > 0) {
      results.push({ url: item.url, ok: true, status: 200, skipped: true, source: item.source, payload: { skipped: true, reason: 'already_imported', previous } });
      continue;
    }
    const result = await importOne(origin, item.url, dryRun, item.source, item.missingMatch);
    await recordLog(result, dryRun);
    results.push(result);
  }

  return NextResponse.json({
    success: true, dryRun, all, force, mode,
    scope: 'Somente Copa do Mundo 2026. Não altera tabelas ou endpoints de outros campeonatos.',
    hubUrl, hubError, hubDiscoveredCount, selectedCount: deduped.length,
    importedOk: results.filter((result) => result.ok && !result.skipped).length,
    skipped: results.filter((result) => result.skipped).length,
    failed: results.filter((result) => !result.ok).length,
    totalSavedValues: results.reduce((sum, result: any) => sum + Number(result.payload?.savedValues ?? 0), 0),
    searchWindow: { minMatchNumber, maxMatchNumber }, selected: deduped, results,
    missingSummary: missing ? { missingFifa: missing.missingFifa?.length ?? 0, missingAllStats: missing.missingAllStats?.length ?? 0 } : null,
    lastUpdated: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return runSync(request, {
    dryRun: params.get('dryRun') !== 'false', limit: params.get('limit') ?? undefined,
    onlyMissing: params.get('onlyMissing') !== 'false', hubUrl: params.get('hubUrl') ?? undefined,
    mode: (params.get('mode') as SyncBody['mode']) ?? 'both', minMatchNumber: Number(params.get('minMatchNumber') ?? 1), maxMatchNumber: Number(params.get('maxMatchNumber') ?? 104),
    all: params.get('all') === 'true', force: params.get('force') === 'true',
  });
}

export async function POST(request: NextRequest) { const body = (await request.json().catch(() => ({}))) as SyncBody; return runSync(request, body); }
