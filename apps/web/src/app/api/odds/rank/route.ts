import { NextRequest, NextResponse } from 'next/server';
import {
  BettingPreferences,
  OddsOfferInput,
  rankOddsOffers,
} from '@/lib/odds/bettingPreferencesEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RankRequest = {
  offers?: OddsOfferInput[];
  preferences?: BettingPreferences;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RankRequest;
    if (!Array.isArray(body.offers)) {
      return NextResponse.json(
        { error: 'O campo offers deve ser uma lista de ofertas.' },
        { status: 400 }
      );
    }

    return NextResponse.json(rankOddsOffers(body.offers, body.preferences));
  } catch (error) {
    console.error('[odds/rank] Failed to rank bookmaker offers', error);
    return NextResponse.json(
      { error: 'Não foi possível comparar as casas neste momento.' },
      { status: 500 }
    );
  }
}
