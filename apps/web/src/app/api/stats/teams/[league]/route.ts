import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ league: string }> }
) {
  const { league } = await params;
  const { searchParams } = new URL(request.url);
  const season = searchParams.get('season') || '2026';

  const results = await sql`
    SELECT ts.*, t.name as team_name, t.short_name
    FROM team_stats ts
    LEFT JOIN teams t ON ts.team_id = t.id
    WHERE t.league = ${league} AND ts.season = ${season}
    ORDER BY t.name
  `;

  return NextResponse.json(results);
}
