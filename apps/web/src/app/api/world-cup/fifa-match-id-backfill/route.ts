import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const WORLD_CUP_2026_KEY = 'world_cup_2026';
const MATCH_CENTRE_PREFIX = 'https://www.fifa.com/pt/match-centre/match';
const COMPETITION_ID = '17';
const SEASON_ID = '285023';
const STAGE_ID = '289287';

const FIFA_SOURCES = [
  `https://api.fifa.com/api/v3/calendar/matches?competition=${COMPETITION_ID}&season=${SEASON_ID}&stage=${STAGE_ID}`,
  `https://api.fifa.com/api/v3/calendar/matches?competitionId=${COMPETITION_ID}&seasonId=${SEASON_ID}&stageId=${STAGE_ID}`,
  `https://api.fifa.com/api/v3/calendar/matches?competition=${COMPETITION_ID}&season=${SEASON_ID}`,
  `https://api.fifa.com/api/v3/calendar/matches?competitionId=${COMPETITION_ID}&seasonId=${SEASON_ID}`,
  'https://www.fifa.com/pt/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=BR&wtw-filter=ALL',
  'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=BR&wtw-filter=ALL',
];

const TEAM_CODES: Record<string, string[]> = {
  mexico:['MEX'], equador:['ECU'], ecuador:['ECU'], franca:['FRA'], france:['FRA'], suecia:['SWE'], sweden:['SWE'], 'costa do marfim':['CIV'], norway:['NOR'], noruega:['NOR'], 'africa do sul':['RSA','ZAF'], canada:['CAN'], argelia:['ALG'], algeria:['ALG'], austria:['AUT'], 'rd congo':['COD'], congo:['COD'], uzbequistao:['UZB'], uzbekistan:['UZB'], panama:['PAN'], inglaterra:['ENG'], england:['ENG'], croacia:['CRO'], croatia:['CRO'], gana:['GHA'], ghana:['GHA'], 'nova zelandia':['NZL'], belgium:['BEL'], belgica:['BEL'], egito:['EGY'], egypt:['EGY'], ira:['IRN'], iran:['IRN'], 'cabo verde':['CPV'], 'arabia saudita':['KSA'], uruguai:['URU'], uruguay:['URU'], espanha:['ESP'], spain:['ESP'], portugal:['POR'], brasil:['BRA'], brazil:['BRA'], japan:['JPN'], japao:['JPN'], alemanha:['GER'], germany:['GER'], paraguai:['PAR'], paraguay:['PAR'], holanda:['NED'], netherlands:['NED'], marrocos:['MAR'], morocco:['MAR']
};

type DbMatch = { id: number; home_team_name: string; away_team_name: string; kickoff_at: string | null; fifa_match_id: string | null; source_payload: unknown };
type Candidate = { fifaMatchId: string; url: string; context: string; source: string; home?: string | null; away?: string | null; kickoff?: string | null; score?: string | null };

function normalize(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim() || null;
  if (Array.isArray(value)) return value.map(cleanText).find(Boolean) ?? null;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of ['Description','description','Name','name','ShortName','shortName','TeamName','teamName','CountryName','countryName','DisplayName','displayName','Abbreviation','abbreviation']) {
      const text = cleanText(obj[key]); if (text) return text;
    }
  }
  return null;
}
function sameTeam(a: unknown, b: unknown) {
  const x = normalize(a); const y = normalize(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
}
function teamCodes(name: string) { return TEAM_CODES[normalize(name)] ?? []; }
function hasTeamInContext(context: string, team: string) {
  const n = normalize(context);
  return sameTeam(context, team) || teamCodes(team).some((code) => n.includes(normalize(code)));
}
function kickoffDay(value: string | null | undefined) {
  if (!value) return null;
  const ts = Date.parse(value); return Number.isFinite(ts) ? new Date(ts).toISOString().slice(0, 10) : null;
}
function decodePage(text: string) {
  return text.replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}
function getUrlFromCandidate(id: string, context: string) {
  const match = context.match(new RegExp(`https?:\\/\\/www\\.fifa\\.com\\/[^\\s"'<>]*match-centre\\/match\\/[^\\s"'<>]*${id}`));
  if (match?.[0]) return match[0];
  const path = context.match(new RegExp(`\\/[^\\s"'<>]*match-centre\\/match\\/[^\\s"'<>]*${id}`));
  if (path?.[0]) return `https://www.fifa.com${path[0]}`;
  return `${MATCH_CENTRE_PREFIX}/${COMPETITION_ID}/${SEASON_ID}/${STAGE_ID}/${id}`;
}
function extractFromText(text: string, source: string): Candidate[] {
  const decoded = decodePage(text);
  const items: Candidate[] = [];
  for (const match of decoded.matchAll(/4000\d+/g)) {
    const id = match[0];
    const context = decoded.slice(Math.max(0, match.index! - 3500), Math.min(decoded.length, match.index! + 3500));
    items.push({ fifaMatchId: id, url: getUrlFromCandidate(id, context), context, source });
  }
  return Array.from(new Map(items.map((i) => [i.fifaMatchId, i])).values());
}
function extractId(obj: any): string | null {
  const raw = obj?.IdMatch ?? obj?.idMatch ?? obj?.matchId ?? obj?.MatchId ?? obj?.matchID ?? obj?.id ?? obj?.Id;
  const text = String(raw ?? '');
  return /^4000\d+/.test(text) ? text : null;
}
function readSide(obj: any, side: 'home' | 'away'): string | null {
  const keys = side === 'home' ? ['HomeTeam','homeTeam','home','Home','team1','Team1','homeCompetitor','HomeCompetitor'] : ['AwayTeam','awayTeam','away','Away','team2','Team2','awayCompetitor','AwayCompetitor'];
  for (const key of keys) { const text = cleanText(obj?.[key]); if (text) return text; }
  return null;
}
function readKickoff(obj: any): string | null {
  for (const key of ['Date','date','MatchDate','matchDate','LocalDate','localDate','startTime','StartTime','kickoff_at','kickoffAt']) { const text = cleanText(obj?.[key]); if (text) return text; }
  return null;
}
function readScore(obj: any): string | null {
  const h = obj?.homeScore ?? obj?.HomeScore ?? obj?.home_team_score ?? obj?.homeCompetitor?.score;
  const a = obj?.awayScore ?? obj?.AwayScore ?? obj?.away_team_score ?? obj?.awayCompetitor?.score;
  return h !== undefined && a !== undefined ? `${h}-${a}` : null;
}
function collectObjects(value: unknown, source: string, out: Candidate[] = []) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) { value.forEach((v) => collectObjects(v, source, out)); return out; }
  const obj = value as Record<string, unknown>;
  const id = extractId(obj);
  if (id) {
    const home = readSide(obj, 'home'); const away = readSide(obj, 'away'); const kickoff = readKickoff(obj);
    const context = JSON.stringify(obj).slice(0, 9000);
    out.push({ fifaMatchId: id, url: getUrlFromCandidate(id, context), context, source, home, away, kickoff, score: readScore(obj) });
  }
  Object.values(obj).forEach((v) => collectObjects(v, source, out));
  return out;
}
async function fetchCandidates() {
  const all: Candidate[] = [];
  for (const url of FIFA_SOURCES) {
    try {
      const res = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json,text/html,*/*', 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8', referer: 'https://www.fifa.com/' } });
      const text = await res.text().catch(() => '');
      all.push(...extractFromText(text, url));
      try { all.push(...collectObjects(JSON.parse(text), url)); } catch {}
    } catch {}
  }
  return Array.from(new Map(all.map((c) => [c.fifaMatchId, c])).values());
}
async function dbMatches(pendingOnly: boolean) {
  const rows = pendingOnly
    ? await sql`SELECT m.id, m.home_team_name, m.away_team_name, m.kickoff_at, m.fifa_match_id, m.source_payload FROM world_cup_matches m LEFT JOIN world_cup_match_statistics s ON s.match_id = m.id AND s.source_key = 'fifa' WHERE m.competition_key = ${WORLD_CUP_2026_KEY} GROUP BY m.id HAVING COUNT(s.id) = 0 ORDER BY m.kickoff_at NULLS LAST, m.id`
    : await sql`SELECT id, home_team_name, away_team_name, kickoff_at, fifa_match_id, source_payload FROM world_cup_matches WHERE competition_key = ${WORLD_CUP_2026_KEY} ORDER BY kickoff_at NULLS LAST, id`;
  return rows as DbMatch[];
}
function candidateMatches(match: DbMatch, candidate: Candidate) {
  const homeOk = candidate.home && candidate.away
    ? ((sameTeam(candidate.home, match.home_team_name) && sameTeam(candidate.away, match.away_team_name)) || (sameTeam(candidate.home, match.away_team_name) && sameTeam(candidate.away, match.home_team_name)))
    : (hasTeamInContext(candidate.context, match.home_team_name) && hasTeamInContext(candidate.context, match.away_team_name));
  if (!homeOk) return false;
  const a = kickoffDay(match.kickoff_at); const b = kickoffDay(candidate.kickoff);
  return !a || !b || a === b;
}
async function run(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const dryRun = params.get('dryRun') !== 'false';
  const pendingOnly = params.get('pendingOnly') !== 'false';
  const limit = Math.max(1, Math.min(Number(params.get('limit') ?? 200), 300));
  const [matches, candidates] = await Promise.all([dbMatches(pendingOnly), fetchCandidates()]);
  let updated = 0;
  const mapped = [];
  const unresolved = [];
  for (const match of matches.slice(0, limit)) {
    if (/^4000\d+$/.test(String(match.fifa_match_id ?? ''))) { mapped.push({ localMatchId: match.id, home: match.home_team_name, away: match.away_team_name, fifaMatchId: match.fifa_match_id, action: 'already-set' }); continue; }
    const found = candidates.find((c) => candidateMatches(match, c));
    if (!found) { unresolved.push({ localMatchId: match.id, home: match.home_team_name, away: match.away_team_name, kickoffAt: match.kickoff_at }); continue; }
    if (!dryRun) {
      await sql`UPDATE world_cup_matches SET fifa_match_id = ${found.fifaMatchId}, source_payload = COALESCE(source_payload, '{}'::jsonb) || ${JSON.stringify({ fifaMatchId: found.fifaMatchId, fifaMatchCentreUrl: found.url, fifaMatchIdBackfilledAt: new Date().toISOString(), fifaMatchIdSource: found.source })}::jsonb, source_updated_at = NOW(), updated_at = NOW() WHERE id = ${match.id}`;
      updated += 1;
    }
    mapped.push({ localMatchId: match.id, home: match.home_team_name, away: match.away_team_name, fifaMatchId: found.fifaMatchId, matchCentreUrl: found.url, matchedBy: found.source, action: dryRun ? 'would-update' : 'updated' });
  }
  return NextResponse.json({ success: true, dryRun, pendingOnly, candidatesFound: candidates.length, matchesChecked: Math.min(matches.length, limit), updated, mappedCount: mapped.length, unresolvedCount: unresolved.length, mapped, unresolved, repairNext: `${request.nextUrl.origin}/api/world-cup/fifa-repair-pending?dryRun=false`, lastUpdated: new Date().toISOString() });
}
export async function GET(request: NextRequest) { try { return await run(request); } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro no backfill de fifa_match_id.' }, { status: 500 }); } }
