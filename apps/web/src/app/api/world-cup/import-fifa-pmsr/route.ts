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
  kickoff_at?: string | null;
};

type ExtractedStat = {
  metricKey: string;
  metricName: string;
  home: number | null;
  away: number | null;
  period: string;
  parser: string;
  rawLine?: string;
};

type PdfLine = { page: number; y: number; text: string };

type MetricDefinition = {
  key: string;
  name: string;
  aliases: string[];
  max?: number;
  percent?: boolean;
  decimal?: boolean;
};

const TEAM_ALIASES: Record<string, { fifa: string; code: string }> = {
  bra: { fifa: 'Brazil', code: 'BRA' }, brazil: { fifa: 'Brazil', code: 'BRA' }, brasil: { fifa: 'Brazil', code: 'BRA' },
  sco: { fifa: 'Scotland', code: 'SCO' }, scotland: { fifa: 'Scotland', code: 'SCO' }, escocia: { fifa: 'Scotland', code: 'SCO' },
  cze: { fifa: 'Czechia', code: 'CZE' }, czechia: { fifa: 'Czechia', code: 'CZE' }, tchequia: { fifa: 'Czechia', code: 'CZE' }, 'czech republic': { fifa: 'Czechia', code: 'CZE' },
  mex: { fifa: 'Mexico', code: 'MEX' }, mexico: { fifa: 'Mexico', code: 'MEX' },
  kor: { fifa: 'Korea Republic', code: 'KOR' }, 'korea republic': { fifa: 'Korea Republic', code: 'KOR' }, 'south korea': { fifa: 'Korea Republic', code: 'KOR' }, 'coreia do sul': { fifa: 'Korea Republic', code: 'KOR' },
  rsa: { fifa: 'South Africa', code: 'RSA' }, zaf: { fifa: 'South Africa', code: 'RSA' }, 'south africa': { fifa: 'South Africa', code: 'RSA' }, 'africa do sul': { fifa: 'South Africa', code: 'RSA' },
  mar: { fifa: 'Morocco', code: 'MAR' }, morocco: { fifa: 'Morocco', code: 'MAR' }, marrocos: { fifa: 'Morocco', code: 'MAR' },
  hai: { fifa: 'Haiti', code: 'HAI' }, haiti: { fifa: 'Haiti', code: 'HAI' },
  sui: { fifa: 'Switzerland', code: 'SUI' }, switzerland: { fifa: 'Switzerland', code: 'SUI' }, suica: { fifa: 'Switzerland', code: 'SUI' },
  can: { fifa: 'Canada', code: 'CAN' }, canada: { fifa: 'Canada', code: 'CAN' },
  usa: { fifa: 'USA', code: 'USA' }, eua: { fifa: 'USA', code: 'USA' }, 'united states': { fifa: 'USA', code: 'USA' },
  tur: { fifa: 'Turkiye', code: 'TUR' }, turkiye: { fifa: 'Turkiye', code: 'TUR' }, turkey: { fifa: 'Turkiye', code: 'TUR' }, turquia: { fifa: 'Turkiye', code: 'TUR' },
  par: { fifa: 'Paraguay', code: 'PAR' }, paraguay: { fifa: 'Paraguay', code: 'PAR' }, paraguai: { fifa: 'Paraguay', code: 'PAR' },
  aus: { fifa: 'Australia', code: 'AUS' }, australia: { fifa: 'Australia', code: 'AUS' },
  nor: { fifa: 'Norway', code: 'NOR' }, norway: { fifa: 'Norway', code: 'NOR' }, noruega: { fifa: 'Norway', code: 'NOR' },
  fra: { fifa: 'France', code: 'FRA' }, france: { fifa: 'France', code: 'FRA' }, franca: { fifa: 'France', code: 'FRA' },
  sen: { fifa: 'Senegal', code: 'SEN' }, senegal: { fifa: 'Senegal', code: 'SEN' },
  irq: { fifa: 'Iraq', code: 'IRQ' }, iraq: { fifa: 'Iraq', code: 'IRQ' }, iraque: { fifa: 'Iraq', code: 'IRQ' },
  uru: { fifa: 'Uruguay', code: 'URU' }, uruguay: { fifa: 'Uruguay', code: 'URU' }, uruguai: { fifa: 'Uruguay', code: 'URU' },
  esp: { fifa: 'Spain', code: 'ESP' }, spain: { fifa: 'Spain', code: 'ESP' }, espanha: { fifa: 'Spain', code: 'ESP' },
  ksa: { fifa: 'Saudi Arabia', code: 'KSA' }, 'saudi arabia': { fifa: 'Saudi Arabia', code: 'KSA' }, 'arabia saudita': { fifa: 'Saudi Arabia', code: 'KSA' },
  cpv: { fifa: 'Cape Verde Islands', code: 'CPV' }, 'cape verde': { fifa: 'Cape Verde Islands', code: 'CPV' }, 'cabo verde': { fifa: 'Cape Verde Islands', code: 'CPV' },
  egy: { fifa: 'Egypt', code: 'EGY' }, egypt: { fifa: 'Egypt', code: 'EGY' }, egito: { fifa: 'Egypt', code: 'EGY' },
  irn: { fifa: 'IR Iran', code: 'IRN' }, iran: { fifa: 'IR Iran', code: 'IRN' }, ira: { fifa: 'IR Iran', code: 'IRN' }, 'ir iran': { fifa: 'IR Iran', code: 'IRN' },
  nzl: { fifa: 'New Zealand', code: 'NZL' }, 'new zealand': { fifa: 'New Zealand', code: 'NZL' }, 'nova zelandia': { fifa: 'New Zealand', code: 'NZL' },
  bel: { fifa: 'Belgium', code: 'BEL' }, belgium: { fifa: 'Belgium', code: 'BEL' }, belgica: { fifa: 'Belgium', code: 'BEL' },
  cro: { fifa: 'Croatia', code: 'CRO' }, croatia: { fifa: 'Croatia', code: 'CRO' }, croacia: { fifa: 'Croatia', code: 'CRO' },
  gha: { fifa: 'Ghana', code: 'GHA' }, ghana: { fifa: 'Ghana', code: 'GHA' }, gana: { fifa: 'Ghana', code: 'GHA' },
  pan: { fifa: 'Panama', code: 'PAN' }, panama: { fifa: 'Panama', code: 'PAN' },
  eng: { fifa: 'England', code: 'ENG' }, england: { fifa: 'England', code: 'ENG' }, inglaterra: { fifa: 'England', code: 'ENG' },
  col: { fifa: 'Colombia', code: 'COL' }, colombia: { fifa: 'Colombia', code: 'COL' },
  por: { fifa: 'Portugal', code: 'POR' }, portugal: { fifa: 'Portugal', code: 'POR' },
  cod: { fifa: 'Congo DR', code: 'COD' }, 'congo dr': { fifa: 'Congo DR', code: 'COD' }, 'rd congo': { fifa: 'Congo DR', code: 'COD' },
  uzb: { fifa: 'Uzbekistan', code: 'UZB' }, uzbekistan: { fifa: 'Uzbekistan', code: 'UZB' }, uzbequistao: { fifa: 'Uzbekistan', code: 'UZB' },
  alg: { fifa: 'Algeria', code: 'ALG' }, algeria: { fifa: 'Algeria', code: 'ALG' }, argelia: { fifa: 'Algeria', code: 'ALG' },
  aut: { fifa: 'Austria', code: 'AUT' }, austria: { fifa: 'Austria', code: 'AUT' },
  jor: { fifa: 'Jordan', code: 'JOR' }, jordan: { fifa: 'Jordan', code: 'JOR' }, jordania: { fifa: 'Jordan', code: 'JOR' },
  arg: { fifa: 'Argentina', code: 'ARG' }, argentina: { fifa: 'Argentina', code: 'ARG' },
  jpn: { fifa: 'Japan', code: 'JPN' }, japan: { fifa: 'Japan', code: 'JPN' }, japao: { fifa: 'Japan', code: 'JPN' },
  swe: { fifa: 'Sweden', code: 'SWE' }, sweden: { fifa: 'Sweden', code: 'SWE' }, suecia: { fifa: 'Sweden', code: 'SWE' },
  tun: { fifa: 'Tunisia', code: 'TUN' }, tunisia: { fifa: 'Tunisia', code: 'TUN' },
  ned: { fifa: 'Netherlands', code: 'NED' }, netherlands: { fifa: 'Netherlands', code: 'NED' }, holanda: { fifa: 'Netherlands', code: 'NED' },
  ger: { fifa: 'Germany', code: 'GER' }, germany: { fifa: 'Germany', code: 'GER' }, alemanha: { fifa: 'Germany', code: 'GER' },
  ecu: { fifa: 'Ecuador', code: 'ECU' }, ecuador: { fifa: 'Ecuador', code: 'ECU' }, equador: { fifa: 'Ecuador', code: 'ECU' },
  cuw: { fifa: 'Curacao', code: 'CUW' }, curacao: { fifa: 'Curacao', code: 'CUW' }, curacau: { fifa: 'Curacao', code: 'CUW' },
  civ: { fifa: "Cote d'Ivoire", code: 'CIV' }, 'cote d ivoire': { fifa: "Cote d'Ivoire", code: 'CIV' }, 'ivory coast': { fifa: "Cote d'Ivoire", code: 'CIV' }, 'costa do marfim': { fifa: "Cote d'Ivoire", code: 'CIV' },
  qat: { fifa: 'Qatar', code: 'QAT' }, qatar: { fifa: 'Qatar', code: 'QAT' }, catar: { fifa: 'Qatar', code: 'QAT' },
  bih: { fifa: 'Bosnia and Herzegovina', code: 'BIH' }, 'bosnia and herzegovina': { fifa: 'Bosnia and Herzegovina', code: 'BIH' }, 'bosnia e herzegovina': { fifa: 'Bosnia and Herzegovina', code: 'BIH' },
};

const CODE_ALIASES: Record<string, string> = Object.fromEntries(Object.values(TEAM_ALIASES).map((team) => [team.code, team.fifa]));

const METRICS: MetricDefinition[] = [
  { key: 'possession', name: 'Posse de bola', aliases: ['possession', 'posse de bola', 'ball possession'], max: 100, percent: true },
  { key: 'shots', name: 'Finalizações', aliases: ['total attempts', 'total shots', 'shots', 'attempts', 'finalizacoes', 'finalizações'], max: 80 },
  { key: 'shots_on_target', name: 'Finalizações no gol', aliases: ['attempts on target', 'shots on target', 'on target', 'chutes no gol', 'finalizacoes no gol', 'finalizações no gol'], max: 50 },
  { key: 'corners', name: 'Escanteios', aliases: ['corners', 'corner kicks', 'escanteios'], max: 30 },
  { key: 'yellow_cards', name: 'Cartões amarelos', aliases: ['yellow cards', 'cartoes amarelos', 'cartões amarelos'], max: 15 },
  { key: 'red_cards', name: 'Cartões vermelhos', aliases: ['red cards', 'cartoes vermelhos', 'cartões vermelhos'], max: 5 },
  { key: 'fouls', name: 'Faltas', aliases: ['fouls committed', 'fouls', 'faltas'], max: 60 },
  { key: 'offsides', name: 'Impedimentos', aliases: ['offsides', 'impedimentos'], max: 20 },
  { key: 'passes', name: 'Passes totais', aliases: ['total passes', 'passes', 'passes totais'], max: 1500 },
  { key: 'pass_accuracy', name: 'Precisão de passes', aliases: ['passing accuracy', 'pass accuracy', 'precisao de passes', 'precisão de passes'], max: 100, percent: true },
  { key: 'goalkeeper_saves', name: 'Defesas do goleiro', aliases: ['goalkeeper saves', 'saves', 'defesas do goleiro'], max: 30 },
  { key: 'expected_goals', name: 'Gols esperados (xG)', aliases: ['expected goals', 'xg', 'gols esperados'], max: 10, decimal: true },
  { key: 'crosses', name: 'Cruzamentos', aliases: ['crosses', 'cruzamentos'], max: 80 },
  { key: 'tackles', name: 'Desarmes', aliases: ['tackles', 'desarmes'], max: 80 },
  { key: 'interceptions', name: 'Interceptações', aliases: ['interceptions', 'interceptacoes', 'interceptações'], max: 80 },
  { key: 'recoveries', name: 'Recuperações', aliases: ['recoveries', 'recuperacoes', 'recuperações'], max: 120 },
  { key: 'clearances', name: 'Cortes defensivos', aliases: ['clearances', 'perigo afastado', 'cortes'], max: 100 },
];

function normalize(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9.,%]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function textKey(value: unknown) {
  return normalize(value).replace(/[.,%]/g, '').trim();
}

function teamInfo(value: unknown) {
  const key = textKey(value);
  return TEAM_ALIASES[key] ?? { fifa: String(value ?? '').trim(), code: key.toUpperCase().slice(0, 3) };
}

function numberValue(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace('%', '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function isPlausible(metric: MetricDefinition, value: number | null) {
  if (value === null) return false;
  if (value < 0) return false;
  if (metric.max !== undefined && value > metric.max) return false;
  return true;
}

function extractCodesFromUrl(url: string) {
  const file = decodeURIComponent(url.split('/').pop() ?? '').toUpperCase();
  const match = file.match(/M(\d+)[-_ ]+([A-Z]{3})[-_ ]+V[-_ ]+([A-Z]{3})/i) ?? file.match(/([A-Z]{3})[-_ ]+V[-_ ]+([A-Z]{3})/i);
  if (!match) return null;
  const hasMatchNumber = match.length === 4;
  const matchNumber = hasMatchNumber ? Number(match[1]) : null;
  const homeCode = hasMatchNumber ? match[2] : match[1];
  const awayCode = hasMatchNumber ? match[3] : match[2];
  return { homeName: CODE_ALIASES[homeCode] ?? homeCode, awayName: CODE_ALIASES[awayCode] ?? awayCode, homeCode, awayCode, matchNumber, fileName: file };
}

async function parsePdfText(buffer: Buffer) {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const parsed = await pdfParse(buffer);
    return parsed.text || '';
  } catch {
    return '';
  }
}

async function extractPdfLines(buffer: Buffer): Promise<PdfLine[]> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true, isEvalSupported: false }).promise;
    const lines: PdfLine[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = (content.items as Array<{ str?: string; transform?: number[] }>).filter((item) => item.str?.trim());
      const grouped = new Map<number, Array<{ x: number; text: string }>>();
      for (const item of items) {
        const y = Math.round(Number(item.transform?.[5] ?? 0));
        const x = Number(item.transform?.[4] ?? 0);
        if (!grouped.has(y)) grouped.set(y, []);
        grouped.get(y)!.push({ x, text: String(item.str) });
      }
      for (const [y, row] of grouped.entries()) {
        const text = row.sort((a, b) => a.x - b.x).map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim();
        if (text) lines.push({ page: pageNumber, y, text });
      }
    }
    return lines;
  } catch {
    return [];
  }
}

function numbersFromLine(line: string) {
  return Array.from(line.matchAll(/-?\d+(?:[\.,]\d+)?\s*%?/g)).map((match) => numberValue(match[0])).filter((value): value is number => value !== null);
}

function lineContainsMetric(line: string, metric: MetricDefinition) {
  const normalized = textKey(line);
  return metric.aliases.some((alias) => normalized.includes(textKey(alias)));
}

function makeStat(metric: MetricDefinition, values: number[], parser: string, rawLine: string, period = 'match'): ExtractedStat | null {
  const plausible = values.filter((value) => isPlausible(metric, value));
  if (plausible.length < 2) return null;
  const home = plausible[0] ?? null;
  const away = plausible[1] ?? null;
  return { metricKey: metric.key, metricName: metric.name, home, away, period, parser, rawLine };
}

function mergeStats(stats: ExtractedStat[]) {
  const byKey = new Map<string, ExtractedStat>();
  for (const stat of stats) {
    const key = `${stat.period}:${stat.metricKey}`;
    if (!byKey.has(key)) byKey.set(key, stat);
  }
  return Array.from(byKey.values());
}

function extractStatsFromPlainText(text: string) {
  const compact = text.replace(/\s+/g, ' ').trim();
  const stats: ExtractedStat[] = [];
  for (const metric of METRICS) {
    for (const alias of metric.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const regex = new RegExp(`${escaped}[^0-9-]{0,80}(-?\\d+(?:[\\.,]\\d+)?\\s*%?)[^0-9-]{1,80}(-?\\d+(?:[\\.,]\\d+)?\\s*%?)`, 'i');
      const found = compact.match(regex);
      if (found) {
        const stat = makeStat(metric, [numberValue(found[1]), numberValue(found[2])].filter((v): v is number => v !== null), 'plain-text', found[0]);
        if (stat) stats.push(stat);
        break;
      }
    }
  }
  return stats;
}

function extractStatsFromLines(lines: PdfLine[]) {
  const stats: ExtractedStat[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    const windowText = [lines[index - 1]?.text, current.text, lines[index + 1]?.text].filter(Boolean).join(' | ');
    for (const metric of METRICS) {
      if (!lineContainsMetric(windowText, metric)) continue;
      const values = numbersFromLine(windowText);
      const stat = makeStat(metric, values, 'line-window', windowText);
      if (stat) stats.push(stat);
    }
  }
  return stats;
}

function rowText(row: MatchRow) {
  return textKey(`${row.fixture_key} ${row.home_team_name} ${row.away_team_name}`);
}

function matchScore(row: MatchRow, homeName: string, awayName: string, matchNumber: number | null) {
  const text = rowText(row);
  const home = teamInfo(homeName);
  const away = teamInfo(awayName);
  let score = 0;
  if (text.includes(textKey(home.fifa))) score += 4;
  if (text.includes(textKey(away.fifa))) score += 4;
  if (text.includes(textKey(home.code))) score += 2;
  if (text.includes(textKey(away.code))) score += 2;
  if (matchNumber && text.includes(`m${matchNumber}`)) score += 2;
  if (text.includes(`${textKey(home.fifa)} ${textKey(away.fifa)}`) || text.includes(`${textKey(away.fifa)} ${textKey(home.fifa)}`)) score += 2;
  return score;
}

async function ensureTeam(name: string, code: string) {
  const rows = await sql`
    INSERT INTO world_cup_teams (competition_key, fifa_code, name, source_key, source_payload, source_updated_at)
    VALUES (${WORLD_CUP_2026_KEY}, ${code}, ${name}, 'fifa', ${JSON.stringify({ code, name, importedBy: 'pmsr-3' })}::jsonb, NOW())
    ON CONFLICT (competition_key, fifa_code) DO UPDATE SET name = EXCLUDED.name, source_key = 'fifa', source_payload = EXCLUDED.source_payload, source_updated_at = NOW(), updated_at = NOW()
    RETURNING id
  `;
  return Number(rows[0]?.id);
}

async function createFifaPdfMatch(homeName: string, awayName: string, homeCode: string, awayCode: string, matchNumber: number | null, pdfUrl: string): Promise<MatchRow> {
  const homeTeamId = await ensureTeam(homeName, homeCode);
  const awayTeamId = await ensureTeam(awayName, awayCode);
  const fixtureKey = `fifa:pdf:M${matchNumber ?? 'unknown'}:${textKey(homeName).replace(/\s+/g, '_')}:${textKey(awayName).replace(/\s+/g, '_')}`;
  const rows = await sql`
    INSERT INTO world_cup_matches (competition_key, fixture_key, fifa_match_id, home_team_id, away_team_id, home_team_name, away_team_name, stage, round_name, status, source_key, source_payload, source_updated_at)
    VALUES (${WORLD_CUP_2026_KEY}, ${fixtureKey}, ${matchNumber ? `M${matchNumber}` : null}, ${homeTeamId}, ${awayTeamId}, ${homeName}, ${awayName}, 'Copa do Mundo 2026', 'FIFA PMSR', 'Fim', 'fifa', ${JSON.stringify({ pdfUrl, importedBy: 'pmsr-3', reconciled: true })}::jsonb, NOW())
    ON CONFLICT (competition_key, fixture_key) DO UPDATE SET source_key = 'fifa', source_payload = EXCLUDED.source_payload, source_updated_at = NOW(), updated_at = NOW()
    RETURNING id, home_team_id, away_team_id, home_team_name, away_team_name, fixture_key, kickoff_at
  `;
  return rows[0] as MatchRow;
}

async function findOrCreateMatch(homeName: string, awayName: string, homeCode: string, awayCode: string, matchNumber: number | null, pdfUrl: string, allowCreate: boolean): Promise<{ match: MatchRow | null; created: boolean; bestScore: number }> {
  const rows = (await sql`
    SELECT id, home_team_id, away_team_id, home_team_name, away_team_name, fixture_key, kickoff_at
    FROM world_cup_matches
    WHERE competition_key = ${WORLD_CUP_2026_KEY}
    ORDER BY kickoff_at DESC NULLS LAST, id DESC
    LIMIT 500
  `) as MatchRow[];
  const ranked = rows.map((row) => ({ row, score: matchScore(row, homeName, awayName, matchNumber) })).sort((a, b) => b.score - a.score);
  if (ranked[0] && ranked[0].score >= 8) return { match: ranked[0].row, created: false, bestScore: ranked[0].score };
  if (!allowCreate) return { match: null, created: false, bestScore: ranked[0]?.score ?? 0 };
  return { match: await createFifaPdfMatch(homeName, awayName, homeCode, awayCode, matchNumber, pdfUrl), created: true, bestScore: ranked[0]?.score ?? 0 };
}

async function saveStat(match: MatchRow, stat: ExtractedStat, homeName: string, awayName: string, pdfUrl: string) {
  const home = teamInfo(homeName);
  const away = teamInfo(awayName);
  const reversed = textKey(match.home_team_name) === textKey(away.fifa) && textKey(match.away_team_name) === textKey(home.fifa);
  const homeTeamId = reversed ? match.away_team_id : match.home_team_id;
  const awayTeamId = reversed ? match.home_team_id : match.away_team_id;
  const homeValue = reversed ? stat.away : stat.home;
  const awayValue = reversed ? stat.home : stat.away;
  const now = new Date().toISOString();
  const payload = { pdfUrl, parser: stat.parser, rawLine: stat.rawLine, importedBy: 'pmsr-3' };
  if (homeTeamId && homeValue !== null) {
    await sql`
      INSERT INTO world_cup_match_statistics (match_id, team_id, period, metric_key, metric_name, value_numeric, source_key, source_payload, source_updated_at)
      VALUES (${match.id}, ${homeTeamId}, ${stat.period}, ${stat.metricKey}, ${stat.metricName}, ${homeValue}, 'fifa', ${JSON.stringify({ ...payload, side: 'home' })}::jsonb, ${now})
      ON CONFLICT (match_id, team_id, period, metric_key, source_key)
      DO UPDATE SET value_numeric = EXCLUDED.value_numeric, metric_name = EXCLUDED.metric_name, source_payload = EXCLUDED.source_payload, source_updated_at = EXCLUDED.source_updated_at
    `;
  }
  if (awayTeamId && awayValue !== null) {
    await sql`
      INSERT INTO world_cup_match_statistics (match_id, team_id, period, metric_key, metric_name, value_numeric, source_key, source_payload, source_updated_at)
      VALUES (${match.id}, ${awayTeamId}, ${stat.period}, ${stat.metricKey}, ${stat.metricName}, ${awayValue}, 'fifa', ${JSON.stringify({ ...payload, side: 'away' })}::jsonb, ${now})
      ON CONFLICT (match_id, team_id, period, metric_key, source_key)
      DO UPDATE SET value_numeric = EXCLUDED.value_numeric, metric_name = EXCLUDED.metric_name, source_payload = EXCLUDED.source_payload, source_updated_at = EXCLUDED.source_updated_at
    `;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string; pdfUrl?: string; dryRun?: boolean; allowCreateMatch?: boolean };
    const pdfUrl = body.pdfUrl ?? body.url;
    if (!pdfUrl || !/^https:\/\//i.test(pdfUrl)) return NextResponse.json({ success: false, error: 'Informe pdfUrl com a URL HTTPS do relatório PMSR da FIFA.' }, { status: 400 });
    const codes = extractCodesFromUrl(pdfUrl);
    if (!codes) return NextResponse.json({ success: false, error: 'Não foi possível identificar os códigos das seleções pelo nome do PDF.' }, { status: 400 });

    const response = await fetch(pdfUrl, { cache: 'no-store' });
    if (!response.ok) return NextResponse.json({ success: false, error: `Falha ao baixar PDF FIFA: HTTP ${response.status}` }, { status: 502 });

    const buffer = Buffer.from(await response.arrayBuffer());
    const [plainText, lines] = await Promise.all([parsePdfText(buffer), extractPdfLines(buffer)]);
    const extractedStats = mergeStats([...extractStatsFromPlainText(plainText), ...extractStatsFromLines(lines)]);
    const { match, created, bestScore } = await findOrCreateMatch(codes.homeName, codes.awayName, codes.homeCode, codes.awayCode, codes.matchNumber, pdfUrl, body.allowCreateMatch !== false);

    if (!match) {
      return NextResponse.json({ success: false, error: 'Partida não encontrada no banco persistido.', detected: codes, bestScore, extractedStats, linesPreview: lines.slice(0, 20) }, { status: 404 });
    }

    if (!body.dryRun) {
      for (const stat of extractedStats) await saveStat(match, stat, codes.homeName, codes.awayName, pdfUrl);
    }

    return NextResponse.json({
      success: true,
      dryRun: Boolean(body.dryRun),
      match,
      matchCreatedFromFifaPdf: created,
      bestExistingMatchScore: bestScore,
      detected: codes,
      parser: { plainTextLength: plainText.length, lineCount: lines.length, strategy: 'pmsr-3-lines-and-text' },
      extractedStats,
      savedValues: body.dryRun ? 0 : extractedStats.reduce((sum, stat) => sum + (stat.home !== null ? 1 : 0) + (stat.away !== null ? 1 : 0), 0),
      warning: extractedStats.length === 0 ? 'PDF baixado, mas nenhuma métrica foi identificada. O retorno inclui diagnóstico do parser.' : null,
      scope: 'Somente Copa do Mundo: world_cup_matches, world_cup_teams e world_cup_match_statistics.',
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro ao importar PMSR FIFA.' }, { status: 500 });
  }
}
