import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';

const WORLD_CUP_2026_KEY = 'world_cup_2026';

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
};

type SourceMatch = {
  id?: number | string;
  startTime?: string | null;
  roundName?: string | null;
  statusId?: number | null;
  statusText?: string | null;
  homeTeam?: { name?: string | null; shortName?: string | null };
  awayTeam?: { name?: string | null; shortName?: string | null };
};

function n(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripPrefix(value: unknown) {
  const parts = String(value ?? '').trim().split(/\s+/);
  return parts.length > 1 && /^[A-Z]{2,3}$/i.test(parts[0] ?? '') ? parts.slice(1).join(' ') : String(value ?? '');
}

function teamKey(value: unknown) {
  const raw = normalize(stripPrefix(value));
  if (raw === 'brasil' || raw === 'bra') return 'brazil';
  if (raw === 'escocia' || raw === 'sco') return 'scotland';
  if (raw === 'eua' || raw === 'usa' || raw === 'united states') return 'usa';
  if (raw === 'coreia do sul' || raw === 'south korea') return 'korea republic';
  if (raw === 'tchequia' || raw === 'republica tcheca' || raw === 'czech republic') return 'czechia';
  if (raw === 'turquia' || raw === 'turkey') return 'turkiye';
  if (raw === 'costa do marfim' || raw === 'ivory coast' || raw === 'cote d ivoire') return "cote d'ivoire";
  if (raw === 'cabo verde' || raw === 'cape verde') return 'cape verde islands';
  if (raw === 'rd congo' || raw === 'dr congo' || raw === 'congo rd') return 'congo dr';
  if (raw === 'ira' || raw === 'iran') return 'ir iran';
  if (raw === 'alemanha' || raw === 'ger') return 'germany';
  if (raw === 'equador' || raw === 'ecu') return 'ecuador';
  if (raw === 'mexico' || raw === 'mex') return 'mexico';
  if (raw === 'curacao' || raw === 'curacau' || raw === 'cw') return 'curacao';
  return raw;
}

function matchIdentity(home: unknown, away: unknown, date: unknown) {
  const day = date ? new Date(String(date)).toISOString().slice(0, 10) : 'sem-data';
  return `${day}|${teamKey(home)}|${teamKey(away)}`;
}

function probabilityOver(mean: number, line: number) {
  const z = (mean - line) / Math.max(1.8, Math.sqrt(Math.max(mean, 1)));
  return clamp(Math.round(50 + z * 24), 5, 95);
}

function isFinishedStatus(status: unknown) {
  const value = normalize(status);
  return ['finished', 'fim', 'final', 'ft'].some((term) => value.includes(term));
}

function shouldPredict(match: { kickoff_at?: string | Date | null; status?: unknown }) {
  if (isFinishedStatus(match.status)) return false;
  const kickoff = match.kickoff_at ? new Date(match.kickoff_at) : null;
  if (kickoff && Number.isFinite(kickoff.getTime())) {
    return kickoff.getTime() >= Date.now() - 3 * 60 * 60 * 1000;
  }
  return true;
}

function model(home?: TeamAverages, away?: TeamAverages) {
  const homeCornersFor = n(home?.corners_for, 4.7);
  const homeCornersAgainst = n(home?.corners_against, 4.7);
  const awayCornersFor = n(away?.corners_for, 4.7);
  const awayCornersAgainst = n(away?.corners_against, 4.7);
  const homeCardsFor = n(home?.cards_for, 1.9);
  const homeCardsAgainst = n(home?.cards_against, 1.9);
  const awayCardsFor = n(away?.cards_for, 1.9);
  const awayCardsAgainst = n(away?.cards_against, 1.9);
  const homeXgFor = n(home?.xg_for, 1.2);
  const homeXgAgainst = n(home?.xg_against, 1.2);
  const awayXgFor = n(away?.xg_for, 1.2);
  const awayXgAgainst = n(away?.xg_against, 1.2);

  const homeCorners = (homeCornersFor + awayCornersAgainst) / 2;
  const awayCorners = (awayCornersFor + homeCornersAgainst) / 2;
  const totalCorners = homeCorners + awayCorners;
  const homeCards = (homeCardsFor + awayCardsAgainst) / 2;
  const awayCards = (awayCardsFor + homeCardsAgainst) / 2;
  const totalCards = homeCards + awayCards;
  const homeXg = (homeXgFor + awayXgAgainst) / 2;
  const awayXg = (awayXgFor + homeXgAgainst) / 2;
  const totalXg = homeXg + awayXg;
  const homeSamples = n(home?.matches);
  const awaySamples = n(away?.matches);
  const confidence = clamp(35 + Math.min(homeSamples, awaySamples) * 12, 35, 82);

  return {
    corners: {
      home: round(homeCorners),
      away: round(awayCorners),
      total: round(totalCorners),
      over85: probabilityOver(totalCorners, 8.5),
      over95: probabilityOver(totalCorners, 9.5),
      over105: probabilityOver(totalCorners, 10.5),
    },
    cards: {
      home: round(homeCards),
      away: round(awayCards),
      total: round(totalCards),
      over35: probabilityOver(totalCards, 3.5),
      over45: probabilityOver(totalCards, 4.5),
    },
    goals: {
      homeXg: round(homeXg, 2),
      awayXg: round(awayXg, 2),
      totalXg: round(totalXg, 2),
      bothTeamsScore: clamp(Math.round(30 + Math.min(homeXg, awayXg) * 24), 10, 78),
      over25: probabilityOver(totalXg, 2.5),
    },
    confidence,
    note: homeSamples && awaySamples
      ? 'Modelo baseado no histórico persistido da Copa. Prioriza FIFA e usa 365Scores/API-Football apenas como complemento.'
      : 'Modelo com média padrão até existir histórico suficiente para as duas seleções.',
  };
}

async function loadUpcomingFromDatabase(): Promise<DbMatch[]> {
  const rows = await sql`
    SELECT id, home_team_name, away_team_name, kickoff_at, group_name, round_name, status, source_key
    FROM world_cup_matches
    WHERE competition_key = ${WORLD_CUP_2026_KEY}
      AND (kickoff_at IS NULL OR kickoff_at >= NOW() - INTERVAL '3 hours')
      AND LOWER(COALESCE(status, '')) NOT IN ('finished', 'fim', 'final', 'ft')
    ORDER BY kickoff_at ASC NULLS LAST, id ASC
    LIMIT 120
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
        status: match.statusText ?? (match.statusId === 2 ? 'Ao vivo' : 'Agendado'),
        source_key: '365scores',
      }))
      .filter(shouldPredict);
  } catch {
    return [];
  }
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
        AND LOWER(COALESCE(m.status, '')) IN ('finished', 'fim', 'final', 'ft')
    ), picked AS (
      SELECT * FROM stat_base WHERE rn = 1
    )
    SELECT
      t.name AS team_name,
      COUNT(DISTINCT p.match_id)::int AS matches,
      AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('corners', 'corner_kicks', 'escanteios') AND p.team_id = t.id)::float AS corners_for,
      AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('corners', 'corner_kicks', 'escanteios') AND p.team_id <> t.id)::float AS corners_against,
      AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('yellow_cards', 'cartoes_amarelos') AND p.team_id = t.id)::float AS cards_for,
      AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('yellow_cards', 'cartoes_amarelos') AND p.team_id <> t.id)::float AS cards_against,
      AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('shots', 'total_shots', 'finalizacoes') AND p.team_id = t.id)::float AS shots_for,
      AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('shots', 'total_shots', 'finalizacoes') AND p.team_id <> t.id)::float AS shots_against,
      AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('expected_goals', 'xg', 'gols_esperados_xg') AND p.team_id = t.id)::float AS xg_for,
      AVG(p.value_numeric) FILTER (WHERE p.metric_key IN ('expected_goals', 'xg', 'gols_esperados_xg') AND p.team_id <> t.id)::float AS xg_against
    FROM world_cup_teams t
    LEFT JOIN picked p ON p.team_id = t.id OR p.home_team_id = t.id OR p.away_team_id = t.id
    WHERE t.competition_key = ${WORLD_CUP_2026_KEY}
    GROUP BY t.id, t.name
  `) as TeamAverages[];
}

export async function GET(request: NextRequest) {
  try {
    const [dbUpcoming, liveUpcoming, averages] = await Promise.all([
      loadUpcomingFromDatabase(),
      loadUpcomingFromLiveSource(request),
      loadTeamAverages(),
    ]);

    const merged = new Map<string, DbMatch>();
    for (const match of [...dbUpcoming, ...liveUpcoming]) {
      if (!shouldPredict(match)) continue;
      const id = matchIdentity(match.home_team_name, match.away_team_name, match.kickoff_at);
      if (!merged.has(id)) merged.set(id, match);
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
        return {
          id: match.id,
          homeTeamName: match.home_team_name,
          awayTeamName: match.away_team_name,
          kickoffAt: match.kickoff_at,
          groupName: match.group_name,
          roundName: match.round_name,
          sourceKey: match.source_key,
          prediction: model(home, away),
          samples: { homeMatches: home?.matches ?? 0, awayMatches: away?.matches ?? 0 },
        };
      });

    return NextResponse.json({
      success: true,
      predictions,
      count: predictions.length,
      sources: {
        databaseUpcoming: dbUpcoming.length,
        liveUpcoming: liveUpcoming.length,
        teamAverages: averages.length,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro ao gerar previsões.' }, { status: 500 });
  }
}
