import { NextRequest, NextResponse } from 'next/server';
import { getTeamProfile, normalizeCompetitionKey, type VenueScope } from '@/lib/analytics/footballAnalyticsRepository';
import { PersistentDatabaseNotConfiguredError } from '@/lib/persistence/database';

const SCOPES = new Set<VenueScope>(['all', 'home', 'away']);
const WINDOWS = new Set([0, 5, 10, 20]);

function selectIndicator(profile: Awaited<ReturnType<typeof getTeamProfile>>, venueScope: VenueScope, windowSize: number) {
  return profile?.indicators.find((item) => item.venueScope === venueScope && item.windowSize === windowSize) ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const teamA = params.get('teamA')?.trim() ?? '';
    const teamB = params.get('teamB')?.trim() ?? '';
    const competitionKey = normalizeCompetitionKey(params.get('competitionKey') ?? params.get('league'));
    const season = params.get('season')?.trim() ?? '';
    const venueScope = (params.get('venueScope') ?? 'all') as VenueScope;
    const windowSize = Number(params.get('window') ?? 10);

    if (!teamA || !teamB) return NextResponse.json({ error: 'Informe teamA e teamB' }, { status: 400 });
    if (!competitionKey) return NextResponse.json({ error: 'Informe league ou competitionKey' }, { status: 400 });
    if (!/^\d{4}$/.test(season)) return NextResponse.json({ error: 'season inválida' }, { status: 400 });
    if (!SCOPES.has(venueScope)) return NextResponse.json({ error: 'venueScope inválido' }, { status: 400 });
    if (!WINDOWS.has(windowSize)) return NextResponse.json({ error: 'window deve ser 0, 5, 10 ou 20' }, { status: 400 });

    const [profileA, profileB] = await Promise.all([
      getTeamProfile({ teamName: teamA, competitionKey, season }),
      getTeamProfile({ teamName: teamB, competitionKey, season }),
    ]);
    if (!profileA || !profileB) return NextResponse.json({ error: 'Uma ou ambas as equipes não foram encontradas' }, { status: 404 });

    const indicatorA = selectIndicator(profileA, venueScope, windowSize);
    const indicatorB = selectIndicator(profileB, venueScope, windowSize);
    if (!indicatorA || !indicatorB) {
      return NextResponse.json({ error: 'Indicadores não encontrados para o filtro informado' }, { status: 404 });
    }

    const metricKeys = [...new Set([
      ...Object.keys(indicatorA.averages), ...Object.keys(indicatorA.rates),
      ...Object.keys(indicatorB.averages), ...Object.keys(indicatorB.rates),
    ])];

    const comparison = Object.fromEntries(metricKeys.map((metric) => [metric, {
      teamA: indicatorA.averages[metric] ?? indicatorA.rates[metric] ?? null,
      teamB: indicatorB.averages[metric] ?? indicatorB.rates[metric] ?? null,
    }]));

    return NextResponse.json({
      competitionKey,
      season,
      venueScope,
      windowSize,
      teams: {
        teamA: { teamKey: profileA.teamKey, name: profileA.name, logo: profileA.logo, sampleSize: indicatorA.sampleSize },
        teamB: { teamKey: profileB.teamKey, name: profileB.name, logo: profileB.logo, sampleSize: indicatorB.sampleSize },
      },
      comparison,
    });
  } catch (error) {
    if (error instanceof PersistentDatabaseNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('[analytics/compare] error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao comparar equipes' }, { status: 500 });
  }
}
