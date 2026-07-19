import { NextRequest, NextResponse } from 'next/server';
import { getMatchIntelligence } from '@/lib/analytics/matchIntelligenceEngine';
import { PersistentDatabaseNotConfiguredError } from '@/lib/persistence/database';

export async function GET(request: NextRequest) {
  const fixtureId = request.nextUrl.searchParams.get('fixtureId')?.trim() ?? '';
  if (!fixtureId) return NextResponse.json({ error: 'Informe fixtureId' }, { status: 400 });

  try {
    const context = await getMatchIntelligence(fixtureId);
    if (!context) return NextResponse.json({ error: 'Partida não encontrada no histórico' }, { status: 404 });
    return NextResponse.json(context);
  } catch (error) {
    if (error instanceof PersistentDatabaseNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('[analytics/match] error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao gerar inteligência da partida' }, { status: 500 });
  }
}
