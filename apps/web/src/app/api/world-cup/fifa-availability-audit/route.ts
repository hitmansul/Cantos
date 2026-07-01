import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const WORLD_CUP_2026_KEY = 'world_cup_2026';
const MATCH_CENTRE_PREFIX = 'https://www.fifa.com/pt/match-centre/match/17/285023/289287';
const FIFA_SCORES_FIXTURES_URL = 'https://www.fifa.com/pt/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=BR&wtw-filter=ALL';
const REPORT_HUB_URL = 'https://www.fifatrainingcentre.com/en/fifa-world-cup-2026/match-report-hub.php';

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

type ExternalCandidate = { matchId: string; url: string; source: string; context?: string };

const MANUAL_KNOWN: Array<{ home: string; away: string; id: string }> = [
  { home: 'Brasil', away: 'Japão', id: '400021516' },
  { home: 'Alemanha', away: 'Paraguai', id: '400021513' },
  { home: 'Holanda', away: 'Marrocos', id: '400021522' },
];

function normalize(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function sameTeam(a: unknown, b: unknown) {
  const x = normalize(a);
  const y = normalize(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
}
function hasBothTeams(text: string, home?: string, away?: string) {
  return sameTeam(text, home) && sameTeam(text, away);
}
function matchCentreUrl(id: string) {
  return `${MATCH_CENTRE_PREFIX}/${id}`;
}
function publicImportUrl(origin: string, match: Missing, fifaMatchId: string) {
  return `${origin}/api/world-cup/import-fifa-match-centre-browser?dryRun=false&localMatchId=${match.id}&fifaMatchId=${fifaMatchId}&matchCentreUrl=${encodeURIComponent(matchCentreUrl(fifaMatchId))}`;
}
async function fetchText(url: string) {
  try {
    const response = await fetch(url, { cache: 'no-store', headers: { accept: 'text/html,application/json,*/*', 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8', referer: 'https://www.fifa.com/' } });
    return { ok: response.ok, status: response.status, text: await response.text().catch(() => '') };
  } catch (error) {
    return { ok: false, status: 0, text: '', error: error instanceof Error ? error.message : 'fetch error' };
  }
}
async function missingRows(matchId?: string | null) {
  if (matchId) {
    return (await sql`
      SELECT m.id, m.fixture_key, m.fifa_match_id, m.home_team_name, m.away_team_name, m.home_score, m.away_score, m.kickoff_at, m.status,
        COUNT(s.id)::int AS total_stats,
        COUNT(s.id) FILTER (WHERE s.source_key = 'fifa')::int AS fifa_stats,
        COUNT(s.id) FILTER (WHERE s.source_key <> 'fifa')::int AS other_stats
      FROM world_cup_matches m
      LEFT JOIN world_cup_match_statistics s ON s.match_id = m.id
      WHERE m.competition_key = ${WORLD_CUP_2026_KEY} AND m.id = ${Number(matchId)}
      GROUP BY m.id
      LIMIT 1
    `) as Missing[];
  }
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
function decodeHtml(text: string) {
  return text.replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}
function extractMatchCentreCandidates(text: string, source: string): ExternalCandidate[] {
  const decoded = decodeHtml(text);
  const items: ExternalCandidate[] = [];
  const regex = /(https?:\/\/www\.fifa\.com\/[^\s"'<>]+\/match-centre\/match\/17\/285023\/289287\/(\d+)|\/[^\s"'<>]*match-centre\/match\/17\/285023\/289287\/(\d+)|4000\d+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(decoded))) {
    const raw = match[1];
    const id = (match[2] ?? match[3] ?? raw.match(/4000\d+/)?.[0]) as string | undefined;
    if (!id) continue;
    const url = raw.startsWith('http') ? raw : raw.startsWith('/') ? `https://www.fifa.com${raw}` : matchCentreUrl(id);
    const context = decoded.slice(Math.max(0, match.index - 1500), Math.min(decoded.length, match.index + 1500));
    items.push({ matchId: id, url, source, context });
  }
  return Array.from(new Map(items.map((item) => [item.matchId, item])).values());
}
function extractPmsrLinks(text: string) {
  const decoded = decodeHtml(text);
  const links: string[] = [];
  let match: RegExpExecArray | null;
  const regex = /(https?:\/\/[^\s"'<>]+PMSR[^\s"'<>]+\.pdf|\/media\/[^\s"'<>]+PMSR[^\s"'<>]+\.pdf)/gi;
  while ((match = regex.exec(decoded))) links.push(match[1].startsWith('http') ? match[1] : `https://www.fifatrainingcentre.com${match[1]}`);
  return Array.from(new Set(links));
}
function pmsrHasTeams(url: string, match: Missing) {
  const haystack = normalize(decodeURIComponent(url));
  const home = normalize(match.home_team_name).split(' ').filter((x) => x.length > 2);
  const away = normalize(match.away_team_name).split(' ').filter((x) => x.length > 2);
  return home.some((x) => haystack.includes(x)) && away.some((x) => haystack.includes(x));
}
async function discoverForOne(match: Missing) {
  const known = MANUAL_KNOWN.find((item) => (sameTeam(item.home, match.home_team_name) && sameTeam(item.away, match.away_team_name)) || (sameTeam(item.home, match.away_team_name) && sameTeam(item.away, match.home_team_name)));
  if (known) return { matchCentre: { found: true, matchId: known.id, url: matchCentreUrl(known.id), source: 'manual-known' }, pmsr: { found: false, candidates: [] as string[] } };

  const official = String(match.fifa_match_id ?? '');
  if (/^4000\d+/.test(official)) return { matchCentre: { found: true, matchId: official, url: matchCentreUrl(official), source: 'database-fifa_match_id' }, pmsr: { found: false, candidates: [] as string[] } };

  const [scores, hub, cal1, cal2] = await Promise.all([
    fetchText(FIFA_SCORES_FIXTURES_URL),
    fetchText(REPORT_HUB_URL),
    fetchText('https://api.fifa.com/api/v3/calendar/matches?competition=17&season=285023&stage=289287'),
    fetchText('https://api.fifa.com/api/v3/calendar/matches?competitionId=17&seasonId=285023&stageId=289287'),
  ]);
  const mcCandidates = [
    ...extractMatchCentreCandidates(scores.text, 'scores-fixtures'),
    ...extractMatchCentreCandidates(cal1.text, 'calendar-competition-season-stage'),
    ...extractMatchCentreCandidates(cal2.text, 'calendar-ids'),
  ];
  const mc = mcCandidates.find((item) => item.context && hasBothTeams(item.context, match.home_team_name, match.away_team_name));
  const pmsrs = extractPmsrLinks(hub.text).filter((url) => pmsrHasTeams(url, match)).slice(0, 5);
  return {
    matchCentre: mc ? { found: true, matchId: mc.matchId, url: mc.url, source: mc.source } : { found: false },
    pmsr: { found: pmsrs.length > 0, candidates: pmsrs },
  };
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const localMatchId = params.get('matchId') ?? params.get('localMatchId');
    const deep = params.get('deep') === 'true' || Boolean(localMatchId);
    const rows = await missingRows(localMatchId);

    if (!deep) {
      return NextResponse.json({
        success: true,
        mode: 'summary-only-timeout-safe',
        competition: WORLD_CUP_2026_KEY,
        summary: {
          missingFifaStats: rows.length,
          withStoredFifaMatchId: rows.filter((row) => /^4000\d+/.test(String(row.fifa_match_id ?? ''))).length,
          withoutStoredFifaMatchId: rows.filter((row) => !/^4000\d+/.test(String(row.fifa_match_id ?? ''))).length,
        },
        instruction: 'Para auditar uma partida sem timeout, chame este mesmo endpoint com ?matchId=<localMatchId>. O endpoint pesado em lote foi substituído por auditoria incremental.',
        repairEndpoint: `${request.nextUrl.origin}/api/world-cup/fifa-repair-pending`,
        items: rows.map((row) => ({
          localMatchId: row.id,
          home: row.home_team_name,
          away: row.away_team_name,
          score: `${row.home_score ?? '-'} x ${row.away_score ?? '-'}`,
          kickoffAt: row.kickoff_at,
          fifaMatchId: row.fifa_match_id,
          currentStats: { total: row.total_stats, fifa: row.fifa_stats, other: row.other_stats },
          auditUrl: `${request.nextUrl.origin}/api/world-cup/fifa-availability-audit?matchId=${row.id}`,
          importWithKnownFifaIdUrl: `${request.nextUrl.origin}/api/world-cup/fifa-repair-pending?localMatchId=${row.id}&fifaMatchId=INFORME_O_ID_FIFA`,
        })),
        lastUpdated: new Date().toISOString(),
      });
    }

    if (rows.length === 0) return NextResponse.json({ success: false, error: 'Partida não encontrada ou não está na lista de pendências FIFA.' }, { status: 404 });
    const match = rows[0];
    const discovered = await discoverForOne(match);
    const fifaId = (discovered.matchCentre as any).matchId as string | undefined;
    return NextResponse.json({
      success: true,
      mode: 'single-match-deep-audit',
      competition: WORLD_CUP_2026_KEY,
      match: {
        localMatchId: match.id,
        home: match.home_team_name,
        away: match.away_team_name,
        score: `${match.home_score ?? '-'} x ${match.away_score ?? '-'}`,
        kickoffAt: match.kickoff_at,
        fifaMatchIdInDb: match.fifa_match_id,
        currentStats: { total: match.total_stats, fifa: match.fifa_stats, other: match.other_stats },
      },
      availability: discovered,
      recommendedAction: fifaId
        ? `${request.nextUrl.origin}/api/world-cup/fifa-repair-pending?dryRun=false&localMatchId=${match.id}&fifaMatchId=${fifaId}`
        : (discovered.pmsr.candidates[0] ? `${request.nextUrl.origin}/api/world-cup/import-fifa-pmsr-safe?dryRun=false&pdfUrl=${encodeURIComponent(discovered.pmsr.candidates[0])}` : null),
      interpretation: fifaId || discovered.pmsr.candidates.length > 0
        ? 'Existe fonte provável. Use recommendedAction para importar esta partida.'
        : 'Não localizei Match Centre/PMSR automaticamente para esta partida. Provável ausência de publicação FIFA ou identificador ainda não mapeado.',
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro na auditoria incremental FIFA.' }, { status: 500 });
  }
}
