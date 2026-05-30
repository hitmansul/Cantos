import { NextRequest, NextResponse } from 'next/server';

const SOFASCORE_BASE = 'https://api.sofascore.com/api/v1';
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: 'https://www.sofascore.com/',
  Origin: 'https://www.sofascore.com',
  'Cache-Control': 'no-cache',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;

  try {
    const url = `${SOFASCORE_BASE}/event/${matchId}/statistics`;
    const response = await fetch(url, { headers: HEADERS });

    if (!response.ok) {
      throw new Error(`Sofascore API error ${response.status}`);
    }

    const data = (await response.json()) as {
      statistics?: Array<{
        period: string;
        groups: Array<{
          statisticsItems: Array<{
            name: string;
            home: string;
            away: string;
            homeValue: number;
            awayValue: number;
            key: string;
          }>;
        }>;
      }>;
    };

    const statistics = data.statistics || [];
    let homeCorners = 0,
      awayCorners = 0;
    let homeCorners1stHalf = 0,
      awayCorners1stHalf = 0;
    let homeCorners2ndHalf = 0,
      awayCorners2ndHalf = 0;

    for (const period of statistics) {
      for (const group of period.groups) {
        for (const item of group.statisticsItems) {
          if (item.key === 'cornerKicks' || item.name.toLowerCase().includes('corner')) {
            const homeVal = item.homeValue || parseInt(item.home) || 0;
            const awayVal = item.awayValue || parseInt(item.away) || 0;
            if (period.period === 'ALL') {
              homeCorners = homeVal;
              awayCorners = awayVal;
            } else if (period.period === '1ST') {
              homeCorners1stHalf = homeVal;
              awayCorners1stHalf = awayVal;
            } else if (period.period === '2ND') {
              homeCorners2ndHalf = homeVal;
              awayCorners2ndHalf = awayVal;
            }
            break;
          }
        }
      }
    }

    return NextResponse.json({
      matchId: parseInt(matchId),
      homeCorners,
      awayCorners,
      totalCorners: homeCorners + awayCorners,
      homeCorners1stHalf,
      awayCorners1stHalf,
      totalCorners1stHalf: homeCorners1stHalf + awayCorners1stHalf,
      homeCorners2ndHalf,
      awayCorners2ndHalf,
      totalCorners2ndHalf: homeCorners2ndHalf + awayCorners2ndHalf,
      fullStatistics: data,
    });
  } catch (error) {
    console.error('Sofascore match stats error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch match statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
