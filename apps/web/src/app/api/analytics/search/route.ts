import { NextRequest, NextResponse } from 'next/server';
import { searchTeams } from '@/lib/analytics/footballAnalyticsRepository';
import { PersistentDatabaseNotConfiguredError } from '@/lib/persistence/database';

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') ?? 10) || 10, 1), 30);
    if (query.length < 2) return NextResponse.json({ error: 'Digite pelo menos 2 caracteres' }, { status: 400 });

    const rows = await searchTeams(query, limit);
    return NextResponse.json({
      query,
      total: rows.length,
      teams: rows.map((row) => ({
        teamKey: String(row.team_key),
        name: String(row.name),
        country: row.country ? String(row.country) : null,
        logo: row.logo_url ? String(row.logo_url) : null,
      })),
    });
  } catch (error) {
    if (error instanceof PersistentDatabaseNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('[analytics/search] error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha na pesquisa' }, { status: 500 });
  }
}
