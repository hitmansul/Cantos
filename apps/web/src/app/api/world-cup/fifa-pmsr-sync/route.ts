import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';

const REPORT_HUB_URL = 'https://www.fifatrainingcentre.com/en/fifa-world-cup-2026/match-report-hub.php';
const FIFA_STATS_PAGE_URL = 'https://www.fifa.com/pt/tournaments/mens/worldcup/canadamexicousa2026/statistics';
const FIFA_ORIGIN = 'https://www.fifatrainingcentre.com';
const FIFA_COM_ORIGIN = 'https://www.fifa.com';
const PMSR_BASE = 'https://www.fifatrainingcentre.com/media/native/tournaments/fifa-world-cup/2026';
const WORLD_CUP_2026_KEY = 'world_cup_2026';

type SyncBody = { dryRun?: boolean; limit?: number | string; hubUrl?: string; statisticsUrl?: string; onlyMissing?: boolean; mode?: 'hub' | 'backfill' | 'both'; maxMatchNumber?: number; minMatchNumber?: number; all?: boolean; force?: boolean; forceMissing?: boolean };
type MissingMatch = { id?: string | number; fixture_key?: string; fifa_match_id?: string | null; home_team_name?: string; away_team_name?: string; kickoff_at?: string | null; status?: string | null; fifa_stats?: number; total_stats?: number };
type ImportResult = { url: string; ok: boolean; status: number; payload?: any; error?: string; missingMatch?: MissingMatch; skipped?: boolean; source?: 'hub' | 'backfill' | 'statistics' | 'missing-retry' };
type Candidate = { url: string; missingMatch?: MissingMatch; source: ImportResult['source']; retryEvenIfImported?: boolean };

const CODE_BY_TEAM: Record<string, string[]> = {
  brazil:['BRA'], brasil:['BRA'], japan:['JPN'], japao:['JPN'], "cote d'ivoire":['CIV'], 'cote d ivoire':['CIV'], 'ivory coast':['CIV'], 'costa do marfim':['CIV'], norway:['NOR'], noruega:['NOR'], france:['FRA'], franca:['FRA'], sweden:['SWE'], suecia:['SWE'], mexico:['MEX'], ecuador:['ECU'], equador:['ECU'], england:['ENG'], inglaterra:['ENG'], 'congo dr':['COD'], 'rd congo':['COD'], 'dr congo':['COD'], belgium:['BEL'], belgica:['BEL'], senegal:['SEN'], usa:['USA'], eua:['USA'], 'united states':['USA'], 'bosnia and herzegovina':['BIH'], 'bosnia e herzegovina':['BIH'], bosnia:['BIH'], spain:['ESP'], espanha:['ESP'], austria:['AUT'], portugal:['POR'], croatia:['CRO'], croacia:['CRO'], switzerland:['SUI'], suica:['SUI'], algeria:['ALG'], argelia:['ALG'], australia:['AUS'], egypt:['EGY'], egito:['EGY'], argentina:['ARG'], 'cape verde islands':['CPV'], 'cape verde':['CPV'], 'cabo verde':['CPV'], colombia:['COL'], ghana:['GHA'], gana:['GHA'], canada:['CAN'], morocco:['MAR'], marrocos:['MAR'], netherlands:['NED'], holanda:['NED'], germany:['GER'], alemanha:['GER'], paraguay:['PAR'], paraguai:['PAR'],
  czechia:['CZE'], tchequia:['CZE'], 'czech republic':['CZE'], 'south africa':['RSA','ZAF'], 'africa do sul':['RSA','ZAF'], 'korea republic':['KOR'], 'coreia do sul':['KOR'], 'south korea':['KOR'], qatar:['QAT'], catar:['QAT'], haiti:['HAI'], turkiye:['TUR'], turkey:['TUR'], turquia:['TUR'], iraq:['IRQ'], iraque:['IRQ'], uruguay:['URU'], uruguai:['URU'], 'saudi arabia':['KSA'], 'arabia saudita':['KSA'], 'ir iran':['IRN'], iran:['IRN'], ira:['IRN'], 'new zealand':['NZL'], 'nova zelandia':['NZL'], panama:['PAN'], uzbekistan:['UZB'], uzbequistao:['UZB'], jordan:['JOR'], jordania:['JOR'], tunisia:['TUN'], curacao:['CUW'], curacau:['CUW'], scotland:['SCO'], escocia:['SCO']
};

function absoluteUrl(href: string) { if (/^https?:\/\//i.test(href)) return href; if (href.startsWith('/media/')) return `${FIFA_ORIGIN}${href}`; if (href.startsWith('/')) return `${FIFA_COM_ORIGIN}${href}`; return `${FIFA_ORIGIN}/${href.replace(/^\.\//, '')}`; }
function unique<T>(items: T[]) { return Array.from(new Set(items)); }
function normalize(value: unknown) { return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function pdfKey(url: string) { return decodeURIComponent(url.split('/').pop() ?? url).replace(/\.pdf(?:\?.*)?$/i, '').toUpperCase().trim(); }
function matchNumberFromUrl(url: string) { return Number(decodeURIComponent(url).match(/PMSR[-_ ]*M(\d+)/i)?.[1] ?? 9999); }
function byMatchNumber(a: Candidate, b: Candidate) { return matchNumberFromUrl(a.url) - matchNumberFromUrl(b.url) || a.url.localeCompare(b.url); }
function matchNumberFromRow(row: MissingMatch) { const raw = row.fifa_match_id ?? row.fixture_key ?? ''; const m = String(raw).match(/(?:^|[^0-9])M?(\d{1,3})(?:[^0-9]|$)/i); return m ? Number(m[1]) : null; }
function codesForTeam(teamName?: string) { return CODE_BY_TEAM[normalize(teamName)] ?? []; }

function extractPmsrLinks(html: string) {
  const decoded = html.replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const links: string[] = [];
  let match: RegExpExecArray | null;
  const hrefRegex = /href=["']([^"']+PMSR[^"']+\.pdf(?:\?[^"']*)?)["']/gi;
  while ((match = hrefRegex.exec(decoded))) links.push(absoluteUrl(match[1]));
  const rawPdfRegex = /(https?:\/\/[^\s"'<>]+PMSR[^\s"'<>]+\.pdf(?:\?[^\s"'<>]*)?|\/media\/[^\s"'<>]+PMSR[^\s"'<>]+\.pdf(?:\?[^\s"'<>]*)?)/gi;
  while ((match = rawPdfRegex.exec(decoded))) links.push(absoluteUrl(match[1]));
  return unique(links).filter((url) => /PMSR/i.test(url) && /\.pdf($|\?)/i.test(url));
}
function extractMatchReportHints(html: string) { const decoded = html.replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/&quot;/g, '"'); const hints: string[] = []; let match: RegExpExecArray | null; const reportRegex = /(https?:\/\/[^\s"'<>]+match-report[^\s"'<>]*|\/[^\s"'<>]+match-report[^\s"'<>]*)/gi; while ((match = reportRegex.exec(decoded))) hints.push(absoluteUrl(match[1])); return unique(hints); }

async function ensureImportLogTable() {
  await sql`CREATE TABLE IF NOT EXISTS world_cup_pmsr_import_log (id SERIAL PRIMARY KEY, competition_key TEXT NOT NULL DEFAULT 'world_cup_2026', pdf_url TEXT NOT NULL, pdf_key TEXT NOT NULL, status TEXT NOT NULL, http_status INTEGER, saved_values INTEGER DEFAULT 0, metrics_count INTEGER DEFAULT 0, dry_run BOOLEAN DEFAULT false, source TEXT, error_message TEXT, payload JSONB, imported_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE INDEX IF NOT EXISTS idx_world_cup_pmsr_log_key ON world_cup_pmsr_import_log (competition_key, pdf_key)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_world_cup_pmsr_log_status ON world_cup_pmsr_import_log (competition_key, dry_run, status, imported_at DESC)`;
}
async function alreadyImportedMap() { await ensureImportLogTable(); const rows = await sql`SELECT DISTINCT ON (pdf_key) pdf_key, status, saved_values, metrics_count, imported_at, pdf_url FROM world_cup_pmsr_import_log WHERE competition_key = ${WORLD_CUP_2026_KEY} AND dry_run = false ORDER BY pdf_key, imported_at DESC`; return new Map(rows.map((row: any) => [String(row.pdf_key), row])); }
async function recordLog(result: ImportResult, dryRun: boolean) { if (result.skipped) return; await ensureImportLogTable(); const payload: any = result.payload ?? {}; const status = result.ok ? 'success' : 'failed'; const metricsCount = Array.isArray(payload.extractedStats) ? payload.extractedStats.length : 0; const savedValues = Number(payload.savedValues ?? 0); const errorMessage = result.error ?? payload.error ?? payload.warning ?? null; await sql`INSERT INTO world_cup_pmsr_import_log (competition_key, pdf_url, pdf_key, status, http_status, saved_values, metrics_count, dry_run, source, error_message, payload, imported_at, updated_at) VALUES (${WORLD_CUP_2026_KEY}, ${result.url}, ${pdfKey(result.url)}, ${status}, ${result.status}, ${savedValues}, ${metricsCount}, ${dryRun}, ${result.source ?? null}, ${errorMessage}, ${JSON.stringify(payload)}::jsonb, NOW(), NOW())`; }

async function fetchMissingFromDb() {
  const rows = (await sql`
    SELECT m.id, m.fixture_key, m.fifa_match_id, m.home_team_name, m.away_team_name, m.kickoff_at, m.status, COUNT(ms.id)::int AS total_stats, COUNT(ms.id) FILTER (WHERE ms.source_key = 'fifa')::int AS fifa_stats
    FROM world_cup_matches m
    LEFT JOIN world_cup_match_statistics ms ON ms.match_id = m.id
    WHERE m.competition_key = ${WORLD_CUP_2026_KEY}
      AND (m.status ILIKE '%fim%' OR m.status ILIKE '%final%' OR m.status ILIKE '%finished%' OR m.home_score IS NOT NULL OR m.away_score IS NOT NULL)
    GROUP BY m.id
    HAVING COUNT(ms.id) FILTER (WHERE ms.source_key = 'fifa') = 0
    ORDER BY m.kickoff_at NULLS LAST, m.id
    LIMIT 80
  `) as MissingMatch[];
  return rows;
}
function candidateUrlsFor(match: MissingMatch, minMatchNumber: number, maxMatchNumber: number) {
  const homeCodes = codesForTeam(match.home_team_name); const awayCodes = codesForTeam(match.away_team_name); const urls: string[] = []; if (!homeCodes.length || !awayCodes.length) return urls;
  const knownNumber = matchNumberFromRow(match);
  const numbers = knownNumber ? [knownNumber] : Array.from({ length: maxMatchNumber - minMatchNumber + 1 }, (_, i) => i + minMatchNumber);
  for (const number of numbers) for (const home of homeCodes) for (const away of awayCodes) {
    const mm = String(number).padStart(2, '0');
    urls.push(`${PMSR_BASE}/PMSR-M${mm}-${home}-V-${away}.pdf`, `${PMSR_BASE}/PMSR-M${mm} ${home} V ${away}.pdf`, `${PMSR_BASE}/PMSR-M${mm}-${away}-V-${home}.pdf`, `${PMSR_BASE}/PMSR-M${mm} ${away} V ${home}.pdf`);
  }
  return unique(urls);
}
async function urlExists(url: string) { try { let response = await fetch(url, { method: 'HEAD', cache: 'no-store' }); if (response.ok) return true; if ([403, 405].includes(response.status)) { response = await fetch(url, { method: 'GET', headers: { range: 'bytes=0-128' }, cache: 'no-store' }); return response.ok || response.status === 206; } return false; } catch { return false; } }
async function discoverByMissing(limit: number, minMatchNumber: number, maxMatchNumber: number) { const missing = await fetchMissingFromDb(); const found: Candidate[] = []; for (const match of missing) { for (const url of candidateUrlsFor(match, minMatchNumber, maxMatchNumber)) { if (found.length >= limit) return { found, missing }; if (await urlExists(url)) { found.push({ url, missingMatch: match, source: 'missing-retry', retryEvenIfImported: true }); break; } } } return { found, missing }; }
async function importOne(origin: string, pdfUrl: string, dryRun: boolean, source: ImportResult['source'], missingMatch?: MissingMatch): Promise<ImportResult> { try { const response = await fetch(`${origin}/api/world-cup/import-fifa-pmsr-safe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pdfUrl, dryRun }), cache: 'no-store' }); let payload: unknown = null; try { payload = await response.json(); } catch { payload = await response.text(); } return { url: pdfUrl, ok: response.ok, status: response.status, payload, missingMatch, source }; } catch (error) { return { url: pdfUrl, ok: false, status: 0, error: error instanceof Error ? error.message : 'Erro ao importar PDF.', missingMatch, source }; } }
async function discoverFromPage(url: string, source: 'hub' | 'statistics') { const response = await fetch(url, { headers: { accept: 'text/html,*/*' }, cache: 'no-store' }); if (!response.ok) return { error: `HTTP ${response.status}`, discovered: [] as Candidate[], hints: [] as string[] }; const html = await response.text(); return { error: null, discovered: extractPmsrLinks(html).map((item) => ({ url: item, source })), hints: extractMatchReportHints(html) }; }
function readLimit(value: SyncBody['limit'], all: boolean) { if (all || String(value).toLowerCase() === 'all') return 200; return Math.max(1, Math.min(Number(value ?? 5), 200)); }
function uniqueCandidates(items: Candidate[]) { return Array.from(new Map(items.map((item) => [pdfKey(item.url), item])).values()).sort(byMatchNumber); }

async function runSync(request: NextRequest, body: SyncBody) {
  const hubUrl = body.hubUrl ?? REPORT_HUB_URL; const statisticsUrl = body.statisticsUrl ?? FIFA_STATS_PAGE_URL; const dryRun = body.dryRun !== false; const all = body.all === true || String(body.limit).toLowerCase() === 'all'; const force = body.force === true; const forceMissing = body.forceMissing !== false; const limit = readLimit(body.limit, all); const mode = body.mode ?? 'both'; const minMatchNumber = Math.max(1, Math.min(Number(body.minMatchNumber ?? 1), 200)); const maxMatchNumber = Math.max(minMatchNumber, Math.min(Number(body.maxMatchNumber ?? 200), 200)); const origin = request.nextUrl.origin;
  const importedMap = dryRun || force ? new Map() : await alreadyImportedMap();
  const discovered: Candidate[] = []; let hubDiscoveredCount = 0, statisticsDiscoveredCount = 0, statisticsHintCount = 0; let hubError: string | null = null, statisticsError: string | null = null;
  if (mode === 'hub' || mode === 'both') { const hub = await discoverFromPage(hubUrl, 'hub'); hubDiscoveredCount = hub.discovered.length; hubError = hub.error; discovered.push(...hub.discovered); const stats = await discoverFromPage(statisticsUrl, 'statistics'); statisticsDiscoveredCount = stats.discovered.length; statisticsHintCount = stats.hints.length; statisticsError = stats.error; discovered.push(...stats.discovered); }
  const missingDiscovery = (mode === 'backfill' || mode === 'both') ? await discoverByMissing(limit * 3, minMatchNumber, maxMatchNumber) : { found: [] as Candidate[], missing: [] as MissingMatch[] };
  discovered.push(...missingDiscovery.found);
  const dedupedDiscovered = uniqueCandidates(discovered);
  const selectable = dedupedDiscovered.filter((item) => { const previous = importedMap.get(pdfKey(item.url)); if (force || dryRun) return true; if (forceMissing && item.retryEvenIfImported) return true; return !(previous?.status === 'success' && Number(previous.saved_values ?? 0) > 0); });
  const selected = selectable.slice(0, limit);
  const results: ImportResult[] = [];
  for (const item of selected) { const previous = importedMap.get(pdfKey(item.url)); if (!force && !dryRun && !item.retryEvenIfImported && previous?.status === 'success' && Number(previous.saved_values ?? 0) > 0) { results.push({ url: item.url, ok: true, status: 200, skipped: true, source: item.source, payload: { skipped: true, reason: 'already_imported', previous } }); continue; } const result = await importOne(origin, item.url, dryRun, item.source, item.missingMatch); await recordLog(result, dryRun); results.push(result); }
  return NextResponse.json({ success: true, dryRun, all, force, forceMissing, mode, scope: 'Somente Copa do Mundo 2026. Não altera tabelas ou endpoints de outros campeonatos.', behavior: 'incremental + retry de partidas finalizadas sem estatística FIFA; associação no importador por fifa_match_id/M do PMSR antes de nomes.', hubUrl, statisticsUrl, hubError, statisticsError, hubDiscoveredCount, statisticsDiscoveredCount, statisticsHintCount, alreadyImportedCount: importedMap.size, missingFinishedWithoutFifa: missingDiscovery.missing.length, missingCandidatesFound: missingDiscovery.found.length, selectedCount: selected.length, importedOk: results.filter((r) => r.ok && !r.skipped).length, skipped: results.filter((r) => r.skipped).length, failed: results.filter((r) => !r.ok).length, totalSavedValues: results.reduce((sum, result) => sum + Number(result.payload?.savedValues ?? 0), 0), searchWindow: { minMatchNumber, maxMatchNumber }, selected, results, lastUpdated: new Date().toISOString() });
}
export async function GET(request: NextRequest) { const params = request.nextUrl.searchParams; return runSync(request, { dryRun: params.get('dryRun') !== 'false', limit: params.get('limit') ?? undefined, onlyMissing: params.get('onlyMissing') !== 'false', hubUrl: params.get('hubUrl') ?? undefined, statisticsUrl: params.get('statisticsUrl') ?? undefined, mode: (params.get('mode') as SyncBody['mode']) ?? 'both', minMatchNumber: Number(params.get('minMatchNumber') ?? 1), maxMatchNumber: Number(params.get('maxMatchNumber') ?? 200), all: params.get('all') === 'true', force: params.get('force') === 'true', forceMissing: params.get('forceMissing') !== 'false' }); }
export async function POST(request: NextRequest) { const body = (await request.json().catch(() => ({}))) as SyncBody; return runSync(request, body); }
