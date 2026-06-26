import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';

const WORLD_CUP_2026_KEY = 'world_cup_2026';

type MatchRow = {
  id: number;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team_name: string;
  away_team_name: string;
  fixture_key: string;
};

type ExtractedStat = {
  metricKey: string;
  metricName: string;
  home: number | null;
  away: number | null;
  period?: string;
};

const TEAM_ALIASES: Record<string, string> = {
  bra: 'brazil',
  brazil: 'brazil',
  brasil: 'brazil',
  sco: 'scotland',
  scotland: 'scotland',
  escocia: 'scotland',
  cze: 'czechia',
  czechia: 'czechia',
  tchequia: 'czechia',
  'czech republic': 'czechia',
  mex: 'mexico',
  mexico: 'mexico',
  kor: 'korea republic',
  korea: 'korea republic',
  'korea republic': 'korea republic',
  'south korea': 'korea republic',
  rsa: 'south africa',
  'south africa': 'south africa',
  zaf: 'south africa',
  mar: 'morocco',
  morocco: 'morocco',
  marrocos: 'morocco',
  hai: 'haiti',
  haiti: 'haiti',
  sui: 'switzerland',
  switzerland: 'switzerland',
  suica: 'switzerland',
  can: 'canada',
  canada: 'canada',
  usa: 'usa',
  eua: 'usa',
  'united states': 'usa',
  tur: 'turkiye',
  turkiye: 'turkiye',
  turkey: 'turkiye',
  turquia: 'turkiye',
};

const CODE_ALIASES: Record<string, string> = {
  CZE: 'czechia',
  MEX: 'mexico',
  BRA: 'brazil',
  SCO: 'scotland',
  KOR: 'korea republic',
  RSA: 'south africa',
  ZAF: 'south africa',
  MAR: 'morocco',
  HAI: 'haiti',
  SUI: 'switzerland',
  CAN: 'canada',
  USA: 'usa',
  TUR: 'turkiye',
};

const METRIC_PATTERNS: Array<{ key: string; name: string; patterns: RegExp[] }> = [
  { key: 'possession', name: 'Posse de bola', patterns: [/possession\s+(\d{1,3})\s*%?\s+(\d{1,3})\s*%?/i, /posse(?:\s+de\s+bola)?\s+(\d{1,3})\s*%?\s+(\d{1,3})\s*%?/i] },
  { key: 'shots', name: 'Finalizações', patterns: [/total\s+(?:attempts|shots)\s+(\d+)\s+(\d+)/i, /(?:shots|attempts)\s+(\d+)\s+(\d+)/i, /finaliza(?:coes|ções)\s+(\d+)\s+(\d+)/i] },
  { key: 'shots_on_target', name: 'Finalizações no gol', patterns: [/(?:shots|attempts)\s+on\s+target\s+(\d+)\s+(\d+)/i, /(?:on\s+target)\s+(\d+)\s+(\d+)/i, /(?:chutes|finaliza(?:coes|ções))\s+no\s+gol\s+(\d+)\s+(\d+)/i] },
  { key: 'corners', name: 'Escanteios', patterns: [/(?:corners|corner\s+kicks)\s+(\d+)\s+(\d+)/i, /escanteios\s+(\d+)\s+(\d+)/i] },
  { key: 'yellow_cards', name: 'Cartões amarelos', patterns: [/yellow\s+cards\s+(\d+)\s+(\d+)/i, /cart(?:oes|ões)\s+amarelos\s+(\d+)\s+(\d+)/i] },
  { key: 'red_cards', name: 'Cartões vermelhos', patterns: [/red\s+cards\s+(\d+)\s+(\d+)/i, /cart(?:oes|ões)\s+vermelhos\s+(\d+)\s+(\d+)/i] },
  { key: 'fouls', name: 'Faltas', patterns: [/fouls\s+(?:committed\s+)?(\d+)\s+(\d+)/i, /faltas\s+(\d+)\s+(\d+)/i] },
  { key: 'offsides', name: 'Impedimentos', patterns: [/offsides\s+(\d+)\s+(\d+)/i, /impedimentos\s+(\d+)\s+(\d+)/i] },
  { key: 'passes', name: 'Passes totais', patterns: [/total\s+passes\s+(\d+)\s+(\d+)/i, /passes\s+(?:totais\s+)?(\d+)\s+(\d+)/i] },
  { key: 'pass_accuracy', name: 'Precisão de passes', patterns: [/pass(?:ing)?\s+accuracy\s+(\d{1,3})\s*%?\s+(\d{1,3})\s*%?/i, /precis(?:ao|ão)\s+de\s+passes\s+(\d{1,3})\s*%?\s+(\d{1,3})\s*%?/i] },
  { key: 'goalkeeper_saves', name: 'Defesas do goleiro', patterns: [/goalkeeper\s+saves\s+(\d+)\s+(\d+)/i, /defesas\s+do\s+goleiro\s+(\d+)\s+(\d+)/i] },
  { key: 'expected_goals', name: 'Gols esperados (xG)', patterns: [/(?:expected\s+goals|xg)\s+(\d+(?:[\.,]\d+)?)\s+(\d+(?:[\.,]\d+)?)/i, /gols\s+esperados\s+(?:\(xg\)\s*)?(\d+(?:[\.,]\d+)?)\s+(\d+(?:[\.,]\d+)?)/i] },
];

function normalize(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function teamKey(value: unknown) {
  const raw = normalize(value);
  return TEAM_ALIASES[raw] ?? raw;
}

function numberValue(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractCodesFromUrl(url: string) {
  const file = decodeURIComponent(url.split('/').pop() ?? '').toUpperCase();
  const match = file.match(/M\d+[-_ ]+([A-Z]{3})[-_ ]+V[-_ ]+([A-Z]{3})/i) ?? file.match(/([A-Z]{3})[-_ ]+V[-_ ]+([A-Z]{3})/i);
  if (!match) return null;
  return { homeKey: CODE_ALIASES[match[1]] ?? normalize(match[1]), awayKey: CODE_ALIASES[match[2]] ?? normalize(match[2]), fileName: file };
}

async function parsePdfText(buffer: Buffer) {
  const pdfParse = (await import('pdf-parse')).default;
  const parsed = await pdfParse(buffer);
  return parsed.text || '';
}

function extractStats(text: string): ExtractedStat[] {
  const compact = text.replace(/\s+/g, ' ').trim();
  const stats: ExtractedStat[] = [];

  for (const metric of METRIC_PATTERNS) {
    let found: RegExpMatchArray | null = null;
    for (const pattern of metric.patterns) {
      found = compact.match(pattern);
      if (found) break;
    }
    if (!found) continue;
    stats.push({
      metricKey: metric.key,
      metricName: metric.name,
      home: numberValue(found[1]),
      away: numberValue(found[2]),
      period: 'match',
    });
  }

  return stats.filter((stat) => stat.home !== null || stat.away !== null);
}

async function findMatch(homeKey: string, awayKey: string): Promise<MatchRow | null> {
  const rows = (await sql`
    SELECT id, home_team_id, away_team_id, home_team_name, away_team_name, fixture_key
    FROM world_cup_matches
    WHERE competition_key = ${WORLD_CUP_2026_KEY}
      AND (
        (LOWER(home_team_name) LIKE ${`%${homeKey}%`} AND LOWER(away_team_name) LIKE ${`%${awayKey}%`})
        OR (LOWER(home_team_name) LIKE ${`%${awayKey}%`} AND LOWER(away_team_name) LIKE ${`%${homeKey}%`})
        OR fixture_key LIKE ${`%${homeKey.replaceAll(' ', '_')}%${awayKey.replaceAll(' ', '_')}%`}
        OR fixture_key LIKE ${`%${awayKey.replaceAll(' ', '_')}%${homeKey.replaceAll(' ', '_')}%`}
      )
    ORDER BY kickoff_at DESC NULLS LAST
    LIMIT 1
  `) as MatchRow[];
  return rows[0] ?? null;
}

async function saveStat(match: MatchRow, stat: ExtractedStat, homeKey: string, awayKey: string, pdfUrl: string) {
  const reversed = teamKey(match.home_team_name) === awayKey && teamKey(match.away_team_name) === homeKey;
  const homeTeamId = reversed ? match.away_team_id : match.home_team_id;
  const awayTeamId = reversed ? match.home_team_id : match.away_team_id;
  const homeValue = reversed ? stat.away : stat.home;
  const awayValue = reversed ? stat.home : stat.away;
  const now = new Date().toISOString();

  if (homeTeamId && homeValue !== null) {
    await sql`
      INSERT INTO world_cup_match_statistics (match_id, team_id, period, metric_key, metric_name, value_numeric, source_key, source_payload, source_updated_at)
      VALUES (${match.id}, ${homeTeamId}, ${stat.period ?? 'match'}, ${stat.metricKey}, ${stat.metricName}, ${homeValue}, 'fifa', ${JSON.stringify({ pdfUrl, side: 'home', importedBy: 'pmsr-importer' })}::jsonb, ${now})
      ON CONFLICT (match_id, team_id, period, metric_key, source_key)
      DO UPDATE SET value_numeric = EXCLUDED.value_numeric, metric_name = EXCLUDED.metric_name, source_payload = EXCLUDED.source_payload, source_updated_at = EXCLUDED.source_updated_at
    `;
  }

  if (awayTeamId && awayValue !== null) {
    await sql`
      INSERT INTO world_cup_match_statistics (match_id, team_id, period, metric_key, metric_name, value_numeric, source_key, source_payload, source_updated_at)
      VALUES (${match.id}, ${awayTeamId}, ${stat.period ?? 'match'}, ${stat.metricKey}, ${stat.metricName}, ${awayValue}, 'fifa', ${JSON.stringify({ pdfUrl, side: 'away', importedBy: 'pmsr-importer' })}::jsonb, ${now})
      ON CONFLICT (match_id, team_id, period, metric_key, source_key)
      DO UPDATE SET value_numeric = EXCLUDED.value_numeric, metric_name = EXCLUDED.metric_name, source_payload = EXCLUDED.source_payload, source_updated_at = EXCLUDED.source_updated_at
    `;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string; pdfUrl?: string; dryRun?: boolean };
    const pdfUrl = body.pdfUrl ?? body.url;
    if (!pdfUrl || !/^https:\/\//i.test(pdfUrl)) {
      return NextResponse.json({ success: false, error: 'Informe pdfUrl com a URL HTTPS do relatório PMSR da FIFA.' }, { status: 400 });
    }

    const codes = extractCodesFromUrl(pdfUrl);
    if (!codes) {
      return NextResponse.json({ success: false, error: 'Não foi possível identificar os códigos das seleções pelo nome do PDF.' }, { status: 400 });
    }

    const response = await fetch(pdfUrl, { cache: 'no-store' });
    if (!response.ok) {
      return NextResponse.json({ success: false, error: `Falha ao baixar PDF FIFA: HTTP ${response.status}` }, { status: 502 });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const text = await parsePdfText(buffer);
    const stats = extractStats(text);
    const match = await findMatch(codes.homeKey, codes.awayKey);

    if (!match) {
      return NextResponse.json({ success: false, error: 'Partida não encontrada no banco persistido.', detected: codes, extractedStats: stats }, { status: 404 });
    }

    if (!body.dryRun) {
      for (const stat of stats) await saveStat(match, stat, codes.homeKey, codes.awayKey, pdfUrl);
    }

    return NextResponse.json({
      success: true,
      dryRun: Boolean(body.dryRun),
      match,
      detected: codes,
      extractedStats: stats,
      savedValues: body.dryRun ? 0 : stats.reduce((sum, stat) => sum + (stat.home !== null ? 1 : 0) + (stat.away !== null ? 1 : 0), 0),
      warning: stats.length === 0 ? 'PDF baixado, mas nenhum padrão de estatística foi identificado. Pode ser necessário ajustar o parser para o layout PMSR.' : null,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro ao importar PMSR FIFA.' }, { status: 500 });
  }
}
