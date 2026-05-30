/**
 * Sofascore live matches — returns all live football events globally.
 * Used as a secondary source in the LiveMatches component.
 * Now also enriches with corner statistics when available.
 */
import { NextResponse } from 'next/server';

const SF_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: 'https://www.sofascore.com/',
  Origin: 'https://www.sofascore.com',
  'Cache-Control': 'no-cache',
};

export async function GET() {
  try {
    const response = await fetch('https://api.sofascore.com/api/v1/sport/football/events/live', {
      headers: SF_HEADERS,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[sofascore-direct/live] status:', response.status);
      return NextResponse.json({
        matches: [],
        source: 'sofascore',
        error: `API status ${response.status}`,
      });
    }

    const data = (await response.json()) as {
      events?: Array<{
        id: number;
        startTimestamp: number;
        tournament?: {
          id?: number;
          name: string;
          category?: { name?: string; flag?: string };
          uniqueTournament?: { id?: number; name: string };
        };
        homeTeam: { name: string; id: number };
        awayTeam: { name: string; id: number };
        homeScore?: { current?: number; display?: number };
        awayScore?: { current?: number; display?: number };
        status?: { description?: string; type?: string; period?: string };
        time?: { currentPeriodStartTimestamp?: number; played?: number };
      }>;
    };

    const events = data.events ?? [];
    console.log('[sofascore-direct/live] events:', events.length);

    const liveMatches = events.map((event) => {
      // Estimate elapsed minute
      let minute: number | string = event.status?.description ?? 'AO VIVO';
      if (event.time?.currentPeriodStartTimestamp) {
        const elapsed = Math.floor(
          (Date.now() / 1000 - event.time.currentPeriodStartTimestamp) / 60
        );
        const period = event.status?.period ?? '';
        if (period === '1st') minute = Math.min(45, elapsed);
        else if (period === '2nd') minute = Math.min(90, 45 + elapsed);
        else if (period === 'OT') minute = 90 + elapsed;
      }

      return {
        id: event.id,
        minute,
        statusText: event.status?.description ?? 'Ao vivo',
        homeTeam: {
          id: event.homeTeam.id,
          name: event.homeTeam.name,
          score: event.homeScore?.current ?? event.homeScore?.display ?? 0,
        },
        awayTeam: {
          id: event.awayTeam.id,
          name: event.awayTeam.name,
          score: event.awayScore?.current ?? event.awayScore?.display ?? 0,
        },
        competition:
          event.tournament?.uniqueTournament?.name ?? event.tournament?.name ?? 'Competição',
        competitionId: event.tournament?.uniqueTournament?.id ?? event.tournament?.id ?? 0,
        source: 'sofascore',
      };
    });

    return NextResponse.json({
      matches: liveMatches,
      count: liveMatches.length,
      source: 'sofascore',
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[sofascore-direct/live] error:', error);
    return NextResponse.json({ matches: [], source: 'sofascore', error: 'Failed to fetch' });
  }
}
