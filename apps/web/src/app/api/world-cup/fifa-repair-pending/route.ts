import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const WORLD_CUP_2026_KEY = 'world_cup_2026';
const MATCH_CENTRE_PREFIX = 'https://www.fifa.com/pt/match-centre/match/17/285023/289287';
const CXM_PAGE_PREFIX = 'https://cxm-api.fifa.com/fifaplusweb/api/pages/pt/match-centre/match/17/285023/289287';

type Missing = {
  id: number;
  fixture_key: string;
  fifa_match_id: string | null;
  home_team_name: string;
  away_team_name: string;
  kickoff_at: string | null;
  status: string | null;
};

type Mapping = { id: string; source: string };

type ImportResult = { ok: boolean; status: number; url: string; payload: unknown };

const MANUAL_KNOWN: Array<{ home: string; away: string; id: string }> = [
  { home: 'Brasil', away: 'Japão', id: '400021516' },
  { home: 'Alemanha', away: 'Paraguai', id: '400021513' },
  { home: 'Holanda', away: 'Marrocos', id: '400021522' },
  { home: 'Inglaterra', away: 'RD Congo', id: '400065454' },
  { home: 'Portugal', away: 'Croácia', id: '400021526' },
];

const PROBE_IDS = Array.from(
  new Set([
    ...MANUAL_KNOWN.map((item) => item.id),
    ...Array.from({ length: 90 }, (_, index) => String(400021500 + index)),
    ...Array.from({ length: 35 }, (_, index) => String(400065440 + index)),
  ]),
);

function normalize(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function sameTeam(a: unknown, b: unknown) {
  const x = normalize(a);
  const y = normalize(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
}
function matchCentreUrl(id: string) {
  return `${MATCH_CENTRE_PREFIX}/${id}`;
}
function textHasTeam(text: string, team: string) {
  const normalized = normalize(text);
  const wanted = normalize(team);
  if (!wanted) return false;
  const aliases: Record<string, string[]> = {
    croacia: ['croatia', 'cro'], portugal: ['portugal', 'por'], espanha: ['spain', 'esp'], austria: ['austria', 'aut'], suica: ['switzerland', 'sui'], argelia: ['algeria', 'alg'],
    eua: ['usa', 'united states'], 'bosnia e herzegovina': ['bosnia', 'bih'], belgica: ['belgium', 'bel'], senegal: ['senegal', 'sen'], mexico: ['mexico', 'mex'], equador: ['ecuador', 'ecu'],
    franca: ['france', 'fra'], suecia: ['sweden', 'swe'], 'costa do marfim': ['ivory coast', 'cote d ivoire', 'civ'], noruega: ['norway', 'nor'], inglaterra: ['england', 'eng'], 'rd congo': ['dr congo', 'congo dr', 'cod'],
  };
  return normalized.includes(wanted) || (aliases[wanted] ?? []).some((alias) => normalized.includes(normalize(alias)));
}
async function missingRows(localMatchId?: string | null) {
  if (localMatchId) {
    return (await sql`
      SELECT m.id, m.fixture_key, m.fifa_match_id, m.home_team_name, m.away_team_name, m.kickoff_at, m.status
      FROM world_cup_matches m
      LEFT JOIN world_cup_match_statistics s ON s.match_id = m.id AND s.source_key = 'fifa'
      WHERE m.competition_key = ${WORLD_CUP_2026_KEY} AND m.id = ${Number(localMatchId)}
      GROUP BY m.id
      LIMIT 1
    `) as Missing[];
  }
  return (await sql`
    SELECT m.id, m.fixture_key, m.fifa_match_id, m.home_team_name, m.away_team_name, m.kickoff_at, m.status
    FROM world_cup_matches m
    LEFT JOIN world_cup_match_statistics s ON s.match_id = m.id AND s.source_key = 'fifa'
    WHERE m.competition_key = ${WORLD_CUP_2026_KEY}
      AND (m.status ILIKE '%fim%' OR m.status ILIKE '%final%' OR m.status ILIKE '%finished%' OR m.home_score IS NOT NULL OR m.away_score IS NOT NULL)
    GROUP BY m.id
    HAVING COUNT(s.id) = 0
    ORDER BY m.kickoff_at DESC NULLS LAST, m.id DESC
    LIMIT 80
  `) as Missing[];
}
function inferKnownFifaId(match: Missing, explicit?: string | null): Mapping | null {
  if (explicit && /^4000\d+$/.test(explicit)) return { id: explicit, source: 'request-param' };
  const stored = String(match.fifa_match_id ?? '');
  if (/^4000\d+$/.test(stored)) return { id: stored, source: 'database' };
  const known = MANUAL_KNOWN.find((item) => (sameTeam(item.home, match.home_team_name) && sameTeam(item.away, match.away_team_name)) || (sameTeam(item.home, match.away_team_name) && sameTeam(item.away, match.home_team_name)));
  return known ? { id: known.id, source: 'manual-known' } : null;
}
async function probeFifaId(match: Missing): Promise<Mapping | null> {
  for (const id of PROBE_IDS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1800);
      const response = await fetch(`${CXM_PAGE_PREFIX}/${id}`, { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json,text/plain,*/*', 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8' } });
      clearTimeout(timer);
      if (!response.ok) continue;
      const text = await response.text();
      if (textHasTeam(text, match.home_team_name) && textHasTeam(text, match.away_team_name)) return { id, source: 'cxm-probe' };
    } catch {}
  }
  return null;
}
async function inferFifaId(match: Missing, explicit?: string | null): Promise<Mapping | null> {
  return inferKnownFifaId(match, explicit) ?? (await probeFifaId(match));
}
function savedValueCount(result: ImportResult) {
  if (!result.payload || typeof result.payload !== 'object') return 0;
  const payload = result.payload as Record<string, unknown>;
  return Number(payload.savedValues ?? 0) || 0;
}
function extractedCount(result: ImportResult) {
  if (!result.payload || typeof result.payload !== 'object') return 0;
  const payload = result.payload as Record<string, unknown>;
  const parser = payload.parser && typeof payload.parser === 'object' ? payload.parser as Record<string, unknown> : {};
  return Number(parser.processedStats ?? parser.extractedTotal ?? 0) || 0;
}
async function importBrowser(origin: string, match: Missing, fifaMatchId: string, dryRun: boolean): Promise<ImportResult> {
  const url = matchCentreUrl(fifaMatchId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 54000);
  try {
    const response = await fetch(`${origin}/api/world-cup/import-fifa-match-centre-browser`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dryRun, fast: false, maxStats: 32, localMatchId: match.id, fifaMatchId, matchCentreUrl: url, homeTeamName: match.home_team_name, awayTeamName: match.away_team_name }),
      cache: 'no-store',
      signal: controller.signal,
    });
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = await response.text(); }
    return { ok: response.ok, status: response.status, url, payload };
  } catch (error) {
    return { ok: false, status: 0, url, payload: { error: error instanceof Error ? error.message : 'timeout ao chamar importador FIFA', timeoutSafe: true } };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const dryRun = params.get('dryRun') !== 'false';
    const localMatchId = params.get('localMatchId') ?? params.get('matchId');
    const explicitFifaId = params.get('fifaMatchId');
    const rows = await missingRows(localMatchId);
    const checked: Array<{ localMatchId: number; home: string; away: string; mapping: Mapping | null }> = [];
    const attempts: Array<{ selected: { localMatchId: number; home: string; away: string; fifaMatchId: string; matchedBy: string; matchCentreUrl: string }; result: ImportResult; savedValues: number; extractedStats: number }> = [];

    for (const match of rows.slice(0, localMatchId ? 1 : 10)) {
      const mapping = await inferFifaId(match, explicitFifaId);
      checked.push({ localMatchId: match.id, home: match.home_team_name, away: match.away_team_name, mapping });
      if (!mapping) continue;
      const result = await importBrowser(request.nextUrl.origin, match, mapping.id, dryRun);
      const attempt = {
        selected: { localMatchId: match.id, home: match.home_team_name, away: match.away_team_name, fifaMatchId: mapping.id, matchedBy: mapping.source, matchCentreUrl: result.url },
        result,
        savedValues: savedValueCount(result),
        extractedStats: extractedCount(result),
      };
      attempts.push(attempt);
      if ((dryRun && attempt.extractedStats > 0) || (!dryRun && attempt.savedValues > 0)) {
        return NextResponse.json({
          success: true,
          dryRun,
          repaired: !dryRun,
          strategy: 'Reparo incremental robusto: tenta até 10 partidas pendentes e só considera reparado quando salva estatísticas FIFA.',
          selected: attempt.selected,
          checked,
          attempts,
          nextStep: 'Rode novamente este endpoint para reparar a próxima partida pendente.',
          lastUpdated: new Date().toISOString(),
        });
      }
      if (explicitFifaId || localMatchId) break;
    }

    return NextResponse.json({
      success: false,
      dryRun,
      repaired: false,
      strategy: 'Reparo incremental robusto: nenhuma tentativa desta execução gravou estatísticas.',
      pendingCount: rows.length,
      checked,
      attempts,
      pendingSample: rows.slice(0, 20).map((row) => ({ localMatchId: row.id, home: row.home_team_name, away: row.away_team_name, fifaMatchId: row.fifa_match_id, auditUrl: `${request.nextUrl.origin}/api/world-cup/fifa-availability-audit?matchId=${row.id}` })),
      lastUpdated: new Date().toISOString(),
    }, { status: attempts.length ? 207 : 200 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro no reparo incremental FIFA.' }, { status: 500 });
  }
}
