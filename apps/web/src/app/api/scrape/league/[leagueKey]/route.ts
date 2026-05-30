import { NextRequest, NextResponse } from 'next/server';

const LEAGUE_URLS: Record<string, { url: string; name: string }> = {
  brasileirao_a: {
    url: 'https://www.corner-stats.com/brazil/serie-a',
    name: 'Brasileirão Série A',
  },
  brasileirao_b: {
    url: 'https://www.corner-stats.com/brazil/serie-b',
    name: 'Brasileirão Série B',
  },
  copa_do_brasil: {
    url: 'https://www.corner-stats.com/brazil/copa-do-brasil',
    name: 'Copa do Brasil',
  },
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leagueKey: string }> }
) {
  const { leagueKey } = await params;
  const leagueInfo = LEAGUE_URLS[leagueKey];

  if (!leagueInfo) {
    return NextResponse.json({ error: 'League not found' }, { status: 404 });
  }

  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL_API_KEY) {
    return NextResponse.json({ error: 'Firecrawl API key not configured' }, { status: 500 });
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: leagueInfo.url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Firecrawl error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({
      league: leagueKey,
      leagueName: leagueInfo.name,
      content: data.data?.markdown || '',
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Scrape league error:', error);
    return NextResponse.json(
      {
        error: 'Failed to scrape data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
