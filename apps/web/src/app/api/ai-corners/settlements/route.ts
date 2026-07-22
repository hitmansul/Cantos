import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { settleCornerPrediction, settlePendingPredictionsFromDatabase } from '@/lib/corners/settlementEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const manualSettlementSchema = z.object({
  predictionKey: z.string().uuid(),
  homeCorners: z.number().int().min(0).max(50),
  awayCorners: z.number().int().min(0).max(50),
  sourceKey: z.string().min(1).max(80).optional(),
  notes: z.string().max(500).optional(),
});

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'development';
  return request.headers.get('authorization') === `Bearer ${secret}` || new URL(request.url).searchParams.get('secret') === secret;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const limit = Number(new URL(request.url).searchParams.get('limit') ?? 100);
  const result = await settlePendingPredictionsFromDatabase(limit);
  return NextResponse.json({ ok: true, result });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const parsed = manualSettlementSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Dados inválidos para liquidação.', details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await settleCornerPrediction(parsed.data);
  return NextResponse.json({ ok: result.status !== 'not-found', result }, { status: result.status === 'not-found' ? 404 : 200 });
}
