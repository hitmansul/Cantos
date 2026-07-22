import sql from '@/app/api/utils/sql';

export type SettlementResult = {
  predictionKey: string;
  status: 'settled' | 'already-settled' | 'not-found';
  homeCorners?: number;
  awayCorners?: number;
  totalCorners?: number;
  offersSettled?: number;
};

type PredictionRow = {
  id: string | number;
  prediction_key: string;
  model_key: string;
  competition_key: string | null;
  created_at: string;
  match_status: string | null;
};

const asNumber = (value: unknown) => Number(value ?? 0);

function offerResult(side: string, line: number, totalCorners: number) {
  if (totalCorners === line) return 'push' as const;
  if (side === 'over') return totalCorners > line ? 'win' as const : 'loss' as const;
  return totalCorners < line ? 'win' as const : 'loss' as const;
}

function profitUnits(result: 'win' | 'loss' | 'push', odd: number, stakePercent: number) {
  const stake = stakePercent > 0 ? stakePercent / 100 : 1;
  if (result === 'win') return stake * (odd - 1);
  if (result === 'loss') return -stake;
  return 0;
}

async function refreshDailyMetrics(modelKey: string, metricDate: string, competitionKey: string | null) {
  const competition = competitionKey || 'all';
  await sql`
    INSERT INTO ai_model_metrics_daily (
      model_key, metric_date, competition_key, market_key,
      predictions, settled_predictions, wins, losses, pushes,
      stake_units, profit_units, roi_percent, hit_rate_percent,
      average_expected_value, calculated_at
    )
    SELECT
      ${modelKey}, ${metricDate}::date, ${competition}, 'corners',
      COUNT(DISTINCT p.id)::int,
      COUNT(DISTINCT p.id) FILTER (WHERE o.match_status = 'finished')::int,
      COUNT(*) FILTER (WHERE s.result = 'win')::int,
      COUNT(*) FILTER (WHERE s.result = 'loss')::int,
      COUNT(*) FILTER (WHERE s.result = 'push')::int,
      COALESCE(SUM(CASE WHEN s.result IN ('win','loss','push') THEN GREATEST(f.recommended_stake_percent / 100, 1) ELSE 0 END), 0),
      COALESCE(SUM(s.profit_units), 0),
      CASE WHEN SUM(CASE WHEN s.result IN ('win','loss','push') THEN GREATEST(f.recommended_stake_percent / 100, 1) ELSE 0 END) > 0
        THEN 100 * SUM(s.profit_units) / SUM(CASE WHEN s.result IN ('win','loss','push') THEN GREATEST(f.recommended_stake_percent / 100, 1) ELSE 0 END)
        ELSE NULL END,
      CASE WHEN COUNT(*) FILTER (WHERE s.result IN ('win','loss')) > 0
        THEN 100.0 * COUNT(*) FILTER (WHERE s.result = 'win') / COUNT(*) FILTER (WHERE s.result IN ('win','loss'))
        ELSE NULL END,
      AVG(f.expected_value) FILTER (WHERE s.result IN ('win','loss','push')),
      NOW()
    FROM ai_prediction_runs p
    LEFT JOIN ai_prediction_outcomes o ON o.prediction_run_id = p.id
    LEFT JOIN ai_prediction_offers f ON f.prediction_run_id = p.id AND f.is_value_bet = TRUE
    LEFT JOIN ai_offer_settlements s ON s.prediction_offer_id = f.id
    WHERE p.model_key = ${modelKey}
      AND p.created_at::date = ${metricDate}::date
      AND COALESCE(p.competition_key, 'all') = ${competition}
    ON CONFLICT (model_key, metric_date, competition_key, market_key)
    DO UPDATE SET
      predictions = EXCLUDED.predictions,
      settled_predictions = EXCLUDED.settled_predictions,
      wins = EXCLUDED.wins,
      losses = EXCLUDED.losses,
      pushes = EXCLUDED.pushes,
      stake_units = EXCLUDED.stake_units,
      profit_units = EXCLUDED.profit_units,
      roi_percent = EXCLUDED.roi_percent,
      hit_rate_percent = EXCLUDED.hit_rate_percent,
      average_expected_value = EXCLUDED.average_expected_value,
      calculated_at = NOW()
  `;
}

export async function settleCornerPrediction(input: {
  predictionKey: string;
  homeCorners: number;
  awayCorners: number;
  sourceKey?: string;
  sourcePayload?: unknown;
  notes?: string;
}): Promise<SettlementResult> {
  if (!process.env.DATABASE_URL) return { predictionKey: input.predictionKey, status: 'not-found' };

  const rows = await sql<PredictionRow[]>`
    SELECT p.id, p.prediction_key, p.model_key, p.competition_key, p.created_at, o.match_status
    FROM ai_prediction_runs p
    LEFT JOIN ai_prediction_outcomes o ON o.prediction_run_id = p.id
    WHERE p.prediction_key = ${input.predictionKey}
    LIMIT 1
  `;
  const prediction = rows[0];
  if (!prediction) return { predictionKey: input.predictionKey, status: 'not-found' };
  if (prediction.match_status === 'finished') return { predictionKey: input.predictionKey, status: 'already-settled' };

  const homeCorners = Math.max(0, Math.trunc(input.homeCorners));
  const awayCorners = Math.max(0, Math.trunc(input.awayCorners));
  const totalCorners = homeCorners + awayCorners;

  await sql`
    INSERT INTO ai_prediction_outcomes (
      prediction_run_id, home_corners, away_corners, total_corners,
      match_status, settled_at, source_key, source_payload, notes, updated_at
    ) VALUES (
      ${prediction.id}, ${homeCorners}, ${awayCorners}, ${totalCorners},
      'finished', NOW(), ${input.sourceKey ?? 'manual'}, ${JSON.stringify(input.sourcePayload ?? {})}::jsonb,
      ${input.notes ?? null}, NOW()
    )
    ON CONFLICT (prediction_run_id) DO UPDATE SET
      home_corners = EXCLUDED.home_corners,
      away_corners = EXCLUDED.away_corners,
      total_corners = EXCLUDED.total_corners,
      match_status = 'finished',
      settled_at = NOW(),
      source_key = EXCLUDED.source_key,
      source_payload = EXCLUDED.source_payload,
      notes = EXCLUDED.notes,
      updated_at = NOW()
  `;

  const offers = await sql<Array<{ id: string | number; side: string; line: string | number; odd: string | number; recommended_stake_percent: string | number }>>`
    SELECT id, side, line, odd, recommended_stake_percent
    FROM ai_prediction_offers
    WHERE prediction_run_id = ${prediction.id} AND is_value_bet = TRUE
  `;

  for (const offer of offers) {
    const result = offerResult(offer.side, asNumber(offer.line), totalCorners);
    const profit = profitUnits(result, asNumber(offer.odd), asNumber(offer.recommended_stake_percent));
    await sql`
      INSERT INTO ai_offer_settlements (prediction_offer_id, result, profit_units, settled_at, updated_at)
      VALUES (${offer.id}, ${result}, ${profit}, NOW(), NOW())
      ON CONFLICT (prediction_offer_id) DO UPDATE SET
        result = EXCLUDED.result,
        profit_units = EXCLUDED.profit_units,
        settled_at = NOW(),
        updated_at = NOW()
    `;
  }

  const metricDate = new Date(prediction.created_at).toISOString().slice(0, 10);
  await refreshDailyMetrics(prediction.model_key, metricDate, prediction.competition_key);

  return { predictionKey: input.predictionKey, status: 'settled', homeCorners, awayCorners, totalCorners, offersSettled: offers.length };
}

export async function settlePendingPredictionsFromDatabase(limit = 100) {
  if (!process.env.DATABASE_URL) return { checked: 0, settled: 0, skipped: 0, results: [] as SettlementResult[] };
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));

  const candidates = await sql<Array<{ prediction_key: string; home_corners: string | number | null; away_corners: string | number | null }>>`
    SELECT
      p.prediction_key,
      SUM(CASE WHEN s.team_id = m.home_team_id THEN s.value_numeric ELSE 0 END) AS home_corners,
      SUM(CASE WHEN s.team_id = m.away_team_id THEN s.value_numeric ELSE 0 END) AS away_corners
    FROM ai_prediction_runs p
    JOIN ai_prediction_outcomes o ON o.prediction_run_id = p.id AND o.match_status = 'pending'
    JOIN world_cup_matches m ON (
      (p.fixture_key IS NOT NULL AND p.fixture_key = m.fixture_key)
      OR (
        LOWER(p.home_team_name) = LOWER(m.home_team_name)
        AND LOWER(p.away_team_name) = LOWER(m.away_team_name)
        AND (p.kickoff_at IS NULL OR m.kickoff_at IS NULL OR ABS(EXTRACT(EPOCH FROM (p.kickoff_at - m.kickoff_at))) < 86400)
      )
    )
    JOIN world_cup_match_statistics s ON s.match_id = m.id
      AND (LOWER(s.metric_key) LIKE '%corner%' OR LOWER(s.metric_name) LIKE '%corner%')
      AND s.period = 'match'
    WHERE m.status IN ('finished', 'completed', 'after penalties', 'after extra time')
    GROUP BY p.prediction_key, m.id
    HAVING COUNT(s.id) >= 2
    LIMIT ${safeLimit}
  `;

  const results: SettlementResult[] = [];
  for (const candidate of candidates) {
    if (candidate.home_corners == null || candidate.away_corners == null) continue;
    results.push(await settleCornerPrediction({
      predictionKey: candidate.prediction_key,
      homeCorners: asNumber(candidate.home_corners),
      awayCorners: asNumber(candidate.away_corners),
      sourceKey: 'persistent-match-statistics',
      sourcePayload: { automatic: true },
      notes: 'Liquidação automática pelo pipeline pós-jogo.',
    }));
  }

  return {
    checked: candidates.length,
    settled: results.filter((item) => item.status === 'settled').length,
    skipped: candidates.length - results.filter((item) => item.status === 'settled').length,
    results,
  };
}
