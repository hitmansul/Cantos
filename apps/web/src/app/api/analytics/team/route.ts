import { NextRequest, NextResponse } from 'next/server';
import { getTeamProfile, normalizeCompetitionKey } from '@/lib/analytics/footballAnalyticsRepository';
import { PersistentDatabaseNotConfiguredError } from '@/lib/persistence/database';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const teamKey = params.get('teamKey')?.trim() || null;
    const teamName = params.get('team')?.trim() || null;
    const competitionKey = normalizeCompetitionKey(params.get('competitionKey') ?? params.get('league'));
    const season = params.get('season')?.trim() || null;

    if (!teamKey && !teamName) {
      return NextResponse.json({ error: 'Informe teamKey ou team' }, { status: 400 });
    }
    if (season && !/^\d{4}$/.test(season)) {
      return NextResponse.json({ error: 'season inválida' }, { status: 400 });
    }

    const profile = await getTeamProfile({ teamKey, teamName, competitionKey, season });
    if (!profile) return NextResponse.json({ error: 'Equipe não encontrada' }, { status: 404 });
    return NextResponse.json(profile);
  } catch (error) {
    if (error instanceof PersistentDatabaseNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('[analytics/team] error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao consultar equipe' }, { status: 500 });
  }
}
