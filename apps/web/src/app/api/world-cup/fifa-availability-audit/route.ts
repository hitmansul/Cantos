import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const WORLD_CUP_2026_KEY = 'world_cup_2026';
const FIFA_SCORES_FIXTURES_URL = 'https://www.fifa.com/pt/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=BR&wtw-filter=ALL';
const PMSR_BASE = 'https://www.fifatrainingcentre.com/media/native/tournaments/fifa-world-cup/2026';
const REPORT_HUB_URL = 'https://www.fifatrainingcentre.com/en/fifa-world-cup-2026/match-report-hub.php';
const MATCH_CENTRE_PREFIX = 'https://www.fifa.com/pt/match-centre/match/17/285023/289287';

type Missing = {
  id: number;
  fixture_key: string;
  fifa_match_id: string | null;
  home_team_name: string;
  away_team_name: string;
  home_score: number | null;
  away_score: number | null;
  kickoff_at: string | null;
  status: string | null;
  total_stats: number;
  fifa_stats: number;
  other_stats: number;
};

type McCandidate = { url: string; matchId: string; context: string; source: string };
type PmsrCandidate = { url: string; exists: boolean; source: string };

const CODE_BY_TEAM: Record<string, string[]> = {
  brazil:['BRA'], brasil:['BRA'], japan:['JPN'], japao:['JPN'], "cote d'ivoire":['CIV'], 'cote d ivoire':['CIV'], 'ivory coast':['CIV'], 'costa do marfim':['CIV'], norway:['NOR'], noruega:['NOR'], france:['FRA'], franca:['FRA'], sweden:['SWE'], suecia:['SWE'], mexico:['MEX'], ecuador:['ECU'], equador:['ECU'], england:['ENG'], inglaterra:['ENG'], 'congo dr':['COD'], 'rd congo':['COD'], 'dr congo':['COD'], belgium:['BEL'], belgica:['BEL'], senegal:['SEN'], usa:['USA'], eua:['USA'], 'united states':['USA'], 'bosnia and herzegovina':['BIH'], 'bosnia e herzegovina':['BIH'], bosnia:['BIH'], spain:['ESP'], espanha:['ESP'], austria:['AUT'], portugal:['POR'], croatia:['CRO'], croacia:['CRO'], switzerland:['SUI'], suica:['SUI'], algeria:['ALG'], argelia:['ALG'], australia:['AUS'], egypt:['EGY'], egito:['EGY'], argentina:['ARG'], 'cape verde islands':['CPV'], 'cape verde':['CPV'], 'cabo verde':['CPV'], colombia:['COL'], ghana:['GHA'], gana:['GHA'], canada:['CAN'], morocco:['MAR'], marrocos:['MAR'], netherlands:['NED'], holanda:['NED'], germany:['GER'], alemanha:['GER'], paraguay:['PAR'], paraguai:['PAR'], czechia:['CZE'], tchequia:['CZE'], 'czech republic':['CZE'], 'south africa':['RSA','ZAF'], 'africa do sul':['RSA','ZAF'], 'korea republic':['KOR'], 'coreia do sul':['KOR'], 'south korea':['KOR'], qatar:['QAT'], catar:['QAT'], haiti:['HAI'], turkiye:['TUR'], turkey:['TUR'], turquia:['TUR'], iraq:['IRQ'], iraque:['IRQ'], uruguay:['URU'], uruguai:['URU'], 'saudi arabia':['KSA'], 'arabia saudita':['KSA'], 'ir iran':['IRN'], iran:['IRN'], ira:['IRN'], 'new zealand':['NZL'], 'nova zelandia':['NZL'], panama:['PAN'], uzbekistan:['UZB'], uzbequistao:['UZB'], jordan:['JOR'], jordania:['JOR'], tunisia:['TUN'], curacao:['CUW'], curacau:['CUW'], scotland:['SCO'], escocia:['SCO']
};

function normalize(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function sameTeam(a: unknown, b: unknown) {
  const x = normalize(a); const y = normalize(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
}
function hasBothTeams(context: string, home?: string, away?: string) {
  return sameTeam(context, home) && sameTeam(context, away);
}
function teamCodes(name?: string) { return CODE_BY_TEAM[normalize(name)] ?? []; }
function dedupe<T>(items: T[], key: (item: T) => string) { return Array.from(new Map(items.map((item) => [key(item), item])).values()); }
async function fetchText(url: string) {
  try {
    const res = await fetch(url, { cache: 'no-store', headers: { accept: 'text/html,application/json,*/*', 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8', referer: 'https://www.fifa.com/' } });
    return { ok: res.ok, status: res.status, text: await res.text().catch(() => '') };
  } catch (error) {
    return { ok: false, status: 0, text: '', error: error instanceof Error ? error.message : 'fetch error' };
  }
}
async function exists(url: string) {
  try {
    let res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (res.ok) return true;
    if ([403, 405].includes(res.status)) {
      res = await fetch(url, { method: 'GET', headers: { range: 'bytes=0-256' }, cache: 'no-store' });
      return res.ok || res.status === 206;
    }
    return false;
  } catch { return false; }
}
async function missingRows() {
  return (await sql`
    SELECT m.id, m.fixture_key, m.fifa_match_id, m.home_team_name, m.away_team_name, m.home_score, m.away_score, m.kickoff_at, m.status,
      COUNT(s.id)::int AS total_stats,
      COUNT(s.id) FILTER (WHERE s.source_key = 'fifa')::int AS fifa_stats,
      COUNT(s.id) FILTER (WHERE s.source_key <> 'fifa')::int AS other_stats
    FROM world_cup_matches m
    LEFT JOIN world_cup_match_statistics s ON s.match_id = m.id
    WHERE m.competition_key = ${WORLD_CUP_2026_KEY}
      AND (m.status ILIKE '%fim%' OR m.status ILIKE '%final%' OR m.status ILIKE '%finished%' OR m.home_score IS NOT NULL OR m.away_score IS NOT NULL)
    GROUP BY m.id
    HAVING COUNT(s.id) FILTER (WHERE s.source_key = 'fifa') = 0
    ORDER BY m.kickoff_at DESC NULLS LAST, m.id DESC
    LIMIT 80
  `) as Missing[];
}
function extractMatchCentreLinks(html: string, source: string): McCandidate[] {
  const decoded = html.replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const items: McCandidate[] = [];
  const regex = /(https?:\/\/www\.fifa\.com\/[^\s"'<>]+\/match-centre\/match\/17\/285023\/289287\/(\d+)|\/[^\s"'<>]*match-centre\/match\/17\/285023\/289287\/(\d+))/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(decoded))) {
    const raw = match[1];
    const matchId = match[2] ?? match[3];
    const url = raw.startsWith('http') ? raw : `https://www.fifa.com${raw}`;
    const context = decoded.slice(Math.max(0, match.index - 1800), Math.min(decoded.length, match.index + 1800));
    items.push({ url, matchId, context: context.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1000), source });
  }
  return dedupe(items, (item) => item.matchId);
}
function pmsrCandidateUrls(match: Missing, maxMatchNumber = 200) {
  const home = teamCodes(match.home_team_name); const away = teamCodes(match.away_team_name); const urls: string[] = [];
  if (!home.length || !away.length) return urls;
  for (let number = 1; number <= maxMatchNumber; number += 1) {
    const mm = String(number).padStart(2, '0');
    for (const h of home) for (const a of away) urls.push(
      `${PMSR_BASE}/PMSR-M${mm}-${h}-V-${a}.pdf`,
      `${PMSR_BASE}/PMSR-M${mm}-${a}-V-${h}.pdf`,
      `${PMSR_BASE}/PMSR-M${mm} ${h} V ${a}.pdf`,
      `${PMSR_BASE}/PMSR-M${mm} ${a} V ${h}.pdf`
    );
  }
  return dedupe(urls, (u) => u);
}
function extractPmsrLinks(html: string) {
  const decoded = html.replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const links: string[] = [];
  let match: RegExpExecArray | null;
  const regex = /(https?:\/\/[^\s"'<>]+PMSR[^\s"'<>]+\.pdf|\/media\/[^\s"'<>]+PMSR[^\s"'<>]+\.pdf)/gi;
  while ((match = regex.exec(decoded))) links.push(match[1].startsWith('http') ? match[1] : `https://www.fifatrainingcentre.com${match[1]}`);
  return dedupe(links, (x) => x);
}
function pmsrMatchesTeams(url: string, match: Missing) {
  const text = normalize(decodeURIComponent(url));
  const homeCodes = teamCodes(match.home_team_name).map(normalize);
  const awayCodes = teamCodes(match.away_team_name).map(normalize);
  return homeCodes.some((c) => text.includes(c)) && awayCodes.some((c) => text.includes(c));
}
async function discoverCalendarLinks() {
  const urls = [
    'https://api.fifa.com/api/v3/calendar/matches?competition=17&season=285023&stage=289287',
    'https://api.fifa.com/api/v3/calendar/matches?competitionId=17&seasonId=285023&stageId=289287',
  ];
  const links: McCandidate[] = [];
  for (const url of urls) {
    const res = await fetchText(url);
    if (!res.text) continue;
    links.push(...extractMatchCentreLinks(res.text, url));
    const ids = Array.from(new Set(Array.from(res.text.matchAll(/4000\d+/g)).map((m) => m[0])));
    for (const id of ids) links.push({ url: `${MATCH_CENTRE_PREFIX}/${id}`, matchId: id, context: res.text.slice(Math.max(0, res.text.indexOf(id) - 1200), res.text.indexOf(id) + 1200), source: url });
  }
  return dedupe(links, (item) => item.matchId);
}
async function inspectMatchCentre(url: string) {
  const res = await fetchText(url);
  const text = res.text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 20000);
  const hasStatsWords = /estat[ií]sticas|statistics|escanteios|corners|finaliza|shots|posse|possession|faltas|fouls|impedimentos|offsides|passes/i.test(text);
  return { ok: res.ok, status: res.status, htmlLength: res.text.length, hasStatsWords };
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const deep = params.get('deep') !== 'false';
    const missing = await missingRows();
    const scoresPage = await fetchText(FIFA_SCORES_FIXTURES_URL);
    const reportHub = await fetchText(REPORT_HUB_URL);
    const scoresLinks = extractMatchCentreLinks(scoresPage.text, 'scores-fixtures-page');
    const calendarLinks = await discoverCalendarLinks();
    const allMcLinks = dedupe([...scoresLinks, ...calendarLinks], (item) => item.matchId);
    const hubPmsrs = extractPmsrLinks(reportHub.text);

    const items = [];
    for (const match of missing) {
      const officialId = String(match.fifa_match_id ?? '');
      const byExistingId = /^4000\d+/.test(officialId) ? { url: `${MATCH_CENTRE_PREFIX}/${officialId}`, matchId: officialId, context: 'fifa_match_id já gravado no banco', source: 'database' } : null;
      const byContext = allMcLinks.find((item) => hasBothTeams(item.context, match.home_team_name, match.away_team_name));
      const mc = byExistingId ?? byContext ?? null;
      const hubMatches = hubPmsrs.filter((url) => pmsrMatchesTeams(url, match)).slice(0, 8).map((url) => ({ url, exists: true, source: 'hub' }));
      const bruteForceCandidates: PmsrCandidate[] = [];
      if (hubMatches.length === 0 && deep) {
        for (const url of pmsrCandidateUrls(match, 200)) {
          if (bruteForceCandidates.length >= 3) break;
          if (await exists(url)) bruteForceCandidates.push({ url, exists: true, source: 'bruteforce' });
        }
      }
      const pmsrCandidates = [...hubMatches, ...bruteForceCandidates];
      const mcStatus = mc && deep ? await inspectMatchCentre(mc.url) : null;
      const reason = pmsrCandidates.length > 0
        ? 'PMSR encontrado: pode importar via PDF oficial.'
        : mc
          ? (mcStatus?.hasStatsWords ? 'Match Centre encontrado e aparentemente contém termos de estatística: pode tentar importador por navegador.' : 'Match Centre encontrado, mas não encontrei sinais claros de estatísticas na página pública.')
          : 'Não encontrei Match Centre nem PMSR público automaticamente. Provável ausência de publicação FIFA ou diferença de identificador.';
      items.push({
        localMatchId: match.id,
        fixtureKey: match.fixture_key,
        fifaMatchId: match.fifa_match_id,
        home: match.home_team_name,
        away: match.away_team_name,
        score: `${match.home_score ?? '-'} x ${match.away_score ?? '-'}`,
        kickoffAt: match.kickoff_at,
        status: match.status,
        currentStats: { total: match.total_stats, fifa: match.fifa_stats, other: match.other_stats },
        matchCentre: mc ? { found: true, matchId: mc.matchId, url: mc.url, source: mc.source, status: mcStatus } : { found: false },
        pmsr: { found: pmsrCandidates.length > 0, candidates: pmsrCandidates },
        recommendedAction: pmsrCandidates.length > 0
          ? `${request.nextUrl.origin}/api/world-cup/import-fifa-pmsr-safe?dryRun=false&pdfUrl=${encodeURIComponent(pmsrCandidates[0].url)}`
          : mc
            ? `${request.nextUrl.origin}/api/world-cup/import-fifa-match-centre-browser?dryRun=false&localMatchId=${match.id}&fifaMatchId=${mc.matchId}&matchCentreUrl=${encodeURIComponent(mc.url)}`
            : null,
        reason,
      });
    }

    return NextResponse.json({
      success: true,
      competition: WORLD_CUP_2026_KEY,
      scope: 'Somente Copa do Mundo 2026.',
      sourcePages: { scoresFixtures: FIFA_SCORES_FIXTURES_URL, reportHub: REPORT_HUB_URL },
      summary: {
        missingFifaStats: missing.length,
        matchCentreLinksDiscovered: allMcLinks.length,
        pmsrLinksDiscoveredFromHub: hubPmsrs.length,
        actionable: items.filter((item) => item.recommendedAction).length,
        withPmsr: items.filter((item) => item.pmsr.found).length,
        withMatchCentre: items.filter((item) => item.matchCentre.found).length,
        unresolved: items.filter((item) => !item.recommendedAction).length,
      },
      interpretation: 'Este endpoint não importa. Ele audita cada partida sem estatística FIFA e informa se existe PMSR, Match Centre, ação recomendada ou se a FIFA aparentemente ainda não publicou dados oficiais.',
      items,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro na auditoria de disponibilidade FIFA.' }, { status: 500 });
  }
}
