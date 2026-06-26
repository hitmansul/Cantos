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
  metric_name: string;
  value_numeric: number | null;
  source_key: string;
  source_payload: unknown;
  source_updated_at: string | null;
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
    .replace(/_/g, ' ')
    .replace(/[^a-z0-9']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function codeFor(value: unknown) {
  const text = normalize(value);
  if (CODE_BY_ALIAS[text]) return CODE_BY_ALIAS[text];
  for (const [alias, code] of Object.entries(CODE_BY_ALIAS)) {
    if (text.includes(alias)) return code;
  }
  return null;
}

function codesFromFixtureKey(fixtureKey: string) {
  const parts = fixtureKey.split(':').slice(-2).map(codeFor).filter(Boolean) as string[];
  return parts.length >= 2 ? parts : [];
}

function pairKey(match: MatchRow) {
  const fromNames = [codeFor(match.home_team_name), codeFor(match.away_team_name)].filter(Boolean) as string[];
  const codes = fromNames.length >= 2 ? fromNames : codesFromFixtureKey(match.fixture_key);
  if (codes.length < 2) return null;
  return codes.slice(0, 2).sort().join('-');
}

function sideForStat(dup: MatchRow, stat: StatRow) {
  if (stat.team_id === dup.home_team_id) return 'home';
  if (stat.team_id === dup.away_team_id) return 'away';
  return null;
}

async function copyStatToTarget(dup: MatchRow, target: MatchRow, stat: StatRow) {
  const side = sideForStat(dup, stat);
  const targetTeamId = side === 'home' ? target.home_team_id : side === 'away' ? target.away_team_id : null;
  if (!targetTeamId || stat.value_numeric === null) return 0;

  const payload = {
    ...(typeof stat.source_payload === 'object' && stat.source_payload !== null ? stat.source_payload : {}),
    reconciledFromMatchId: dup.id,
    reconciledFromFixtureKey: dup.fixture_key,
    reconciledToFixtureKey: target.fixture_key,
  };

  await sql`
    INSERT INTO world_cup_match_statistics (
      match_id,
      team_id,
      period,
      metric_key,
      metric_name,
      value_numeric,
      source_key,
      source_payload,
      source_updated_at
    )
    VALUES (
      ${target.id},
      ${targetTeamId},
      ${stat.period},
      ${stat.metric_key},
      ${stat.metric_name},
      ${Number(stat.value_numeric)},
      ${stat.source_key},
      ${JSON.stringify(payload)}::jsonb,
      COALESCE(${stat.source_updated_at}, NOW())
    )
    ON CONFLICT ON CONSTRAINT world_cup_match_statistics_unique
    DO UPDATE SET
      metric_name = EXCLUDED.metric_name,
      value_numeric = EXCLUDED.value_numeric,
      source_payload = EXCLUDED.source_payload,
      source_updated_at = EXCLUDED.source_updated_at
  `;

  await sql`DELETE FROM world_cup_match_statistics WHERE id = ${stat.id}`;
  return 1;
}

async function moveStats(dup: MatchRow, target: MatchRow) {
  const stats = (await sql`
    SELECT id, team_id, period, metric_key, metric_name, value_numeric, source_key, source_payload, source_updated_at
    FROM world_cup_match_statistics
    WHERE match_id = ${dup.id}
    ORDER BY id
  `) as StatRow[];

  let moved = 0;
  for (const stat of stats) {
    moved += await copyStatToTarget(dup, target, stat);
  }

  return moved;
}

export async function GET(request: NextRequest) {
  try {
    const dryRun = request.nextUrl.searchParams.get('dryRun') !== 'false';
    const deleteUnmatched = request.nextUrl.searchParams.get('deleteUnmatched') === 'true';
    const limit = Math.max(1, Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 300), 500));

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
    let unmatched = 0;

    for (const dup of duplicates) {
      const key = pairKey(dup);
      const target = key ? targetByPair.get(key) : null;
      if (!key || !target) {
        unmatched += 1;
        if (!dryRun && deleteUnmatched) {
          await sql`DELETE FROM world_cup_match_statistics WHERE match_id = ${dup.id}`;
          await sql`DELETE FROM world_cup_matches WHERE id = ${dup.id}`;
          deletedDuplicates += 1;
          actions.push({ duplicate: dup.fixture_key, reason: 'sem alvo scores365 equivalente; removido por deleteUnmatched=true', deleted: true });
        } else {
          actions.push({ duplicate: dup.fixture_key, reason: 'sem alvo scores365 equivalente' });
        }
        continue;
      }

      if (dryRun) {
        actions.push({ duplicate: dup.fixture_key, target: target.fixture_key, movedStats: 0, deleted: false });
        continue;
      }

      const moved = await moveStats(dup, target);
      movedStats += moved;
      await sql`DELETE FROM world_cup_match_statistics WHERE match_id = ${dup.id}`;
      await sql`DELETE FROM world_cup_matches WHERE id = ${dup.id}`;
      deletedDuplicates += 1;
      actions.push({ duplicate: dup.fixture_key, target: target.fixture_key, movedStats: moved, deleted: true });
    }

    return NextResponse.json({
      success: true,
      dryRun,
      deleteUnmatched,
      scope: 'Somente Copa do Mundo 2026.',
      duplicatesFound: duplicates.length,
      reconciled: actions.filter((item) => item.target).length,
      unmatched,
      movedStats,
      deletedDuplicates,
      actions,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro ao reconciliar partidas FIFA PDF.' }, { status: 500 });
  }
}
