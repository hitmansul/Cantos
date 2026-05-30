import { NextResponse } from 'next/server';

const AVAILABLE_LEAGUES = [
  {
    key: 'brasileirao_a',
    name: 'Brasileirão Série A',
    country: 'Brasil',
    url: 'https://www.corner-stats.com/brazil/serie-a',
  },
  {
    key: 'brasileirao_b',
    name: 'Brasileirão Série B',
    country: 'Brasil',
    url: 'https://www.corner-stats.com/brazil/serie-b',
  },
  {
    key: 'copa_do_brasil',
    name: 'Copa do Brasil',
    country: 'Brasil',
    url: 'https://www.corner-stats.com/brazil/copa-do-brasil',
  },
];

export async function GET() {
  return NextResponse.json(AVAILABLE_LEAGUES);
}
