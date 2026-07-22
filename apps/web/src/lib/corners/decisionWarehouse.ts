import { randomUUID } from 'node:crypto';
import sql from '@/app/api/utils/sql';

export const CURRENT_CORNER_MODEL_KEY = 'corners-statistical-v4';

export type StoredOffer = {
  bookmaker: string;
  line: number;
  side: 'over' | 'under';
  odd: number;
  probability: number;
  fairOdd: number;
  expectedValue: number;
  edge: number;
  isValueBet: boolean;
  rating?: string | null;
  explanation?: string | null;
  kellyFraction: number;
  recommendedStakePercent: number;
  recommendedStake?: number | null;
  riskLevel?: string | null;
};

export type DecisionWarehouseInput = {
  fixtureKey?: string;
  competitionKey?: string;
  competitionName?: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt?: string;
  expectedHomeCorners: number;
  expectedAwayCorners: number;
  expectedTotalCorners: number;
  projectedRange?: { low?: number; high?: number } | number[];
  scoreIa: number;
  confidenceScore: number;
  confidenceLabel?: string;
  volatility?: number;
  sampleSize: number;
  decision: string;
  decisionReason?: string;
  summary?: string;
  riskProfile?: string;
  bankroll?: number;
  factors?: unknown;
  scenarios?: unknown;
  requestSnapshot?: unknown;
  responseSnapshot?: unknown;
  offers: StoredOffer[];
};

type PredictionIdRow = { id: string | number };

function rangeBounds(range: DecisionWarehouseInput['projectedRange']) {
  if (Array.isArray(range)) {
    return { low: range[0] ?? null, high: range[1] ?? null };
  }

  return {
    low: range?.low ?? null,
    high: range?.high ?? null,
  };
}

/**
 * Persists a complete, immutable model decision snapshot.
 * Persistence is intentionally best-effort: projections must continue working
 * when DATABASE_URL is absent or the migration has not yet been executed.
 */
export async function persistCornerDecision(input: DecisionWarehouseInput): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;

  const predictionKey = randomUUID();
  const range = rangeBounds(input.projectedRange);

  try {
    const rows = await sql<PredictionIdRow[]>`
      INSERT INTO ai_prediction_runs (
        prediction_key,
        model_key,
        fixture_key,
        competition_key,
        competition_name,
        home_team_name,
        away_team_name,
        kickoff_at,
        expected_home_corners,
        expected_away_corners,
        expected_total_corners,
        projected_low,
        projected_high,
        score_ia,
        confidence_score,
        confidence_label,
        volatility,
        sample_size,
        decision,
        decision_reason,
        summary,
        risk_profile,
        bankroll,
        factors,
        scenarios,
        request_snapshot,
        response_snapshot
      ) VALUES (
        ${predictionKey},
        ${CURRENT_CORNER_MODEL_KEY},
        ${input.fixtureKey ?? null},
        ${input.competitionKey ?? null},
        ${input.competitionName ?? null},
        ${input.homeTeam},
        ${input.awayTeam},
        ${input.kickoffAt ?? null},
        ${input.expectedHomeCorners},
        ${input.expectedAwayCorners},
        ${input.expectedTotalCorners},
        ${range.low},
        ${range.high},
        ${input.scoreIa},
        ${input.confidenceScore},
        ${input.confidenceLabel ?? null},
        ${input.volatility ?? null},
        ${input.sampleSize},
        ${input.decision},
        ${input.decisionReason ?? null},
        ${input.summary ?? null},
        ${input.riskProfile ?? null},
        ${input.bankroll ?? null},
        ${JSON.stringify(input.factors ?? {})}::jsonb,
        ${JSON.stringify(input.scenarios ?? [])}::jsonb,
        ${JSON.stringify(input.requestSnapshot ?? {})}::jsonb,
        ${JSON.stringify(input.responseSnapshot ?? {})}::jsonb
      )
      RETURNING id
    `;

    const predictionRunId = rows[0]?.id;
    if (!predictionRunId) return null;

    for (const offer of input.offers) {
      await sql`
        INSERT INTO ai_prediction_offers (
          prediction_run_id,
          bookmaker,
          line,
          side,
          odd,
          model_probability,
          fair_odd,
          expected_value,
          edge,
          is_value_bet,
          rating,
          kelly_fraction,
          recommended_stake_percent,
          recommended_stake,
          risk_level,
          explanation
        ) VALUES (
          ${predictionRunId},
          ${offer.bookmaker},
          ${offer.line},
          ${offer.side},
          ${offer.odd},
          ${offer.probability},
          ${offer.fairOdd},
          ${offer.expectedValue},
          ${offer.edge},
          ${offer.isValueBet},
          ${offer.rating ?? null},
          ${offer.kellyFraction},
          ${offer.recommendedStakePercent},
          ${offer.recommendedStake ?? null},
          ${offer.riskLevel ?? null},
          ${offer.explanation ?? null}
        )
        ON CONFLICT DO NOTHING
      `;
    }

    await sql`
      INSERT INTO ai_prediction_outcomes (prediction_run_id, match_status)
      VALUES (${predictionRunId}, 'pending')
      ON CONFLICT (prediction_run_id) DO NOTHING
    `;

    return predictionKey;
  } catch (error) {
    console.error('Decision Warehouse indisponível; projeção não foi interrompida:', error);
    return null;
  }
}

export async function listRecentCornerDecisions(limit = 50) {
  if (!process.env.DATABASE_URL) return [];
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));

  return sql`
    SELECT
      p.prediction_key,
      p.fixture_key,
      p.competition_key,
      p.competition_name,
      p.home_team_name,
      p.away_team_name,
      p.kickoff_at,
      p.expected_total_corners,
      p.score_ia,
      p.confidence_score,
      p.confidence_label,
      p.volatility,
      p.sample_size,
      p.decision,
      p.decision_reason,
      p.created_at,
      o.match_status,
      o.total_corners,
      o.settled_at,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'bookmaker', f.bookmaker,
            'line', f.line,
            'side', f.side,
            'odd', f.odd,
            'probability', f.model_probability,
            'expectedValue', f.expected_value,
            'isValueBet', f.is_value_bet,
            'kellyFraction', f.kelly_fraction,
            'recommendedStakePercent', f.recommended_stake_percent
          ) ORDER BY f.expected_value DESC
        ) FILTER (WHERE f.id IS NOT NULL),
        '[]'::jsonb
      ) AS offers
    FROM ai_prediction_runs p
    LEFT JOIN ai_prediction_outcomes o ON o.prediction_run_id = p.id
    LEFT JOIN ai_prediction_offers f ON f.prediction_run_id = p.id
    GROUP BY p.id, o.prediction_run_id
    ORDER BY p.created_at DESC
    LIMIT ${safeLimit}
  `;
}
