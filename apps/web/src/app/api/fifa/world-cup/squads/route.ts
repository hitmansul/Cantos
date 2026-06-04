import { NextRequest, NextResponse } from 'next/server';
import { getFifaWorldCupSquads } from '@/lib/fifaWorldCup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 86400;
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === '1';
    const data = await getFifaWorldCupSquads(forceRefresh);

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error('[fifa/world-cup/squads] error:', error);
    return NextResponse.json(
      {
        error: 'Nao foi possivel carregar a lista oficial da FIFA agora.',
        sourceUrl: 'https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf',
      },
      { status: 502 }
    );
  }
}
