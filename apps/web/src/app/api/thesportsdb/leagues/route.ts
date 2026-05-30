import { NextResponse } from 'next/server';
import { THESPORTSDB_LEAGUES } from '@/app/api/utils/thesportsdb';

export async function GET() {
  const leagues = Object.entries(THESPORTSDB_LEAGUES).map(([key, value]) => ({
    key,
    ...value,
  }));
  return NextResponse.json(leagues);
}
