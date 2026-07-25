import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { buildLiveIntelligence } from '@/lib/corners/liveIntelligenceEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const sideStatsSchema = z.object({
  dangerousAttacks: z.number().min(0).max(500),
  attacks: z.number().min(0).max(1000).optional(),
  shots: z.number().min(0).max(100),
  shotsOnTarget: z.number().min(0).max(100).optional(),
  crosses: z.number().min(0).max(300).optional(),
  possession: z.number().min(0).max(100).optional(),
  corners: z.number().min(0).max(50),
  goals: z.number().min(0).max(30),
  redCards: z.number().min(0).max(5).optional(),
});

const marketOfferSchema = z.object({
  bookmaker: z.string().min(1).max(80),
  line: z.number().min(0).max(50),
  side: z.enum(['over', 'under']),
  odd: z.number().gt(1).max(100),
});

const previousSnapshotSchema = z.object({
  version: z.string(),
  fixtureKey: z.string().optional(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  minute: z.number(),
  score: z.object({ home: z.number(), away: z.number() }),
  corners: z.object({ home: z.number(), away: z.number(), total: z.number() }),
  pressure: z.object({
    home: z.number(),
    away: z.number(),
    combined: z.number(),
    leader: z.enum(['home', 'away', 'balanced']),
  }),
  momentum: z.object({
    score: z.number(),
    label: z.enum(['very-high', 'high', 'moderate', 'low']),
    leader: z.enum(['home', 'away', 'balanced']),
  }),
  pace: z.number(),
  projectedFinalCorners: z.number(),
  projectedRange: z.object({ min: z.number(), max: z.number() }),
  confidence: z.number(),
  market: z.object({
    bookmaker: z.string(),
    line: z.number(),
    side: z.enum(['over', 'under']),
    odd: z.number(),
    probability: z.number(),
    fairOdd: z.number().nullable(),
    expectedValue: z.number(),
    edge: z.number(),
    recommendedStakePercent: z.number(),
    recommendedStake: z.number().nullable(),
  }).optional(),
  recommendation: z.enum(['bet', 'monitor', 'no-bet', 'market-closed']),
  reasons: z.array(z.string()),
  changeReasons: z.array(z.string()),
  alert: z.string().optional(),
  generatedAt: z.string(),
});

const liveSchema = z.object({
  fixtureKey: z.string().min(1).max(160).optional(),
  homeTeam: z.string().min(1).max(120),
  awayTeam: z.string().min(1).max(120),
  minute: z.number().min(0).max(130),
  addedTime: z.number().min(0).max(30).optional(),
  home: sideStatsSchema,
  away: sideStatsSchema,
  pregameExpectedTotal: z.number().min(1).max(30),
  pregameConfidence: z.number().min(0).max(1),
  previousSnapshot: previousSnapshotSchema.optional(),
  marketOffers: z.array(marketOfferSchema).max(300).optional(),
  bankroll: z.number().positive().max(100000000).optional(),
  riskProfile: z.enum(['conservative', 'balanced', 'aggressive']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = liveSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Dados ao vivo inválidos.', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const snapshot = buildLiveIntelligence(parsed.data);
    return NextResponse.json({
      ok: true,
      snapshot,
      disclaimer: 'A leitura ao vivo depende da qualidade e da atualização dos dados recebidos. Não há garantia de resultado.',
    });
  } catch (error) {
    console.error('Falha no Live Intelligence Engine:', error);
    return NextResponse.json(
      { ok: false, error: 'Não foi possível processar a inteligência ao vivo.' },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'IA Cantos - Live Intelligence Engine',
    endpoint: 'POST /api/ai-corners/live',
    version: '1.0.0',
    capabilities: [
      'pressão ao vivo',
      'momentum',
      'projeção dinâmica de escanteios',
      'EV e Kelly live',
      'detecção de mudança de cenário',
      'alertas explicáveis',
    ],
  });
}
