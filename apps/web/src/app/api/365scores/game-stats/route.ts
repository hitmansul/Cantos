import { NextRequest, NextResponse } from 'next/server';
import { scores365Get } from '@/app/api/utils/scores365';
import { getMatchStatistics } from '@/lib/statistics/matchStatisticsEngine';

type Scores365Statistic = {
  id?: number;
  name?: string;
  competitorId?: number;
  categoryName?: string;
  isMajor?: boolean;
  value?: number | string;
  order?: number;
  categoryOrder?: number;
};

const API_FOOTBALL_LABELS: Record<string, string> = {
  shots_on_goal: 'Finalizações no alvo',
  shots_off_goal: 'Finalizações para fora',
  total_shots: 'Finalizações',
  blocked_shots: 'Finalizações bloqueadas',
  shots_insidebox: 'Finalizações dentro da área',
  shots_outsidebox: 'Finalizações fora da área',
  fouls: 'Faltas',
  corner_kicks: 'Escanteios',
  offsides: 'Impedimentos',
  ball_possession: 'Posse de bola',
  yellow_cards: 'Cartões amarelos',
  red_cards: 'Cartões vermelhos',
  goalkeeper_saves: 'Defesas do goleiro',
  total_passes: 'Passes',
  passes_accurate: 'Passes certos',
  passes_percentage: 'Precisão dos passes',
  expected_goals: 'Gols esperados (xG)',
  goals_prevented: 'Gols evitados',
};

function normalizeValue(value: unknown, key?: string): string {
  if (value === null || value === undefined || value === '') return '-';
  if (key === 'ball_possession' || key === 'passes_percentage') return `${value}%`;
  return String(value);
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function apiFootballStatistics(gameId: string, data: Awaited<ReturnType<typeof getMatchStatistics>>) {
  return data.teams.flatMap((team) =>
    Object.entries(team.values).map(([key, value], index) => ({
      key: `api_${key}_${team.teamId}`,
      name: API_FOOTBALL_LABELS[key] ?? key.replace(/_/g, ' '),
      competitorId: Number(team.teamId),
      categoryName: 'Estatísticas oficiais',
      isMajor: ['corner_kicks', 'total_shots', 'shots_on_goal', 'ball_possession', 'expected_goals'].includes(key),
      value: normalizeValue(value, key),
      order: index,
      categoryOrder: 0,
    })),
  );
}

export async function GET(request: NextRequest) {
  const gameId = request.nextUrl.searchParams.get('gameId');

  if (!gameId || !/^\d+$/.test(gameId)) {
    return NextResponse.json({ error: 'Invalid game id' }, { status: 400 });
  }

  try {
    const unified = await getMatchStatistics(gameId);
    const centralStatistics = apiFootballStatistics(gameId, unified);

    if (centralStatistics.length > 0) {
      return NextResponse.json({
        gameId: Number(gameId),
        fixtureId: gameId,
        statistics: centralStatistics,
        events: unified.events,
        lineups: unified.lineups,
        coverage: unified.coverage,
        source: unified.source,
        lastUpdated: unified.fetchedAt,
      });
    }
  } catch (error) {
    console.warn('[365scores/game-stats] motor central indisponível, usando fallback', error);
  }

  try {
    const data = (await scores365Get('/web/game/stats/', { games: gameId })) as {
      statistics?: Scores365Statistic[];
    };

    const statistics = (data.statistics ?? [])
      .map((stat) => ({
        id: stat.id,
        key: normalizeKey(`${stat.id ?? ''}_${stat.name ?? 'stat'}`),
        name: stat.name ?? 'Estatística',
        competitorId: stat.competitorId,
        categoryName: stat.categoryName ?? 'Geral',
        isMajor: Boolean(stat.isMajor),
        value: normalizeValue(stat.value),
        order: stat.order ?? 999,
        categoryOrder: stat.categoryOrder ?? 999,
      }))
      .sort((a, b) => a.categoryOrder - b.categoryOrder || a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'));

    return NextResponse.json({
      gameId: Number(gameId),
      statistics,
      events: [],
      lineups: [],
      coverage: { statistics: statistics.length > 0, events: false, lineups: false },
      source: '365scores',
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[365scores/game-stats] error:', error);
    return NextResponse.json({
      gameId: Number(gameId),
      statistics: [],
      events: [],
      lineups: [],
      coverage: { statistics: false, events: false, lineups: false },
      source: 'none',
      error: 'Failed to fetch game statistics',
    }, { status: 500 });
  }
}
