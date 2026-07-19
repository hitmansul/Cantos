import { NextRequest, NextResponse } from 'next/server';
import { getRankings, normalizeCompetitionKey, validateMetric, type VenueScope } from '@/lib/analytics/footballAnalyticsRepository';
import { PersistentDatabaseNotConfiguredError } from '@/lib/persistence/database';

const SCOPES = new Set<VenueScope>(['all', 'home', 'away']);
const WINDOWS = new Set([0, 5, 10, 20]);

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const competitionKey = normalizeCompetitionKey(params.get('competitionKey') ?? params.get('league'));
    const season = params.get('season')?.trim() ?? '';
    const metric = params.get('metric')?.trim() ?? 'corners_for';
    const venueScope = (params.get('venueScope') ?? 'all') as VenueScope;
    const windowSize = Number(params.get('window') ?? 0);
    const limit = Math.min(Math.max(Number(params.get('limit') ?? 20) || 20, 1), 100);

    if (!competitionKey) return NextResponse.json({ error: 'Informe league ou competitionKey' }, { status: 400 });
    if (!/^\d{4}$/.test(season)) return NextResponse.json({ error: 'season inválida' }, { status: 400 });
    if (!validateMetric(metric)) return NextResponse.json({ error: 'Métrica não suportada' }, { status: 400 });
    if (!SCOPES.has(venueScope)) return NextResponse.json({ error: 'venueScope inválido' }, { status: 400 });
    if (!WINDOWS.has(windowSize)) return NextResponse.json({ error: 'window deve ser 0, 5, 10 ou 20' }, { status: 400 });

    const rankings = await getRankings({ competitionKey, season, metric, venueScope, windowSize, limit });
    return NextResponse.json({ competitionKey, season, metric, venueScope, windowSize, total: rankings.length, rankings });
  } catch (error) {
    if (error instanceof PersistentDatabaseNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('[analytics/rankings] error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao gerar ranking' }, { status: 500 });
  }
}
