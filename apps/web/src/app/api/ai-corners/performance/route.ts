import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SummaryRow = {
  model_key: string;
  model_name: string;
  model_version: string;
  status: string;
  predictions: number;
  settled_offers: number;
  wins: number;
  losses: number;
  pushes: number;
  stake_units: number;
  profit_units: number;
  roi_percent: number | null;
  hit_rate_percent: number | null;
  average_expected_value: number | null;
};

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      configured: false,
      models: [],
      competitions: [],
      markets: [],
      calibration: [],
      note: 'DATABASE_URL não configurada.',
    });
  }

  try {
    const models = await sql<SummaryRow[]>`
      SELECT
        v.model_key,
        v.name AS model_name,
        v.version AS model_version,
        v.status,
        COUNT(DISTINCT p.id)::int AS predictions,
        COUNT(s.prediction_offer_id)::int AS settled_offers,
        COUNT(*) FILTER (WHERE s.result = 'win')::int AS wins,
        COUNT(*) FILTER (WHERE s.result = 'loss')::int AS losses,
        COUNT(*) FILTER (WHERE s.result = 'push')::int AS pushes,
        COALESCE(SUM(CASE WHEN s.result IN ('win', 'loss', 'push') THEN 1 ELSE 0 END), 0)::float AS stake_units,
        COALESCE(SUM(s.profit_units), 0)::float AS profit_units,
        CASE
          WHEN COUNT(*) FILTER (WHERE s.result IN ('win', 'loss', 'push')) > 0
          THEN ROUND((SUM(COALESCE(s.profit_units, 0)) / COUNT(*) FILTER (WHERE s.result IN ('win', 'loss', 'push'))) * 100, 2)
          ELSE NULL
        END::float AS roi_percent,
        CASE
          WHEN COUNT(*) FILTER (WHERE s.result IN ('win', 'loss')) > 0
          THEN ROUND((COUNT(*) FILTER (WHERE s.result = 'win')::numeric / COUNT(*) FILTER (WHERE s.result IN ('win', 'loss'))) * 100, 2)
          ELSE NULL
        END::float AS hit_rate_percent,
        ROUND(AVG(o.expected_value) FILTER (WHERE s.result IN ('win', 'loss', 'push')) * 100, 2)::float AS average_expected_value
      FROM ai_model_versions v
      LEFT JOIN ai_prediction_runs p ON p.model_key = v.model_key
      LEFT JOIN ai_prediction_offers o ON o.prediction_run_id = p.id AND o.is_value_bet = TRUE
      LEFT JOIN ai_offer_settlements s ON s.prediction_offer_id = o.id AND s.result <> 'pending'
      GROUP BY v.model_key, v.name, v.version, v.status
      ORDER BY CASE v.status WHEN 'production' THEN 1 WHEN 'challenger' THEN 2 WHEN 'experimental' THEN 3 ELSE 4 END, roi_percent DESC NULLS LAST
    `;

    const competitions = await sql`
      SELECT
        COALESCE(p.competition_name, p.competition_key, 'Não informada') AS name,
        COUNT(s.prediction_offer_id)::int AS settled,
        COUNT(*) FILTER (WHERE s.result = 'win')::int AS wins,
        COUNT(*) FILTER (WHERE s.result = 'loss')::int AS losses,
        ROUND(COALESCE(SUM(s.profit_units), 0), 2)::float AS profit_units,
        CASE WHEN COUNT(*) FILTER (WHERE s.result IN ('win', 'loss', 'push')) > 0
          THEN ROUND((SUM(COALESCE(s.profit_units, 0)) / COUNT(*) FILTER (WHERE s.result IN ('win', 'loss', 'push'))) * 100, 2)
          ELSE NULL END::float AS roi_percent
      FROM ai_prediction_runs p
      JOIN ai_prediction_offers o ON o.prediction_run_id = p.id AND o.is_value_bet = TRUE
      JOIN ai_offer_settlements s ON s.prediction_offer_id = o.id AND s.result <> 'pending'
      GROUP BY COALESCE(p.competition_name, p.competition_key, 'Não informada')
      ORDER BY roi_percent DESC NULLS LAST, settled DESC
      LIMIT 20
    `;

    const markets = await sql`
      SELECT
        CONCAT(INITCAP(o.side), ' ', o.line) AS name,
        COUNT(s.prediction_offer_id)::int AS settled,
        COUNT(*) FILTER (WHERE s.result = 'win')::int AS wins,
        COUNT(*) FILTER (WHERE s.result = 'loss')::int AS losses,
        ROUND(COALESCE(SUM(s.profit_units), 0), 2)::float AS profit_units,
        CASE WHEN COUNT(*) FILTER (WHERE s.result IN ('win', 'loss', 'push')) > 0
          THEN ROUND((SUM(COALESCE(s.profit_units, 0)) / COUNT(*) FILTER (WHERE s.result IN ('win', 'loss', 'push'))) * 100, 2)
          ELSE NULL END::float AS roi_percent
      FROM ai_prediction_offers o
      JOIN ai_offer_settlements s ON s.prediction_offer_id = o.id AND s.result <> 'pending'
      WHERE o.is_value_bet = TRUE
      GROUP BY o.side, o.line
      ORDER BY roi_percent DESC NULLS LAST, settled DESC
      LIMIT 20
    `;

    const calibration = await sql`
      SELECT
        FLOOR(o.model_probability * 20) * 5 AS band_start,
        LEAST(100, FLOOR(o.model_probability * 20) * 5 + 5) AS band_end,
        COUNT(*)::int AS samples,
        ROUND(AVG(o.model_probability) * 100, 2)::float AS predicted_percent,
        ROUND(AVG(CASE WHEN s.result = 'win' THEN 1.0 WHEN s.result = 'loss' THEN 0.0 ELSE NULL END) * 100, 2)::float AS actual_percent
      FROM ai_prediction_offers o
      JOIN ai_offer_settlements s ON s.prediction_offer_id = o.id
      WHERE o.is_value_bet = TRUE AND s.result IN ('win', 'loss')
      GROUP BY FLOOR(o.model_probability * 20)
      ORDER BY band_start
    `;

    return NextResponse.json({ configured: true, models, competitions, markets, calibration, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Falha ao avaliar performance da IA:', error);
    return NextResponse.json({ configured: true, models: [], competitions: [], markets: [], calibration: [], error: 'Não foi possível calcular as métricas. Confirme se as migrations do Decision Warehouse foram executadas.' }, { status: 500 });
  }
}
