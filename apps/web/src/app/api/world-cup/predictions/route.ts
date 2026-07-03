import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';

const WORLD_CUP_2026_KEY = 'world_cup_2026';
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

type TeamAverages = {
  team_name: string;
  matches: number;
  corners_for: number | null;
  corners_against: number | null;
  cards_for: number | null;
  cards_against: number | null;
  shots_for: number | null;
  shots_against: number | null;
  xg_for: number | null;
  xg_against: number | null;
};

type DbMatch = {
  id: number | string;
  home_team_name: string;
  away_team_name: string;
  kickoff_at: string | Date | null;
  group_name: string | null;
  round_name: string | null;
  status: string | null;
  source_key: string | null;
  referee?: string | null;
};

type SourceMatch = {
  id?: number | string;
  startTime?: string | null;
  roundName?: string | null;
  statusId?: number | null;
  statusText?: string | null;
  referee?: string | null;
  homeTeam?: { name?: string | null; shortName?: string | null };
  awayTeam?: { name?: string | null; shortName?: string | null };
};

const TEAM_ALIASES: Record<string, string> = {
  brasil: 'brazil', bra: 'brazil', brazil: 'brazil', marrocos: 'morocco', morocco: 'morocco', haiti: 'haiti', escocia: 'scotland', scotland: 'scotland', paraguai: 'paraguay', paraguay: 'paraguay', australia: 'australia', turquia: 'turkiye', turkey: 'turkiye', turkiye: 'turkiye', eua: 'usa', usa: 'usa', 'united states': 'usa', 'estados unidos': 'usa', noruega: 'norway', norway: 'norway', franca: 'france', france: 'france', senegal: 'senegal', iraque: 'iraq', iraq: 'iraq', uruguai: 'uruguay', uruguay: 'uruguay', espanha: 'spain', spain: 'spain', 'cabo verde': 'cape verde islands', 'cape verde': 'cape verde islands', 'cape verde islands': 'cape verde islands', 'arabia saudita': 'saudi arabia', 'saudi arabia': 'saudi arabia', egito: 'egypt', egypt: 'egypt', ira: 'ir iran', iran: 'ir iran', 'ir iran': 'ir iran', 'nova zelandia': 'new zealand', 'new zealand': 'new zealand', belgica: 'belgium', belgium: 'belgium', croacia: 'croatia', croatia: 'croatia', gana: 'ghana', ghana: 'ghana', panama: 'panama', inglaterra: 'england', england: 'england', colombia: 'colombia', portugal: 'portugal', 'rd congo': 'congo dr', 'dr congo': 'congo dr', 'congo dr': 'congo dr', uzbequistao: 'uzbekistan', uzbekistan: 'uzbekistan', argelia: 'algeria', algeria: 'algeria', austria: 'austria', jordania: 'jordan', jordan: 'jordan', argentina: 'argentina', japao: 'japan', japan: 'japan', suecia: 'sweden', sweden: 'sweden', tunisia: 'tunisia', holanda: 'netherlands', 'paises baixos': 'netherlands', netherlands: 'netherlands', 'africa do sul': 'south africa', 'south africa': 'south africa', canada: 'canada', alemanha: 'germany', germany: 'germany', equador: 'ecuador', ecuador: 'ecuador', mexico: 'mexico', curacao: 'curacao', curacau: 'curacao', 'coreia do sul': 'korea republic', 'south korea': 'korea republic', 'korea republic': 'korea republic', tchequia: 'czechia', 'republica tcheca': 'czechia', 'czech republic': 'czechia', czechia: 'czechia', 'costa do marfim': "cote d'ivoire", 'ivory coast': "cote d'ivoire", 'cote d ivoire': "cote d'ivoire",
};

const FALLBACK_MATCHES: DbMatch[] = [
  { id: 'fallback-aus-egy', home_team_name: 'Australia', away_team_name: 'Egypt', kickoff_at: '2026-07-03T18:00:00.000Z', group_name: null, round_name: 'Round of 32', status: 'Agendado', source_key: 'fallback' },
  { id: 'fallback-arg-cpv', home_team_name: 'Argentina', away_team_name: 'Cape Verde Islands', kickoff_at: '2026-07-03T22:00:00.000Z', group_name: null, round_name: 'Round of 32', status: 'Agendado', source_key: 'fallback' },
  { id: 'fallback-col-gha', home_team_name: 'Colombia', away_team_name: 'Ghana', kickoff_at: '2026-07-04T01:30:00.000Z', group_name: null, round_name: 'Round of 32', status: 'Agendado', source_key: 'fallback' },
];

function n(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.floor(value * factor) / factor;
}
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
function normalize(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function stripPrefix(value: unknown) {
  const parts = String(value ?? '').trim().split(/\s+/);
  return parts.length > 1 && /^[A-Z]{2,3}$/i.test(parts[0] ?? '') ? parts.slice(1).join(' ') : String(value ?? '');
}
function teamKey(value: unknown) {
  const raw = normalize(stripPrefix(value));
  return TEAM_ALIASES[raw] ?? raw;
}
function matchIdentity(home: unknown, away: unknown, date: unknown) {
  const timestamp = date ? new Date(String(date)).getTime() : NaN;
  const day = Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : 'sem-data';
  return `${day}|${teamKey(home)}|${teamKey(away)}`;
}
function probabilityOver(mean: number, line: number) {
  const z = (mean - line) / Math.max(1.8, Math.sqrt(Math.max(mean, 1)));
  return clamp(Math.floor(50 + z * 24), 5, 95);
}
function isFinishedStatus(status: unknown) {
  const value = normalize(status);
  return ['finished', 'fim', 'final', 'ft', 'encerrado'].some((term) => value.includes(term));
}
function shouldPredict(match: { kickoff_at?: string | Date | null; status?: unknown }) {
  if (isFinishedStatus(match.status)) return false;
  const kickoff = match.kickoff_at ? new Date(match.kickoff_at) : null;
  return !kickoff || !Number.isFinite(kickoff.getTime()) || kickoff.getTime() >= Date.now() - THREE_HOURS_MS;
}
function safeAvg(value: unknown, fallback: number, min: number, max: number) {
  const raw = Number(value);
  return Number.isFinite(raw) && raw >= min && raw <= max ? raw : fallback;
}
function blend(raw: number, samples: number, baseline: number, maxWeight = 0.68) {
  const weight = clamp(samples / 5, 0, maxWeight);
  return baseline * (1 - weight) + raw * weight;
}
function boundedTotal(home: number, away: number, min: number, max: number) {
  const total = home + away;
  if (total >= min && total <= max) return { home, away, total };
  const scale = clamp(total, min, max) / Math.max(total, 0.1);
  return { home: home * scale, away: away * scale, total: clamp(total, min, max) };
}

function model(home?: TeamAverages, away?: TeamAverages) {
  const homeSamples = n(home?.matches);
  const awaySamples = n(away?.matches);
  const sampleQuality = Math.min(homeSamples, awaySamples);

  const homeCornersFor = blend(safeAvg(home?.corners_for, 4.8, 0, 14), homeSamples, 4.8);
  const homeCornersAgainst = blend(safeAvg(home?.corners_against, 4.8, 0, 14), homeSamples, 4.8);
  const awayCornersFor = blend(safeAvg(away?.corners_for, 4.8, 0, 14), awaySamples, 4.8);
  const awayCornersAgainst = blend(safeAvg(away?.corners_against, 4.8, 0, 14), awaySamples, 4.8);

  const homeCardsFor = blend(safeAvg(home?.cards_for, 1.8, 0, 8), homeSamples, 1.8, 0.62);
  const homeCardsAgainst = blend(safeAvg(home?.cards_against, 1.8, 0, 8), homeSamples, 1.8, 0.62);
  const awayCardsFor = blend(safeAvg(away?.cards_for, 1.8, 0, 8), awaySamples, 1.8, 0.62);
  const awayCardsAgainst = blend(safeAvg(away?.cards_against, 1.8, 0, 8), awaySamples, 1.8, 0.62);

  const homeShotsFor = blend(safeAvg(home?.shots_for, 11.5, 0, 35), homeSamples, 11.5, 0.65);
  const homeShotsAgainst = blend(safeAvg(home?.shots_against, 11.5, 0, 35), homeSamples, 11.5, 0.65);
  const awayShotsFor = blend(safeAvg(away?.shots_for, 11.5, 0, 35), awaySamples, 11.5, 0.65);
  const awayShotsAgainst = blend(safeAvg(away?.shots_against, 11.5, 0, 35), awaySamples, 11.5, 0.65);

  const homeXgFor = blend(safeAvg(home?.xg_for, 1.35, 0, 4), homeSamples, 1.35, 0.55);
  const homeXgAgainst = blend(safeAvg(home?.xg_against, 1.2, 0, 4), homeSamples, 1.2, 0.55);
  const awayXgFor = blend(safeAvg(away?.xg_for, 1.2, 0, 4), awaySamples, 1.2, 0.55);
  const awayXgAgainst = blend(safeAvg(away?.xg_against, 1.35, 0, 4), awaySamples, 1.35, 0.55);

  const rawHomeCorners = (homeCornersFor + awayCornersAgainst) / 2;
  const rawAwayCorners = (awayCornersFor + homeCornersAgainst) / 2;
  const cornerBounds = boundedTotal(rawHomeCorners, rawAwayCorners, 6.5, 12.5);
  const rawHomeCards = (homeCardsFor + awayCardsAgainst) / 2;
  const rawAwayCards = (awayCardsFor + homeCardsAgainst) / 2;
  const cardBounds = boundedTotal(rawHomeCards, rawAwayCards, 1.5, 6.8);

  const homeShots = (homeShotsFor + awayShotsAgainst) / 2;
  const awayShots = (awayShotsFor + homeShotsAgainst) / 2;
  const homeXg = (homeXgFor + awayXgAgainst) / 2;
  const awayXg = (awayXgFor + homeXgAgainst) / 2;
  const totalXg = clamp(homeXg + awayXg, 1.1, 4.2);
  const confidence = clamp(46 + sampleQuality * 8, 46, 78);

  return {
    corners: { home: round(cornerBounds.home), away: round(cornerBounds.away), total: round(cornerBounds.total), over75: probabilityOver(cornerBounds.total, 7.5), over85: probabilityOver(cornerBounds.total, 8.5), over95: probabilityOver(cornerBounds.total, 9.5), over105: probabilityOver(cornerBounds.total, 10.5) },
    cards: { home: round(cardBounds.home), away: round(cardBounds.away), total: round(cardBounds.total), over35: probabilityOver(cardBounds.total, 3.5), over45: probabilityOver(cardBounds.total, 4.5), over55: probabilityOver(cardBounds.total, 5.5) },
    goals: { homeXg: round(homeXg, 2), awayXg: round(awayXg, 2), totalXg: round(totalXg, 2), bothTeamsScore: clamp(Math.floor(30 + Math.min(homeXg, awayXg) * 24), 10, 78), over25: probabilityOver(totalXg, 2.5) },
    shots: { home: round(homeShots), away: round(awayShots), total: round(homeShots + awayShots) },
    fifaAverages: { homeMatches: homeSamples, awayMatches: awaySamples, homeCornersFor: round(homeCornersFor), awayCornersFor: round(awayCornersFor), homeCardsFor: round(homeCardsFor), awayCardsFor: round(awayCardsFor), homeXgFor: round(homeXgFor, 2), awayXgFor: round(awayXgFor, 2) },
    recentHistory: { homeMatches: homeSamples, awayMatches: awaySamples, source: sampleQuality > 0 ? 'Banco persistido da Copa, com limites anti-outlier e arredondamento para baixo' : 'Média base até a FIFA publicar estatísticas suficientes' },
    confidence,
    note: sampleQuality > 0 ? 'Modelo validado com médias da Copa, limites anti-outlier e arredondamento sempre para baixo.' : 'Modelo conservador com média padrão até existir histórico oficial suficiente para as duas seleções.',
  };
}

async function loadUpcomingFromDatabase(): Promise<DbMatch[]> {
  const rows = await sql`
    SELECT id, home_team_name, away_team_name, kickoff_at, group_name, round_name, status, source_key, referee
    FROM world_cup_matches
    WHERE competition_key = ${WORLD_CUP_2026_KEY}
      AND (kickoff_at IS NULL OR kickoff_at >= NOW() - INTERVAL '3 hours')
      AND LOWER(COALESCE(status, '')) NOT IN ('finished', 'fim', 'final', 'ft', 'encerrado')
    ORDER BY kickoff_at ASC NULLS LAST, id ASC
    LIMIT 160
  `;
  return rows as DbMatch[];
}

async function loadUpcomingFromLiveSource(request: NextRequest): Promise<DbMatch[]> {
  try {
    const url = new URL('/api/365scores/upcoming/copa_do_mundo', request.nextUrl.origin);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return [];
    const payload = (await response.json()) as { matches?: SourceMatch[] };
    return (payload.matches ?? [])
      .filter((match) => match.homeTeam?.name && match.awayTeam?.name)
      .map((match) => ({
        id: match.id ?? `${match.startTime}-${match.homeTeam?.name}-${match.awayTeam?.name}`,
        home_team_name: String(match.homeTeam?.name ?? ''),
        away_team_name: String(match.awayTeam?.name ?? ''),
        kickoff_at: match.startTime ?? null,
        group_name: null,
        round_name: match.roundName ?? null,
        referee: match.referee ?? null,
        status: match.statusText ?? (match.statusId === 2 ? 'Ao vivo' : 'Agendado'),
        source_key: '365scores',
      }))
      .filter(shouldPredict);
  } catch {
    return [];
  }
}
function loadFallbackUpcoming(): DbMatch[] {
  return FALLBACK_MATCHES.filter(shouldPredict);
}

async function loadTeamAverages() {
  return (await sql`
    WITH stat_base AS (
      SELECT
        m.id AS match_id,
        m.home_team_id,
        m.away_team_id,
        ms.team_id,
        LOWER(ms.metric_key) AS metric_key,
        ms.value_numeric,
        ROW_NUMBER() OVER (
          PARTITION BY m.id, ms.team_id, LOWER(ms.metric_key)
          ORDER BY CASE ms.source_key WHEN 'fifa' THEN 1 WHEN '365scores' THEN 2 WHEN 'api-football' THEN 3 ELSE 9 END
        ) AS rn
      FROM world_cup_match_statistics ms
      JOIN world_cup_matches m ON m.id = ms.match_id
      WHERE m.competition_key = ${WORLD_CUP_2026_KEY}
        AND ms.value_numeric IS NOT NULL
        AND LOWER(COALESCE(m.status, '')) IN ('finished', 'fim', 'final', 'ft', 'encerrado')
    ), picked AS (
      SELECT * FROM stat_base WHERE rn = 1
    )
    SELECT
      t.name AS team_name,
      COUNT(DISTINCT p.match_id)::int AS matches,
      AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('corners', 'corner_kicks', 'escanteios') AND p.team_id = t.id AND p.value_numeric BETWEEN 0 AND 20)::float AS corners_for,
      AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('corners', 'corner_kicks', 'escanteios') AND p.team_id <> t.id AND p.value_numeric BETWEEN 0 AND 20)::float AS corners_against,
      AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('yellowcards', 'yellow_cards', 'cartoes_amarelos', 'cards') AND p.team_id = t.id AND p.value_numeric BETWEEN 0 AND 10)::float AS cards_for,
      AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('yellowcards', 'yellow_cards', 'cartoes_amarelos', 'cards') AND p.team_id <> t.id AND p.value_numeric BETWEEN 0 AND 10)::float AS cards_against,
      AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('shots', 'total_shots', 'finalizacoes') AND p.team_id = t.id AND p.value_numeric BETWEEN 0 AND 40)::float AS shots_for,
      AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('shots', 'total_shots', 'finalizacoes') AND p.team_id <> t.id AND p.value_numeric BETWEEN 0 AND 40)::float AS shots_against,
      AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('expectedgoals', 'expected_goals', 'xg', 'gols_esperados_xg') AND p.team_id = t.id AND p.value_numeric BETWEEN 0 AND 5)::float AS xg_for,
      AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('expectedgoals', 'expected_goals', 'xg', 'gols_esperados_xg') AND p.team_id <> t.id AND p.value_numeric BETWEEN 0 AND 5)::float AS xg_against
    FROM world_cup_teams t
    LEFT JOIN picked p ON p.team_id = t.id OR p.home_team_id = t.id OR p.away_team_id = t.id
    WHERE t.competition_key = ${WORLD_CUP_2026_KEY}
    GROUP BY t.id, t.name
  `) as TeamAverages[];
}

export async function GET(request: NextRequest) {
  try {
    const [dbUpcoming, liveUpcoming, averages] = await Promise.all([loadUpcomingFromDatabase(), loadUpcomingFromLiveSource(request), loadTeamAverages()]);
    const merged = new Map<string, DbMatch>();
    for (const match of [...dbUpcoming, ...liveUpcoming]) {
      if (!shouldPredict(match)) continue;
      const id = matchIdentity(match.home_team_name, match.away_team_name, match.kickoff_at);
      if (!merged.has(id)) merged.set(id, match);
    }
    const usedFallback = merged.size === 0;
    if (usedFallback) {
      for (const match of loadFallbackUpcoming()) {
        const id = matchIdentity(match.home_team_name, match.away_team_name, match.kickoff_at);
        if (!merged.has(id)) merged.set(id, match);
      }
    }
    const byTeam = new Map(averages.map((row) => [teamKey(row.team_name), row]));
    const predictions = Array.from(merged.values())
      .sort((a, b) => {
        const at = a.kickoff_at ? new Date(a.kickoff_at).getTime() : Number.MAX_SAFE_INTEGER;
        const bt = b.kickoff_at ? new Date(b.kickoff_at).getTime() : Number.MAX_SAFE_INTEGER;
        return at - bt;
      })
      .map((match) => {
        const home = byTeam.get(teamKey(match.home_team_name));
        const away = byTeam.get(teamKey(match.away_team_name));
        return { id: match.id, homeTeamName: match.home_team_name, awayTeamName: match.away_team_name, kickoffAt: match.kickoff_at, groupName: match.group_name, roundName: match.round_name, status: match.status, referee: match.referee ?? null, sourceKey: match.source_key, prediction: model(home, away), samples: { homeMatches: home?.matches ?? 0, awayMatches: away?.matches ?? 0 } };
      });
    return NextResponse.json({ success: true, predictions, count: predictions.length, validation: { rounding: 'médias arredondadas sempre para baixo', corners: 'totais limitados entre 6.5 e 12.5 para evitar outliers incompatíveis com futebol profissional', cards: 'cartões limitados entre 1.5 e 6.8', sourcePriority: 'FIFA > 365Scores > API-Football > média base' }, sources: { databaseUpcoming: dbUpcoming.length, liveUpcoming: liveUpcoming.length, fallbackUpcoming: usedFallback ? predictions.length : 0, teamAverages: averages.length }, lastUpdated: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro ao gerar previsões.' }, { status: 500 });
  }
}
