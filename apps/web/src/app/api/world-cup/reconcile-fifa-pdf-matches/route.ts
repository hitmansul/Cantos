import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';

const WORLD_CUP_2026_KEY = 'world_cup_2026';

type MatchRow = {
  id: number;
  fixture_key: string;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team_name: string;
  away_team_name: string;
};

type StatRow = {
  id: number;
  team_id: number;
  period: string;
  metric_key: string;
  source_key: string;
};

const CODE_BY_ALIAS: Record<string, string> = {
  brazil: 'BRA', brasil: 'BRA', bra: 'BRA',
  scotland: 'SCO', escocia: 'SCO', sco: 'SCO',
  czechia: 'CZE', tchequia: 'CZE', 'czech republic': 'CZE', cze: 'CZE',
  mexico: 'MEX', mex: 'MEX',
  'south africa': 'RSA', 'africa do sul': 'RSA', rsa: 'RSA', zaf: 'RSA',
  'korea republic': 'KOR', 'coreia do sul': 'KOR', 'south korea': 'KOR', korea: 'KOR', kor: 'KOR',
  morocco: 'MAR', marrocos: 'MAR', mar: 'MAR',
  haiti: 'HAI', hai: 'HAI',
  switzerland: 'SUI', suica: 'SUI', sui: 'SUI',
  canada: 'CAN', can: 'CAN',
  usa: 'USA', eua: 'USA', 'united states': 'USA',
  turkiye: 'TUR', turkey: 'TUR', turquia: 'TUR', tur: 'TUR',
  paraguay: 'PAR', paraguai: 'PAR', par: 'PAR',
  australia: 'AUS', aus: 'AUS',
  france: 'FRA', franca: 'FRA', fra: 'FRA',
  norway: 'NOR', noruega: 'NOR', nor: 'NOR',
  senegal: 'SEN', sen: 'SEN',
  iraq: 'IRQ', iraque: 'IRQ', irq: 'IRQ',
  uruguay: 'URU', uruguai: 'URU', uru: 'URU',
  spain: 'ESP', espanha: 'ESP', esp: 'ESP',
  'saudi arabia': 'KSA', 'arabia saudita': 'KSA', ksa: 'KSA',
  'cape verde islands': 'CPV', 'cape verde': 'CPV', 'cabo verde': 'CPV', cpv: 'CPV',
  egypt: 'EGY', egito: 'EGY', egy: 'EGY',
  'ir iran': 'IRN', iran: 'IRN', ira: 'IRN', irn: 'IRN',
  'new zealand': 'NZL', 'nova zelandia': 'NZL', nzl: 'NZL',
  belgium: 'BEL', belgica: 'BEL', bel: 'BEL',
  croatia: 'CRO', croacia: 'CRO', cro: 'CRO',
  ghana: 'GHA', gana: 'GHA', gha: 'GHA',
  panama: 'PAN', pan: 'PAN',
  england: 'ENG', inglaterra: 'ENG', eng: 'ENG',
  colombia: 'COL', col: 'COL',
  portugal: 'POR', por: 'POR',
  'congo dr': 'COD', 'rd congo': 'COD', 'dr congo': 'COD', cod: 'COD',
  uzbekistan: 'UZB', uzbequistao: 'UZB', uzb: 'UZB',
  algeria: 'ALG', argelia: 'ALG', alg: 'ALG',
  austria: 'AUT', aut: 'AUT',
  jordan: 'JOR', jordania: 'JOR', jor: 'JOR',
  argentina: 'ARG', arg: 'ARG',
  japan: 'JPN', japao: 'JPN', jpn: 'JPN',
  sweden: 'SWE', suecia: 'SWE', swe: 'SWE',
  tunisia: 'TUN', tun: 'TUN',
  netherlands: 'NED', holanda: 'NED', ned: 'NED',
  germany: 'GER', alemanha: 'GER', ger: 'GER',
  ecuador: 'ECU', equador: 'ECU', ecu: 'ECU',
  curacao: 'CUW', curacau: 'CUW', cuw: 'CUW',
  "cote d'ivoire": 'CIV', 'cote d ivoire': 'CIV', 'ivory coast': 'CIV', 'costa do marfim': 'CIV', civ: 'CIV',
  qatar: 'QAT', catar: 'QAT', qat: 'QAT',
  'bosnia and herzegovina': 'BIH', 'bosnia e herzegovina': 'BIH', bosnia: 'BIH', bih: 'BIH',
};

function normalize(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function codeFor(value: unknown) {
  const text = normalize(value).replace(/_/g, ' ');
  if (CODE_BY_ALIAS[text]) return CODE_BY_ALIAS[text];
  for (const [alias, code] of Object.entries(CODE_BY_ALIAS)) {
    if (text.includes(alias)) return code;
  }
  return null;
}

function pairKey(match: MatchRow) {
  const home = codeFor(match.home_team_name) ?? codeFor(match.fixture_key);
  const away = codeFor(match.away_team_name) ?? codeFor(match.fixture_key.split(':').slice(-1)[0]);
  if (!home || !away) return null;
  return [home, away].sort().join('-');
}

function sideForStat(dup: MatchRow, stat: StatRow) {
  if (stat.team_id === dup.home_team_id) return 'home';
  if (stat.team_id === dup.away_team_id) return 'away';
  return null;
}

async function moveStats(dup: MatchRow, target: MatchRow) {
  const stats = (await sql`
    SELECT id, team_id, period, metric_key, source_key
    FROM world_cup_match_statistics
    WHERE match_id = ${dup.id}
  `) as StatRow[];

  let moved = 0;
  for (const stat of stats) {
    const side = sideForStat(dup, stat);
    const targetTeamId = side === 'home' ? target.home_team_id : side === 'away' ? target.away_team_id : null;
    if (!targetTeamId) continue;

    await sql`
      DELETE FROM world_cup_match_statistics
      WHERE match_id = ${target.id}
        AND team_id = ${targetTeamId}
        AND period = ${stat.period}
        AND metric_key = ${stat.metric_key}
        AND source_key = ${stat.source_key}
    `;

    await sql`
      UPDATE world_cup_match_statistics
      SET match_id = ${target.id}, team_id = ${targetTeamId}
      WHERE id = ${stat.id}
    `;
    moved += 1;
  }

  return moved;
}

export async function GET(request: NextRequest) {
  try {
    const dryRun = request.nextUrl.searchParams.get('dryRun') !== 'false';
    const limit = Math.max(1, Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 120), 300));

    const duplicates = (await sql`
      SELECT id, fixture_key, home_team_id, away_team_id, home_team_name, away_team_name
      FROM world_cup_matches
      WHERE competition_key = ${WORLD_CUP_2026_KEY}
        AND fixture_key LIKE 'fifa:pdf:%'
      ORDER BY id DESC
      LIMIT ${limit}
    `) as MatchRow[];

    const targets = (await sql`
      SELECT id, fixture_key, home_team_id, away_team_id, home_team_name, away_team_name
      FROM world_cup_matches
      WHERE competition_key = ${WORLD_CUP_2026_KEY}
        AND fixture_key LIKE 'scores365:%'
    `) as MatchRow[];

    const targetByPair = new Map<string, MatchRow>();
    for (const target of targets) {
      const key = pairKey(target);
      if (key && !targetByPair.has(key)) targetByPair.set(key, target);
    }

    const actions: Array<{ duplicate: string; target?: string; movedStats?: number; deleted?: boolean; reason?: string }> = [];
    let movedStats = 0;
    let deletedDuplicates = 0;

    for (const dup of duplicates) {
      const key = pairKey(dup);
      const target = key ? targetByPair.get(key) : null;
      if (!key || !target) {
        actions.push({ duplicate: dup.fixture_key, reason: 'sem alvo scores365 equivalente' });
        continue;
      }

      if (dryRun) {
        actions.push({ duplicate: dup.fixture_key, target: target.fixture_key, movedStats: 0, deleted: false });
        continue;
      }

      const moved = await moveStats(dup, target);
      movedStats += moved;
      await sql`DELETE FROM world_cup_matches WHERE id = ${dup.id}`;
      deletedDuplicates += 1;
      actions.push({ duplicate: dup.fixture_key, target: target.fixture_key, movedStats: moved, deleted: true });
    }

    return NextResponse.json({
      success: true,
      dryRun,
      scope: 'Somente Copa do Mundo 2026.',
      duplicatesFound: duplicates.length,
      reconciled: actions.filter((item) => item.target).length,
      movedStats,
      deletedDuplicates,
      actions,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro ao reconciliar partidas FIFA PDF.' }, { status: 500 });
  }
}
