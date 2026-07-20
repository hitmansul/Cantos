import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { projectCornerMarket } from '@/lib/corners/statisticalEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const sampleSchema = z.object({
  cornersFor: z.number().min(0).max(30),
  cornersAgainst: z.number().min(0).max(30),
  venue: z.enum(['home', 'away', 'neutral']).optional(),
  weight: z.number().positive().max(10).optional(),
});

const offerSchema = z.object({
  bookmaker: z.string().min(1).max(80),
  line: z.number().min(0).max(40),
  side: z.enum(['over', 'under']),
  odd: z.number().gt(1).max(100),
});

const projectionSchema = z.object({
  homeTeam: z.string().min(1).max(120),
  awayTeam: z.string().min(1).max(120),
  homeSamples: z.array(sampleSchema).max(50),
  awaySamples: z.array(sampleSchema).max(50),
  leagueAverageTotal: z.number().min(1).max(30).optional(),
  recentFormWeight: z.number().min(0).max(1).optional(),
  marketOffers: z.array(offerSchema).max(300).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = projectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Dados inválidos para a projeção.',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const projection = projectCornerMarket(parsed.data);

    return NextResponse.json({
      ok: true,
      projection,
      disclaimer:
        'A projeção é estatística e não garante resultado. Use gestão de banca e valide a qualidade dos dados de entrada.',
    });
  } catch (error) {
    console.error('Falha ao calcular projeção de escanteios:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Não foi possível calcular a projeção de escanteios.',
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'IA Cantos - Motor Estatístico',
    endpoint: 'POST /api/ai-corners/projection',
    version: '1.0.0',
  });
}
