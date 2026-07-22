import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { projectCornerMarket } from '@/lib/corners/statisticalEngine';
import { calculateOpportunityScore } from '@/lib/corners/opportunityScore';
import { persistCornerDecision } from '@/lib/corners/decisionWarehouse';

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
  fixtureKey: z.string().min(1).max(160).optional(),
  competitionKey: z.string().min(1).max(120).optional(),
  competitionName: z.string().min(1).max(160).optional(),
  kickoffAt: z.string().datetime({ offset: true }).optional(),
  homeTeam: z.string().min(1).max(120),
  awayTeam: z.string().min(1).max(120),
  homeSamples: z.array(sampleSchema).min(3).max(50),
  awaySamples: z.array(sampleSchema).min(3).max(50),
  leagueAverageTotal: z.number().min(1).max(30).optional(),
  recentFormWeight: z.number().min(0).max(1).optional(),
  marketOffers: z.array(offerSchema).max(300).optional(),
  bankroll: z.number().positive().max(100000000).optional(),
  riskProfile: z.enum(['conservative', 'balanced', 'aggressive']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = projectionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Dados inválidos para a projeção.', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = projectCornerMarket(parsed.data);
    const opportunityScore = calculateOpportunityScore(result);
    const projection = {
      expectedHomeCorners: result.expectedHomeCorners,
      expectedAwayCorners: result.expectedAwayCorners,
      expectedTotalCorners: result.expectedTotalCorners,
      confidence: result.confidenceLabel,
      confidenceScore: result.confidence,
      sampleSize: result.sampleSize,
      volatility: result.volatility,
      projectedRange: result.projectedRange,
      scenarios: result.scenarios,
      summary: result.summary,
      decision: result.decision,
      decisionReason: result.decisionReason,
      opportunityScore,
      factors: result.factors,
      offers: result.evaluatedOffers.map((offer) => ({
        bookmaker: offer.bookmaker,
        line: offer.line,
        side: offer.side,
        odd: offer.odd,
        probability: offer.modelProbability,
        fairOdd: offer.fairOdd,
        expectedValue: offer.expectedValue,
        edge: offer.edge,
        isValueBet: offer.isValueBet,
        rating: offer.rating,
        explanation: offer.explanation,
        kellyFraction: offer.kellyFraction,
        recommendedStakePercent: offer.recommendedStakePercent,
        recommendedStake: offer.recommendedStake,
        riskLevel: offer.riskLevel,
      })),
    };

    const predictionKey = await persistCornerDecision({
      fixtureKey: parsed.data.fixtureKey,
      competitionKey: parsed.data.competitionKey,
      competitionName: parsed.data.competitionName,
      kickoffAt: parsed.data.kickoffAt,
      homeTeam: parsed.data.homeTeam,
      awayTeam: parsed.data.awayTeam,
      expectedHomeCorners: result.expectedHomeCorners,
      expectedAwayCorners: result.expectedAwayCorners,
      expectedTotalCorners: result.expectedTotalCorners,
      projectedRange: result.projectedRange,
      scoreIa: opportunityScore.total,
      confidenceScore: result.confidence,
      confidenceLabel: result.confidenceLabel,
      volatility: result.volatility,
      sampleSize: result.sampleSize,
      decision: result.decision,
      decisionReason: result.decisionReason,
      summary: result.summary,
      riskProfile: parsed.data.riskProfile,
      bankroll: parsed.data.bankroll,
      factors: result.factors,
      scenarios: result.scenarios,
      requestSnapshot: parsed.data,
      responseSnapshot: projection,
      offers: projection.offers,
    });

    return NextResponse.json({
      ok: true,
      predictionKey,
      projection,
      disclaimer: 'A análise é estatística, não garante resultado e deve ser combinada com gestão de banca, conferência das escalações e atualização das odds.',
    });
  } catch (error) {
    console.error('Falha ao calcular projeção de escanteios:', error);
    return NextResponse.json(
      { ok: false, error: 'Não foi possível calcular a projeção de escanteios.' },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'IA Cantos - Motor Estatístico Explicável',
    endpoint: 'POST /api/ai-corners/projection',
    version: '4.1.0',
    decisionWarehouse: true,
  });
}
