import { NextResponse } from 'next/server';
import { apiFootballGet, isApiFootballConfigured } from '@/app/api/utils/apiFootball';
import { buildDynamicCompetition, COMPETITION_REGISTRY } from '@/lib/competitions/competitionRegistry';

type ApiLeague = {
  league?: { id?: number; name?: string; type?: string; logo?: string };
  country?: { name?: string; code?: string; flag?: string };
  seasons?: Array<{
    year?: number;
    current?: boolean;
    coverage?: Record<string, unknown>;
  }>;
};

export async function GET() {
  const registered = Object.values(COMPETITION_REGISTRY);
  if (!isApiFootballConfigured()) {
    return NextResponse.json({
      success: true,
      source: 'registry',
      count: registered.length,
      competitions: registered,
      warning: 'API-Football não configurada; exibindo somente aliases locais.',
    });
  }

  const payload = await apiFootballGet<ApiLeague[]>('/leagues', { revalidate: 6 * 60 * 60 });
  const dynamic = (payload?.response ?? [])
    .filter((item) => item.league?.id && item.league?.name)
    .map((item) => {
      const current = item.seasons?.find((season) => season.current) ?? item.seasons?.at(-1);
      return {
        ...buildDynamicCompetition({
          id: item.league!.id!,
          name: item.league!.name!,
          type: item.league?.type,
          country: item.country?.name,
          season: current?.year,
        }),
        logo: item.league?.logo ?? null,
        countryCode: item.country?.code ?? null,
        countryFlag: item.country?.flag ?? null,
        coverage: current?.coverage ?? {},
      };
    })
    .sort((a, b) => `${a.country ?? ''}-${a.name}`.localeCompare(`${b.country ?? ''}-${b.name}`));

  return NextResponse.json({
    success: true,
    source: 'api-football',
    count: dynamic.length,
    registeredCount: registered.length,
    competitions: dynamic,
    aliases: registered,
    lastUpdated: new Date().toISOString(),
  });
}
