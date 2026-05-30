import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { isAdmin } from '@/app/api/utils/adminAuth';

// Teams that are clearly NOT Brazilian — if found labeled as brasileirao_a, it's wrong
const NON_BRAZIL_KEYWORDS = [
  'Columbus Crew',
  'New York City',
  'New York Red Bulls',
  'Atlanta United',
  'Portland',
  'Seattle',
  'LA Galaxy',
  'LAFC',
  'Inter Miami',
  'Fort Wayne',
  'Detroit City',
  'Corpus Christi',
  'Oakland',
  'Tampa Bay',
  'Sacramento',
  'San Jose',
  'Colorado Rapids',
  'DC United',
  'Chicago Fire',
  'Philadelphia Union',
  'Toronto FC',
  'Vancouver Whitecaps',
  'CF Montreal',
  'Real Salt Lake',
  'Arsenal',
  'Chelsea',
  'Liverpool',
  'Manchester',
  'Tottenham',
  'Leicester',
  'Real Madrid',
  'Barcelona',
  'Atletico',
  'Bayern',
  'Dortmund',
  'PSG',
];

function teamContainsNonBrazil(homeTeam: string, awayTeam: string): boolean {
  const teams = `${homeTeam} ${awayTeam}`.toLowerCase();
  return NON_BRAZIL_KEYWORDS.some((kw) => teams.includes(kw.toLowerCase()));
}

export async function GET(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().split('T')[0];
  const matches = await sql`
    SELECT * FROM upcoming_matches
    WHERE match_date < ${today} AND (is_completed = 0 OR is_completed IS NULL)
    ORDER BY match_date DESC, match_time DESC
  `;

  return NextResponse.json(matches);
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    mode: 'old' | 'wrong_league' | 'all_pending';
    cutoffDays?: number;
  };
  const { mode, cutoffDays = 60 } = body;

  let deletedCount = 0;
  const today = new Date().toISOString().split('T')[0];

  if (mode === 'old') {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);
    const cutoff = cutoffDate.toISOString().split('T')[0];
    const result = await sql`
      DELETE FROM upcoming_matches
      WHERE match_date < ${cutoff}
        AND (is_completed = 0 OR is_completed IS NULL)
        AND home_corners IS NULL
      RETURNING id
    `;
    deletedCount = (result as unknown[]).length;
  } else if (mode === 'wrong_league') {
    const pending = (await sql`
      SELECT id, home_team, away_team, league
      FROM upcoming_matches
      WHERE (is_completed = 0 OR is_completed IS NULL)
        AND home_corners IS NULL
        AND league = 'brasileirao_a'
    `) as Array<{ id: number; home_team: string; away_team: string; league: string }>;

    for (const m of pending) {
      if (teamContainsNonBrazil(m.home_team, m.away_team)) {
        await sql`DELETE FROM upcoming_matches WHERE id = ${m.id}`;
        deletedCount++;
      }
    }
  } else if (mode === 'all_pending') {
    const result = await sql`
      DELETE FROM upcoming_matches
      WHERE match_date < ${today}
        AND (is_completed = 0 OR is_completed IS NULL)
        AND home_corners IS NULL
      RETURNING id
    `;
    deletedCount = (result as unknown[]).length;
  }

  return NextResponse.json({
    deleted: deletedCount,
    message: `${deletedCount} partidas removidas (modo: ${mode})`,
  });
}
