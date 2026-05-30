import { NextRequest, NextResponse } from 'next/server';

const SOFASCORE_BASE = 'https://api.sofascore.com/api/v1';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  Referer: 'https://www.sofascore.com/',
  Origin: 'https://www.sofascore.com',
};

async function tryFetch(url: string) {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params;
  const { searchParams } = new URL(request.url);
  const seasonId = searchParams.get('seasonId') || '58766';

  const base = `${SOFASCORE_BASE}/unique-tournament/${tournamentId}/season/${seasonId}`;

  // Try multiple strategies in parallel
  const [nextPage0, nextPage1, scheduled] = await Promise.all([
    tryFetch(`${base}/events/next/0`),
    tryFetch(`${base}/events/next/1`),
    tryFetch(`${base}/events/scheduled`),
  ]);

  // Collect all events, deduplicate by id
  const seen = new Set<number>();
  const allEvents: unknown[] = [];

  for (const source of [nextPage0, nextPage1, scheduled]) {
    const events = (source as { events?: unknown[] } | null)?.events ?? [];
    for (const ev of events) {
      const id = (ev as { id?: number }).id;
      if (id && !seen.has(id)) {
        seen.add(id);
        allEvents.push(ev);
      }
    }
  }

  // Sort by startTimestamp ascending
  allEvents.sort((a, b) => {
    const ta = (a as { startTimestamp?: number }).startTimestamp ?? 0;
    const tb = (b as { startTimestamp?: number }).startTimestamp ?? 0;
    return ta - tb;
  });

  return NextResponse.json({ events: allEvents });
}
