import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';

type ExtractedStat = {
  metricKey: string;
  metricName: string;
  home: number | null;
  away: number | null;
  period: string;
  parser?: string;
  rawLine?: string;
};

type ParsedPayload = {
  success?: boolean;
  error?: string;
  match?: {
    id: number;
    home_team_id: number | null;
    away_team_id: number | null;
    home_team_name: string;
    away_team_name: string;
    fixture_key: string;
  };
  detected?: {
    homeName?: string;
    awayName?: string;
    homeCode?: string;
    awayCode?: string;
    matchNumber?: number | null;
  };
  extractedStats?: ExtractedStat[];
  parser?: unknown;
  warning?: string | null;
};

function normalize(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isReversed(match: ParsedPayload['match'], detected: ParsedPayload['detected']) {
  if (!match || !detected?.homeName || !detected?.awayName) return false;
  const matchHome = normalize(match.home_team_name);
  const matchAway = normalize(match.away_team_name);
  const detectedHome = normalize(detected.homeName);
  const detectedAway = normalize(detected.awayName);
  return matchHome.includes(detectedAway) && matchAway.includes(detectedHome);
}

async function deleteExisting(matchId: number, teamId: number, period: string, metricKey: string) {
  await sql`
    DELETE FROM world_cup_match_statistics
    WHERE match_id = ${matchId}
      AND team_id = ${teamId}
      AND period = ${period}
      AND metric_key = ${metricKey}
  `;
}

async function insertStat(matchId: number, teamId: number | null, stat: ExtractedStat, value: number | null, pdfUrl: string, side: 'home' | 'away') {
  if (!teamId || value === null || !Number.isFinite(Number(value))) return 0;
  const period = stat.period || 'match';
  await deleteExisting(matchId, teamId, period, stat.metricKey);
  await sql`
    INSERT INTO world_cup_match_statistics (match_id, team_id, period, metric_key, metric_name, value_numeric, source_key, source_payload, source_updated_at)
    VALUES (
      ${matchId},
      ${teamId},
      ${period},
      ${stat.metricKey},
      ${stat.metricName},
      ${Number(value)},
      'fifa',
      ${JSON.stringify({ pdfUrl, side, parser: stat.parser, rawLine: stat.rawLine, importedBy: 'pmsr-safe' })}::jsonb,
      NOW()
    )
  `;
  return 1;
}

async function parseWithCurrentImporter(origin: string, pdfUrl: string) {
  const response = await fetch(`${origin}/api/world-cup/import-fifa-pmsr`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pdfUrl, dryRun: true, allowCreateMatch: true }),
    cache: 'no-store',
  });
  let payload: ParsedPayload;
  try {
    payload = await response.json();
  } catch {
    payload = { success: false, error: await response.text() };
  }
  return { response, payload };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { pdfUrl?: string; url?: string; dryRun?: boolean };
    const pdfUrl = body.pdfUrl ?? body.url;
    if (!pdfUrl || !/^https:\/\//i.test(pdfUrl)) {
      return NextResponse.json({ success: false, error: 'Informe pdfUrl com a URL HTTPS do relatório PMSR da FIFA.' }, { status: 400 });
    }

    const { response, payload } = await parseWithCurrentImporter(request.nextUrl.origin, pdfUrl);
    if (!response.ok || !payload.success || !payload.match) {
      return NextResponse.json({ success: false, error: payload.error ?? 'Parser PMSR não retornou partida válida.', parserStatus: response.status, payload }, { status: response.ok ? 500 : response.status });
    }

    const stats = payload.extractedStats ?? [];
    const reversed = isReversed(payload.match, payload.detected);
    let savedValues = 0;

    if (!body.dryRun) {
      for (const stat of stats) {
        const homeTeamId = reversed ? payload.match.away_team_id : payload.match.home_team_id;
        const awayTeamId = reversed ? payload.match.home_team_id : payload.match.away_team_id;
        const homeValue = reversed ? stat.away : stat.home;
        const awayValue = reversed ? stat.home : stat.away;
        savedValues += await insertStat(payload.match.id, homeTeamId, stat, homeValue, pdfUrl, 'home');
        savedValues += await insertStat(payload.match.id, awayTeamId, stat, awayValue, pdfUrl, 'away');
      }
    }

    return NextResponse.json({
      success: true,
      dryRun: Boolean(body.dryRun),
      match: payload.match,
      detected: payload.detected,
      parser: payload.parser,
      extractedStats: stats,
      savedValues,
      warning: payload.warning ?? null,
      strategy: 'safe-delete-before-insert-create-missing-world-cup-match',
      scope: 'Somente Copa do Mundo: grava em world_cup_matches, world_cup_teams e world_cup_match_statistics.',
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro no importador PMSR seguro.' }, { status: 500 });
  }
}
