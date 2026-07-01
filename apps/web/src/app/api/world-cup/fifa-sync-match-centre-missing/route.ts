import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const WORLD_CUP_2026_KEY = 'world_cup_2026';
const STAGE = { competitionId: '17', seasonId: '285023', stageId: '289287' };

const OVERRIDES = [
  { home: 'Brasil', away: 'Japão', id: '400021516' },
  { home: 'Alemanha', away: 'Paraguai', id: '400021513' },
  { home: 'Holanda', away: 'Marrocos', id: '400021522' },
];

type Missing = { id: number; fixture_key: string; fifa_match_id: string | null; home_team_name: string; away_team_name: string; kickoff_at: string | null; status: string | null };

function normalize(value: unknown) { return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function sameTeam(a: unknown, b: unknown) { const x = normalize(a); const y = normalize(b); return Boolean(x && y && (x === y || x.includes(y) || y.includes(x))); }
function matchCentreUrl(id: string) { return `https://www.fifa.com/pt/match-centre/match/${STAGE.competitionId}/${STAGE.seasonId}/${STAGE.stageId}/${id}`; }
function getObjName(value: any) { if (!value) return null; if (typeof value === 'string') return value; return value.name ?? value.Name ?? value.shortName ?? value.TeamName ?? value.countryName ?? value.CountryName ?? value.description ?? value.DisplayName ?? null; }
function teamName(obj: any, side: 'home' | 'away') { const keys = side === 'home' ? ['homeTeam', 'HomeTeam', 'home', 'Home', 'team1', 'Team1'] : ['awayTeam', 'AwayTeam', 'away', 'Away', 'team2', 'Team2']; for (const key of keys) { const name = getObjName(obj?.[key]); if (name) return String(name); } return side === 'home' ? obj?.homeTeamName ?? obj?.home_team_name : obj?.awayTeamName ?? obj?.away_team_name; }
function officialId(obj: any) { const raw = obj?.IdMatch ?? obj?.idMatch ?? obj?.matchId ?? obj?.MatchId ?? obj?.matchID ?? obj?.id ?? obj?.Id; const text = String(raw ?? ''); return /^4000\d+/.test(text) ? text : null; }
function collectCalendar(value: unknown, out: Array<{ id: string; home: string; away: string }> = []) { if (!value || typeof value !== 'object') return out; if (Array.isArray(value)) { value.forEach((item) => collectCalendar(item, out)); return out; } const obj: any = value; const id = officialId(obj); const home = teamName(obj, 'home'); const away = teamName(obj, 'away'); if (id && home && away) out.push({ id, home: String(home), away: String(away) }); for (const child of Object.values(obj)) collectCalendar(child, out); return out; }
async function calendarMatches() { const urls = [`https://api.fifa.com/api/v3/calendar/matches?competition=${STAGE.competitionId}&season=${STAGE.seasonId}&stage=${STAGE.stageId}`, `https://api.fifa.com/api/v3/calendar/matches?competitionId=${STAGE.competitionId}&seasonId=${STAGE.seasonId}&stageId=${STAGE.stageId}`]; const found: Array<{ id: string; home: string; away: string }> = []; for (const url of urls) { try { const response = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json,*/*', referer: 'https://www.fifa.com/' } }); found.push(...collectCalendar(await response.json().catch(() => null))); } catch {} } return Array.from(new Map(found.map((m) => [`${m.id}:${normalize(m.home)}:${normalize(m.away)}`, m])).values()); }
async function missingMatches() { return (await sql`SELECT m.id, m.fixture_key, m.fifa_match_id, m.home_team_name, m.away_team_name, m.kickoff_at, m.status FROM world_cup_matches m LEFT JOIN world_cup_match_statistics s ON s.match_id = m.id AND s.source_key = 'fifa' WHERE m.competition_key = ${WORLD_CUP_2026_KEY} AND (m.status ILIKE '%fim%' OR m.status ILIKE '%final%' OR m.status ILIKE '%finished%' OR m.home_score IS NOT NULL OR m.away_score IS NOT NULL) GROUP BY m.id HAVING COUNT(s.id) = 0 ORDER BY m.kickoff_at NULLS LAST, m.id LIMIT 80`) as Missing[]; }
function mapMatch(match: Missing, calendar: Array<{ id: string; home: string; away: string }>) { const existing = String(match.fifa_match_id ?? ''); if (/^4000\d+/.test(existing)) return { id: existing, matchedBy: 'existing_fifa_match_id' }; const override = OVERRIDES.find((item) => (sameTeam(item.home, match.home_team_name) && sameTeam(item.away, match.away_team_name)) || (sameTeam(item.home, match.away_team_name) && sameTeam(item.away, match.home_team_name))); if (override) return { id: override.id, matchedBy: 'manual_match_centre_link' }; const found = calendar.find((item) => (sameTeam(item.home, match.home_team_name) && sameTeam(item.away, match.away_team_name)) || (sameTeam(item.home, match.away_team_name) && sameTeam(item.away, match.home_team_name))); return found ? { id: found.id, matchedBy: 'fifa_calendar' } : null; }
async function importOne(origin: string, match: Missing, id: string, dryRun: boolean, browser: boolean) { const url = matchCentreUrl(id); const endpoint = browser ? 'import-fifa-match-centre-browser' : 'import-fifa-match-centre'; const response = await fetch(`${origin}/api/world-cup/${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ localMatchId: match.id, fifaMatchId: id, matchCentreUrl: url, homeTeamName: match.home_team_name, awayTeamName: match.away_team_name, dryRun }), cache: 'no-store' }); let payload: unknown; try { payload = await response.json(); } catch { payload = await response.text(); } return { url, ok: response.ok, status: response.status, importer: endpoint, match, payload }; }

async function run(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const dryRun = params.get('dryRun') !== 'false';
  const browser = params.get('browser') !== 'false';
  const limit = Math.max(1, Math.min(Number(params.get('limit') ?? 3), browser ? 5 : 80));
  const missing = await missingMatches();
  const calendar = await calendarMatches();
  const mapped = missing.map((match) => ({ match, mapping: mapMatch(match, calendar) })).filter((item) => item.mapping !== null) as Array<{ match: Missing; mapping: { id: string; matchedBy: string } }>;
  const selected = mapped.slice(0, limit);
  const results = [];
  for (const item of selected) results.push(await importOne(request.nextUrl.origin, item.match, item.mapping.id, dryRun, browser));
  return NextResponse.json({
    success: true,
    dryRun,
    browser,
    scope: 'Somente Copa do Mundo 2026.',
    strategy: browser ? 'Match Centre via navegador: captura XHR/fetch reais com Playwright e importa estatísticas.' : 'Match Centre via fetch simples.',
    missingFinishedWithoutFifa: missing.length,
    calendarCandidates: calendar.length,
    mappedCandidates: mapped.length,
    selectedCount: selected.length,
    importedOk: results.filter((r) => r.ok).length,
    totalSavedValues: results.reduce((sum: number, r: any) => sum + Number(r.payload?.savedValues ?? 0), 0),
    selected: selected.map((item) => ({ localMatchId: item.match.id, home: item.match.home_team_name, away: item.match.away_team_name, fifaMatchId: item.mapping.id, matchedBy: item.mapping.matchedBy, matchCentreUrl: matchCentreUrl(item.mapping.id) })),
    results,
    lastUpdated: new Date().toISOString(),
  });
}
export async function GET(request: NextRequest) { try { return await run(request); } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro na sincronização Match Centre.' }, { status: 500 }); } }
export async function POST(request: NextRequest) { return GET(request); }
