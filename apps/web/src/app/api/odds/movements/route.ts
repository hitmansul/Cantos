import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

type PriceRow = {
  market_id: number;
  event_id: number;
  competition_name: string | null;
  home_team_name: string;
  away_team_name: string;
  market_name: string;
  selection_label: string;
  line: string | null;
  bookmaker_key: string;
  bookmaker_name: string;
  odd: string;
  captured_at: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ configured: false, movements: [], generatedAt: new Date().toISOString() });
  }

  const searchParams = request.nextUrl.searchParams;
  const windowMinutes = clamp(Number(searchParams.get('minutes') || 30), 5, 180);
  const limit = clamp(Number(searchParams.get('limit') || 100), 10, 250);

  try {
    const rows = (await sql`
      SELECT
        om.id AS market_id,
        oe.id AS event_id,
        oe.competition_name,
        oe.home_team_name,
        oe.away_team_name,
        om.market_name,
        om.selection_label,
        om.line,
        op.bookmaker_key,
        COALESCE(b.name, op.bookmaker_key) AS bookmaker_name,
        op.odd,
        op.captured_at
      FROM odds_prices op
      JOIN odds_markets om ON om.id = op.odds_market_id
      JOIN odds_events oe ON oe.id = om.odds_event_id
      LEFT JOIN bookmakers b ON b.bookmaker_key = op.bookmaker_key
      WHERE op.captured_at >= NOW() - INTERVAL '6 hours'
      ORDER BY op.captured_at DESC
      LIMIT 1500
    `) as PriceRow[];

    const groups = new Map<string, PriceRow[]>();
    for (const row of rows) {
      const key = `${row.market_id}:${row.bookmaker_key}`;
      const current = groups.get(key) || [];
      current.push(row);
      groups.set(key, current);
    }

    const movements = Array.from(groups.values()).flatMap((group) => {
      const sorted = group
        .map((row) => ({ ...row, oddNumber: Number(row.odd), time: new Date(row.captured_at).getTime() }))
        .filter((row) => Number.isFinite(row.oddNumber) && Number.isFinite(row.time))
        .sort((a, b) => a.time - b.time);

      if (sorted.length < 2) return [];
      const latest = sorted[sorted.length - 1];
      const cutoff = latest.time - windowMinutes * 60_000;
      const baseline = [...sorted].reverse().find((row) => row.time <= cutoff) || sorted[0];
      if (!baseline || baseline.time === latest.time || baseline.oddNumber <= 1) return [];

      const absoluteChange = latest.oddNumber - baseline.oddNumber;
      const relativeChangePct = (absoluteChange / baseline.oddNumber) * 100;
      const elapsedMinutes = Math.max(1, (latest.time - baseline.time) / 60_000);
      const velocityPctPerMinute = Math.abs(relativeChangePct) / elapsedMinutes;

      const recent = sorted.filter((row) => row.time >= cutoff);
      const changes = recent.slice(1).map((row, index) => Math.abs(row.oddNumber - recent[index].oddNumber));
      const avgStep = changes.length ? changes.reduce((sum, value) => sum + value, 0) / changes.length : 0;
      const baselineNoisePct = baseline.oddNumber ? (avgStep / baseline.oddNumber) * 100 : 0;
      const noiseAdjusted = Math.abs(relativeChangePct) / Math.max(0.5, baselineNoisePct || 0.5);

      const severityScore = clamp(
        Math.abs(relativeChangePct) * 6 +
        velocityPctPerMinute * 18 +
        Math.min(noiseAdjusted, 8) * 4 +
        Math.min(recent.length, 10) * 1.2
      );

      const severity = severityScore >= 80 ? 'CRÍTICA' : severityScore >= 60 ? 'ALTA' : severityScore >= 40 ? 'MODERADA' : 'NORMAL';
      const direction = relativeChangePct < 0 ? 'QUEDA' : 'ALTA';
      const anomaly = severityScore >= 40;

      return [{
        id: `${latest.market_id}:${latest.bookmaker_key}`,
        eventId: latest.event_id,
        match: `${latest.home_team_name} x ${latest.away_team_name}`,
        competition: latest.competition_name || 'Competição não informada',
        market: latest.market_name,
        selection: latest.selection_label,
        line: latest.line === null ? null : Number(latest.line),
        bookmaker: latest.bookmaker_name,
        previousOdd: baseline.oddNumber,
        currentOdd: latest.oddNumber,
        absoluteChange,
        relativeChangePct,
        velocityPctPerMinute,
        observations: recent.length,
        severityScore,
        severity,
        direction,
        anomaly,
        capturedAt: latest.captured_at,
        baselineAt: baseline.captured_at,
      }];
    })
      .sort((a, b) => b.severityScore - a.severityScore)
      .slice(0, limit);

    return NextResponse.json({
      configured: true,
      windowMinutes,
      movements,
      summary: {
        total: movements.length,
        anomalous: movements.filter((item) => item.anomaly).length,
        critical: movements.filter((item) => item.severity === 'CRÍTICA').length,
        drops: movements.filter((item) => item.direction === 'QUEDA').length,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('odds movement detection failed', error);
    return NextResponse.json(
      { configured: true, movements: [], error: 'Não foi possível analisar o histórico de odds.', generatedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}
