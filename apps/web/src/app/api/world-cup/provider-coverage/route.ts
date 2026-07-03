import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { scores365Get } from '@/app/api/utils/scores365';
import { isApiFootballConfigured } from '@/app/api/utils/apiFootball';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const WORLD_CUP_2026_KEY = 'world_cup_2026';

type MatchRow = {
  id: number;
  fixture_key: string;
  fifa_match_id: string | null;
  home_team_name: string;
  away_team_name: string;
  home_score: number | null;
  away_score: number | null;
  kickoff_at: string | null;
  status: string | null;
  fifa_stats_count: string | number;
  scores365_stats_count: string | number;
};

type Scores365Statistic = {
  id?: number;
  name?: string;
  competitorId?: number;
  categoryName?: string;
  isMajor?: boolean;
  value?: number | string;
};

function score365IdFromFixtureKey(key: string | null) {
  const match = String(key ?? '').match(/^scores365:(\d+):/);
  return match?.[1] ?? null;
}
function hasCoreStats(stats: Scores365Statistic[]) {
  const names = stats.map((item) => String(item.name ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')).join('|');
  return {
    corners: /corner|escanteio|canto/.test(names),
    shots: /shot|chute|finaliza/.test(names),
    cards: /yellow|red|cart/.test(names),
    fouls: /foul|falta/.test(names),
    possession: /possession|posse/.test(names),
  };
}
async function getFinishedMatches(limit: number) {
  return (await sql`
    SELECT
      m.id,
      m.fixture_key,
      m.fifa_match_id,
      m.home_team_name,
      m.away_team_name,
      m.home_score,
      m.away_score,
      m.kickoff_at,
      m.status,
      COUNT(s.id) FILTER (WHERE s.source_key = 'fifa') AS fifa_stats_count,
      COUNT(s.id) FILTER (WHERE s.source_key = '365scores') AS scores365_stats_count
    FROM world_cup_matches m
    LEFT JOIN world_cup_match_statistics s ON s.match_id = m.id
    WHERE m.competition_key = ${WORLD_CUP_2026_KEY}
      AND (m.status ILIKE '%fim%' OR m.status ILIKE '%final%' OR m.status ILIKE '%finished%' OR m.home_score IS NOT NULL OR m.away_score IS NOT NULL)
    GROUP BY m.id
    ORDER BY m.kickoff_at DESC NULLS LAST, m.id DESC
    LIMIT ${limit}
  `) as MatchRow[];
}
async function fetch365Stats(gameIds: string[]) {
  if (gameIds.length === 0) return [] as Scores365Statistic[];
  const payload = (await scores365Get('/web/game/stats/', { games: gameIds.join(',') })) as { statistics?: Scores365Statistic[] };
  return payload.statistics ?? [];
}
export async function GET(request: NextRequest) {
  try {
    const limit = Math.max(1, Math.min(60, Number(request.nextUrl.searchParams.get('limit') ?? 30)));
    const matches = await getFinishedMatches(limit);
    const scoreIds = matches.map((m) => score365IdFromFixtureKey(m.fixture_key)).filter(Boolean) as string[];
    let scores365Stats: Scores365Statistic[] = [];
    let scores365Error: string | null = null;
    try {
      scores365Stats = await fetch365Stats(scoreIds);
    } catch (error) {
      scores365Error = error instanceof Error ? error.message : 'Erro ao consultar 365Scores';
    }
    const byCompetitor = new Map<number, Scores365Statistic[]>();
    for (const stat of scores365Stats) {
      const id = Number(stat.competitorId);
      if (!Number.isFinite(id)) continue;
      const list = byCompetitor.get(id) ?? [];
      list.push(stat);
      byCompetitor.set(id, list);
    }
    const items = matches.map((m) => {
      const score365GameId = score365IdFromFixtureKey(m.fixture_key);
      const gameStats = scores365Stats.filter((stat) => String(stat.competitorId ?? '').length > 0 && score365GameId);
      const majorStats = gameStats.filter((stat) => stat.isMajor);
      return {
        localMatchId: m.id,
        home: m.home_team_name,
        away: m.away_team_name,
        score: `${m.home_score ?? '-'} x ${m.away_score ?? '-'}`,
        kickoffAt: m.kickoff_at,
        status: m.status,
        identifiers: { fifaMatchId: m.fifa_match_id, scores365GameId: score365GameId },
        database: { fifaStats: Number(m.fifa_stats_count), scores365Stats: Number(m.scores365_stats_count) },
        coverage: {
          fifaInDatabase: Number(m.fifa_stats_count) > 0,
          scores365InDatabase: Number(m.scores365_stats_count) > 0,
          scores365LiveAvailable: gameStats.length > 0,
          scores365LiveStatsCount: gameStats.length,
          scores365LiveMajorStatsCount: majorStats.length,
          core: hasCoreStats(gameStats),
        },
      };
    });
    const summary = {
      matchesChecked: items.length,
      fifaWithStatsInDatabase: items.filter((item) => item.coverage.fifaInDatabase).length,
      scores365WithStatsInDatabase: items.filter((item) => item.coverage.scores365InDatabase).length,
      scores365LiveAvailable: items.filter((item) => item.coverage.scores365LiveAvailable).length,
      scores365LiveStatsFetched: scores365Stats.length,
      apiFootballConfigured: isApiFootballConfigured(),
      sofascoreStatus: 'sem importador persistente específico para Copa no repositório; há rotas Sofascore genéricas, mas não pipeline de cobertura da Copa.',
      recommendation: 'Usar FIFA FDH como fonte primária quando houver fdhMatchId; usar 365Scores como fallback automático para jogos sem estatísticas FIFA; API-Football apenas se chave estiver configurada e cobrir fixtures da Copa.',
    };
    return NextResponse.json({
      success: true,
      purpose: 'Auditoria de cobertura por provedor para decidir fonte definitiva de estatísticas da Copa.',
      summary,
      warnings: scores365Error ? [`365Scores falhou: ${scores365Error}`] : [],
      items,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro na auditoria de provedores.' }, { status: 500 });
  }
}
