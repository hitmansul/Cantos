import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ReplayRow = {
  event_id: number;
  home_team_name: string;
  away_team_name: string;
  competition_name: string | null;
  kickoff_at: string | null;
  market_id: number;
  market_name: string;
  selection_label: string;
  line: number | null;
  bookmaker_key: string;
  bookmaker_name: string;
  odd: number;
  captured_at: string;
};

export async function GET(request: NextRequest) {
  const home = (request.nextUrl.searchParams.get('home') ?? '').trim();
  const away = (request.nextUrl.searchParams.get('away') ?? '').trim();
  const marketId = Number(request.nextUrl.searchParams.get('marketId') ?? 0);

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ configured: false, events: [], markets: [], timeline: [] });
  }

  try {
    const rows = await sql<ReplayRow[]>`
      SELECT
        e.id AS event_id,
        e.home_team_name,
        e.away_team_name,
        e.competition_name,
        e.kickoff_at,
        m.id AS market_id,
        m.market_name,
        m.selection_label,
        m.line,
        p.bookmaker_key,
        b.name AS bookmaker_name,
        p.odd,
        p.captured_at
      FROM odds_events e
      JOIN odds_markets m ON m.odds_event_id = e.id
      JOIN odds_prices p ON p.odds_market_id = m.id
      JOIN bookmakers b ON b.bookmaker_key = p.bookmaker_key
      WHERE (${home} = '' OR e.home_team_name ILIKE ${`%${home}%`})
        AND (${away} = '' OR e.away_team_name ILIKE ${`%${away}%`})
        AND (${marketId} = 0 OR m.id = ${marketId})
      ORDER BY e.kickoff_at DESC NULLS LAST, m.id, p.captured_at ASC
      LIMIT 3000
    `;

    const eventMap = new Map<number, { id: number; homeTeam: string; awayTeam: string; competition: string | null; kickoffAt: string | null }>();
    const marketMap = new Map<number, { id: number; eventId: number; marketName: string; selectionLabel: string; line: number | null }>();

    for (const row of rows) {
      eventMap.set(Number(row.event_id), {
        id: Number(row.event_id), homeTeam: row.home_team_name, awayTeam: row.away_team_name,
        competition: row.competition_name, kickoffAt: row.kickoff_at,
      });
      marketMap.set(Number(row.market_id), {
        id: Number(row.market_id), eventId: Number(row.event_id), marketName: row.market_name,
        selectionLabel: row.selection_label, line: row.line === null ? null : Number(row.line),
      });
    }

    const timeline = rows.map((row) => ({
      marketId: Number(row.market_id), bookmakerKey: row.bookmaker_key, bookmaker: row.bookmaker_name,
      odd: Number(row.odd), capturedAt: row.captured_at,
    }));

    return NextResponse.json({ configured: true, events: [...eventMap.values()], markets: [...marketMap.values()], timeline });
  } catch (error) {
    console.error('[odds/replay] Failed to load replay', error);
    return NextResponse.json({ configured: true, events: [], markets: [], timeline: [], error: 'Não foi possível carregar o histórico.' }, { status: 502 });
  }
}
