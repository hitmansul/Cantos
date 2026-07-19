import { NextRequest, NextResponse } from 'next/server';
import { recalculateTeamIndicators } from '@/lib/statistics/teamIndicatorEngine';
import { PersistentDatabaseNotConfiguredError } from '@/lib/persistence/database';

function isAuthorized(request: NextRequest) {
  const secret = process.env.HISTORY_IMPORT_SECRET;
  if (!secret) return true;
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const header = request.headers.get('x-import-secret');
  return bearer === secret || header === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const leagueId = String(body?.leagueId ?? '').trim();
    const competitionKey = String(body?.competitionKey ?? (leagueId ? `api-football:${leagueId}` : '')).trim();
    const season = String(body?.season ?? '').trim();

    if (!competitionKey) {
      return NextResponse.json({ error: 'Informe leagueId ou competitionKey' }, { status: 400 });
    }
    if (!/^\d{4}$/.test(season)) {
      return NextResponse.json({ error: 'season inválida. Use o ano com quatro dígitos.' }, { status: 400 });
    }

    const result = await recalculateTeamIndicators(competitionKey, season);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[history/recalculate-indicators] error:', error);
    if (error instanceof PersistentDatabaseNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao recalcular indicadores' },
      { status: 500 },
    );
  }
}
