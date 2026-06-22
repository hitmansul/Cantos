import { NextRequest, NextResponse } from 'next/server';
import { scores365Get } from '@/app/api/utils/scores365';

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

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
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

export async function GET(request: NextRequest) {
  const gameId = request.nextUrl.searchParams.get('gameId');

  if (!gameId || !/^\d+$/.test(gameId)) {
    return NextResponse.json({ error: 'Invalid game id' }, { status: 400 });
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

    return NextResponse.json({ gameId: Number(gameId), statistics, lastUpdated: new Date().toISOString() });
  } catch (error) {
    console.error('[365scores/game-stats] error:', error);
    return NextResponse.json({ gameId: Number(gameId), statistics: [], error: 'Failed to fetch game statistics' }, { status: 500 });
  }
}
