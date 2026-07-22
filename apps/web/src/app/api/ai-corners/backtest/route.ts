import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function numberParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      configured: false,
      summary: null,
      byCompetition: [],
      byMarket: [],
      timeline: [],
      bets: [],
      note: 'DATABASE_URL não está configurada. O backtest será habilitado assim que o Decision Warehouse estiver conectado.',
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const minScore = numberParam(searchParams.get('minScore'), 0, 0, 100);
    const minConfidence = numberParam(searchParams.get('minConfidence'), 0, 0, 100);
    const minEv = numberParam(searchParams.get('minEv'), 0, -100, 500) / 100;
    const minKelly = numberParam(searchParams.get('minKelly'), 0, 0, 100) / 100;
    const minOdd = numberParam(searchParams.get('minOdd'), 1.01, 1.01, 100);
    const maxOdd = numberParam(searchParams.get('maxOdd'), 100, 1.01, 100);
    const competition = searchParams.get('competition')?.trim() || null;
    const side = searchParams.get('side') === 'over' || searchParams.get('side') === 'under' ? searchParams.get('side') : null;
    const rating = searchParams.get('rating')?.trim() || null;
    const onlyValue = searchParams.get('onlyValue') !== 'false';
    const dateFrom = searchParams.get('dateFrom') || null;
    const dateTo = searchParams.get('dateTo') || null;
    const limit = Math.trunc(numberParam(searchParams.get('limit'), 200, 1, 1000));

    const rows = await sql`
      SELECT
        p.prediction_key,
        p.model_key,
        p.competition_key,
        p.competition_name,
        p.home_team_name,
        p.away_team_name,
        p.kickoff_at,
        p.score_ia,
        p.confidence_score,
        f.id AS offer_id,
        f.bookmaker,
        f.line,
        f.side,
        f.odd,
        f.model_probability,
        f.expected_value,
        f.edge,
        f.rating,
        f.kelly_fraction,
        f.recommended_stake_percent,
        s.result,
        COALESCE(s.profit_units, 0) AS profit_units,
        s.settled_at
      FROM ai_prediction_runs p
      JOIN ai_prediction_offers f ON f.prediction_run_id = p.id
      JOIN ai_offer_settlements s ON s.prediction_offer_id = f.id
      WHERE s.result IN ('win', 'loss', 'push')
        AND p.score_ia >= ${minScore}
        AND p.confidence_score * 100 >= ${minConfidence}
        AND f.expected_value >= ${minEv}
        AND f.kelly_fraction >= ${minKelly}
        AND f.odd BETWEEN ${minOdd} AND ${maxOdd}
        AND (${competition}::text IS NULL OR COALESCE(p.competition_name, p.competition_key, 'Sem competição') ILIKE '%' || ${competition} || '%')
        AND (${side}::text IS NULL OR f.side = ${side})
        AND (${rating}::text IS NULL OR f.rating = ${rating})
        AND (${onlyValue} = FALSE OR f.is_value_bet = TRUE)
        AND (${dateFrom}::text IS NULL OR COALESCE(p.kickoff_at, p.created_at)::date >= ${dateFrom}::date)
        AND (${dateTo}::text IS NULL OR COALESCE(p.kickoff_at, p.created_at)::date <= ${dateTo}::date)
      ORDER BY COALESCE(s.settled_at, p.created_at) ASC
    ` as Array<Record<string, unknown>>;

    const normalized = rows.map((row) => ({
      ...row,
      score_ia: Number(row.score_ia),
      confidence_score: Number(row.confidence_score),
      line: Number(row.line),
      odd: Number(row.odd),
      model_probability: Number(row.model_probability),
      expected_value: Number(row.expected_value),
      edge: Number(row.edge),
      kelly_fraction: Number(row.kelly_fraction),
      recommended_stake_percent: Number(row.recommended_stake_percent),
      profit_units: Number(row.profit_units),
    }));

    const settled = normalized.length;
    const wins = normalized.filter((row) => row.result === 'win').length;
    const losses = normalized.filter((row) => row.result === 'loss').length;
    const pushes = normalized.filter((row) => row.result === 'push').length;
    const stakeUnits = normalized.filter((row) => row.result !== 'push').length;
    const profitUnits = normalized.reduce((sum, row) => sum + Number(row.profit_units), 0);
    const roiPercent = stakeUnits ? (profitUnits / stakeUnits) * 100 : null;
    const hitRatePercent = wins + losses ? (wins / (wins + losses)) * 100 : null;
    const averageOdd = settled ? normalized.reduce((sum, row) => sum + Number(row.odd), 0) / settled : null;
    const averageEv = settled ? normalized.reduce((sum, row) => sum + Number(row.expected_value), 0) / settled * 100 : null;

    let running = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let longestLosingStreak = 0;
    let currentLosingStreak = 0;
    const timeline = normalized.map((row) => {
      running += Number(row.profit_units);
      peak = Math.max(peak, running);
      maxDrawdown = Math.min(maxDrawdown, running - peak);
      if (row.result === 'loss') {
        currentLosingStreak += 1;
        longestLosingStreak = Math.max(longestLosingStreak, currentLosingStreak);
      } else if (row.result === 'win') {
        currentLosingStreak = 0;
      }
      return {
        date: row.settled_at || row.kickoff_at,
        cumulativeProfit: Number(running.toFixed(4)),
        result: row.result,
      };
    });

    function aggregate(key: 'competition' | 'market') {
      const map = new Map<string, { name: string; settled: number; wins: number; losses: number; pushes: number; profit: number; stakes: number }>();
      for (const row of normalized) {
        const name = key === 'competition'
          ? String(row.competition_name || row.competition_key || 'Sem competição')
          : `${String(row.side).toUpperCase()} ${Number(row.line).toFixed(1)}`;
        const current = map.get(name) ?? { name, settled: 0, wins: 0, losses: 0, pushes: 0, profit: 0, stakes: 0 };
        current.settled += 1;
        current.wins += row.result === 'win' ? 1 : 0;
        current.losses += row.result === 'loss' ? 1 : 0;
        current.pushes += row.result === 'push' ? 1 : 0;
        current.profit += Number(row.profit_units);
        current.stakes += row.result === 'push' ? 0 : 1;
        map.set(name, current);
      }
      return [...map.values()]
        .map((item) => ({ ...item, roiPercent: item.stakes ? item.profit / item.stakes * 100 : null }))
        .sort((a, b) => (b.roiPercent ?? -Infinity) - (a.roiPercent ?? -Infinity));
    }

    return NextResponse.json({
      configured: true,
      filters: { minScore, minConfidence, minEv: minEv * 100, minKelly: minKelly * 100, minOdd, maxOdd, competition, side, rating, onlyValue, dateFrom, dateTo },
      summary: {
        settled,
        wins,
        losses,
        pushes,
        profitUnits,
        roiPercent,
        hitRatePercent,
        averageOdd,
        averageEv,
        maximumDrawdownUnits: maxDrawdown,
        longestLosingStreak,
      },
      byCompetition: aggregate('competition'),
      byMarket: aggregate('market'),
      timeline,
      bets: normalized.slice(-limit).reverse(),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Falha no Backtest Engine:', error);
    return NextResponse.json({ configured: true, error: 'Não foi possível executar o backtest.' }, { status: 500 });
  }
}
