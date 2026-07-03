import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const WORLD_CUP_2026_KEY = 'world_cup_2026';
const MATCH_CENTRE_PREFIX = 'https://www.fifa.com/pt/match-centre/match/17/285023/289287';

type Missing = {
  id: number;
  fixture_key: string;
  fifa_match_id: string | null;
  home_team_name: string;
  away_team_name: string;
  kickoff_at: string | null;
  status: string | null;
};

const MANUAL_KNOWN: Array<{ home: string; away: string; id: string }> = [
  { home: 'Brasil', away: 'Japão', id: '400021516' },
  { home: 'Alemanha', away: 'Paraguai', id: '400021513' },
  { home: 'Holanda', away: 'Marrocos', id: '400021522' },
  { home: 'Inglaterra', away: 'RD Congo', id: '400065454' },
];

function normalize(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function sameTeam(a: unknown, b: unknown) {
  const x = normalize(a);
  const y = normalize(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
}
function matchCentreUrl(id: string) {
  return `${MATCH_CENTRE_PREFIX}/${id}`;
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
function inferFifaId(match: Missing, explicit?: string | null) {
  if (explicit && /^4000\d+$/.test(explicit)) return { id: explicit, source: 'request-param' };
  const stored = String(match.fifa_match_id ?? '');
  if (/^4000\d+$/.test(stored)) return { id: stored, source: 'database' };
  const known = MANUAL_KNOWN.find((item) => (sameTeam(item.home, match.home_team_name) && sameTeam(item.away, match.away_team_name)) || (sameTeam(item.home, match.away_team_name) && sameTeam(item.away, match.home_team_name)));
  if (known) return { id: known.id, source: 'manual-known' };
  return null;
}
async function importBrowser(origin: string, match: Missing, fifaMatchId: string, dryRun: boolean) {
  const url = matchCentreUrl(fifaMatchId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 26000);
  try {
    const response = await fetch(`${origin}/api/world-cup/import-fifa-match-centre-browser`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dryRun,
        fast: true,
        maxStats: 10,
        localMatchId: match.id,
        fifaMatchId,
        matchCentreUrl: url,
        homeTeamName: match.home_team_name,
        awayTeamName: match.away_team_name,
      }),
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
    const candidates = rows.map((match) => ({ match, mapping: inferFifaId(match, explicitFifaId) }));
    const selected = candidates.find((item) => item.mapping !== null);

    if (!selected) {
      return NextResponse.json({
        success: true,
        dryRun,
        repaired: false,
        reason: 'Nenhuma partida pendente tem fifa_match_id conhecido. Use /api/world-cup/fifa-availability-audit para identificar o localMatchId e informe ?localMatchId=<id>&fifaMatchId=<4000...>.',
        pendingCount: rows.length,
        pendingSample: rows.slice(0, 20).map((row) => ({ localMatchId: row.id, home: row.home_team_name, away: row.away_team_name, fifaMatchId: row.fifa_match_id, auditUrl: `${request.nextUrl.origin}/api/world-cup/fifa-availability-audit?matchId=${row.id}` })),
        lastUpdated: new Date().toISOString(),
      });
    }

    const result = await importBrowser(request.nextUrl.origin, selected.match, selected.mapping!.id, dryRun);
    return NextResponse.json({
      success: result.ok,
      dryRun,
      repaired: result.ok,
      strategy: 'Reparo incremental timeout-safe: processa uma partida por execução e chama importador FIFA em modo rápido com limite de 10 estatísticas.',
      selected: {
        localMatchId: selected.match.id,
        home: selected.match.home_team_name,
        away: selected.match.away_team_name,
        fifaMatchId: selected.mapping!.id,
        matchedBy: selected.mapping!.source,
        matchCentreUrl: result.url,
      },
      result,
      nextStep: result.ok ? 'Rode novamente este endpoint para tentar a próxima partida pendente mapeada.' : 'O importador respondeu sem estourar a Vercel; verifique o payload para saber se a FIFA publicou estatísticas reconhecíveis.',
      lastUpdated: new Date().toISOString(),
    }, { status: result.ok ? 200 : 207 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro no reparo incremental FIFA.' }, { status: 500 });
  }
}
