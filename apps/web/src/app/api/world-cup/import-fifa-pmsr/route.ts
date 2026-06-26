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
  bra: 'brazil', brazil: 'brazil', brasil: 'brazil',
  sco: 'scotland', scotland: 'scotland', escocia: 'scotland',
  cze: 'czechia', czechia: 'czechia', tchequia: 'czechia', 'czech republic': 'czechia', 'czech rep': 'czechia',
  mex: 'mexico', mexico: 'mexico',
  kor: 'korea republic', korea: 'korea republic', 'korea republic': 'korea republic', 'south korea': 'korea republic', 'coreia do sul': 'korea republic',
  rsa: 'south africa', zaf: 'south africa', 'south africa': 'south africa', 'africa do sul': 'south africa',
  mar: 'morocco', morocco: 'morocco', marrocos: 'morocco',
  hai: 'haiti', haiti: 'haiti',
  sui: 'switzerland', switzerland: 'switzerland', suica: 'switzerland',
  can: 'canada', canada: 'canada',
  usa: 'usa', eua: 'usa', 'united states': 'usa',
  tur: 'turkiye', turkiye: 'turkiye', turkey: 'turkiye', turquia: 'turkiye',
  par: 'paraguay', paraguay: 'paraguay', paraguai: 'paraguay',
  aus: 'australia', australia: 'australia', austrália: 'australia',
  nor: 'norway', norway: 'norway', noruega: 'norway',
  fra: 'france', france: 'france', franca: 'france',
  sen: 'senegal', senegal: 'senegal',
  irq: 'iraq', iraq: 'iraq', iraque: 'iraq',
  uru: 'uruguay', uruguay: 'uruguay', uruguai: 'uruguay',
  esp: 'spain', spain: 'spain', espanha: 'spain',
  ksa: 'saudi arabia', 'saudi arabia': 'saudi arabia', 'arabia saudita': 'saudi arabia',
  cpv: 'cape verde islands', 'cape verde': 'cape verde islands', 'cabo verde': 'cape verde islands',
  egy: 'egypt', egypt: 'egypt', egito: 'egypt',
  irn: 'ir iran', iran: 'ir iran', ira: 'ir iran', 'ir iran': 'ir iran',
  nzl: 'new zealand', 'new zealand': 'new zealand', 'nova zelandia': 'new zealand',
  bel: 'belgium', belgium: 'belgium', belgica: 'belgium',
  cro: 'croatia', croatia: 'croatia', croacia: 'croatia',
  gha: 'ghana', ghana: 'ghana', gana: 'ghana',
  pan: 'panama', panama: 'panama',
  eng: 'england', england: 'england', inglaterra: 'england',
  col: 'colombia', colombia: 'colombia',
  por: 'portugal', portugal: 'portugal',
  cod: 'congo dr', 'congo dr': 'congo dr', 'rd congo': 'congo dr', 'dr congo': 'congo dr',
  uzb: 'uzbekistan', uzbekistan: 'uzbekistan', uzbequistao: 'uzbekistan',
  alg: 'algeria', algeria: 'algeria', argelia: 'algeria',
  aut: 'austria', austria: 'austria',
  jor: 'jordan', jordan: 'jordan', jordania: 'jordan',
  arg: 'argentina', argentina: 'argentina',
  jpn: 'japan', japan: 'japan', japao: 'japan',
  swe: 'sweden', sweden: 'sweden', suecia: 'sweden',
  tun: 'tunisia', tunisia: 'tunisia',
  ned: 'netherlands', netherlands: 'netherlands', holanda: 'netherlands',
  ger: 'germany', germany: 'germany', alemanha: 'germany',
  ecu: 'ecuador', ecuador: 'ecuador', equador: 'ecuador',
  cuw: 'curacao', curacao: 'curacao', curacau: 'curacao',
  civ: "cote d'ivoire", 'cote d ivoire': "cote d'ivoire", 'ivory coast': "cote d'ivoire", 'costa do marfim': "cote d'ivoire",
  qat: 'qatar', qatar: 'qatar', catar: 'qatar',
  bih: 'bosnia and herzegovina', 'bosnia and herzegovina': 'bosnia and herzegovina', 'bosnia e herzegovina': 'bosnia and herzegovina',
};

const CODE_ALIASES: Record<string, string> = Object.fromEntries(Object.keys(TEAM_ALIASES).filter((key) => key.length === 3).map((key) => [key.toUpperCase(), TEAM_ALIASES[key]]));

const TEAM_VARIANTS: Record<string, string[]> = {
  czechia: ['czechia', 'tchequia', 'czech republic', 'cze'],
  mexico: ['mexico', 'mex'],
  'south africa': ['south africa', 'africa do sul', 'rsa', 'zaf'],
  'korea republic': ['korea republic', 'south korea', 'coreia do sul', 'kor'],
  brazil: ['brazil', 'brasil', 'bra'],
  scotland: ['scotland', 'escocia', 'sco'],
  switzerland: ['switzerland', 'suica', 'sui'],
  'bosnia and herzegovina': ['bosnia and herzegovina', 'bosnia e herzegovina', 'bih'],
  'cape verde islands': ['cape verde islands', 'cape verde', 'cabo verde', 'cpv'],
  'congo dr': ['congo dr', 'rd congo', 'dr congo', 'cod'],
  turkiye: ['turkiye', 'turkey', 'turquia', 'tur'],
  usa: ['usa', 'eua', 'united states'],
  'ir iran': ['ir iran', 'iran', 'ira', 'irn'],
  "cote d'ivoire": ["cote d'ivoire", 'cote d ivoire', 'ivory coast', 'costa do marfim', 'civ'],
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

function teamVariants(key: string) {
  return Array.from(new Set([key, ...(TEAM_VARIANTS[key] ?? [])].map(normalize).filter(Boolean)));
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
    stats.push({ metricKey: metric.key, metricName: metric.name, home: numberValue(found[1]), away: numberValue(found[2]), period: 'match' });
  }
  return stats.filter((stat) => stat.home !== null || stat.away !== null);
}

function rowText(row: MatchRow) {
  return normalize(`${row.fixture_key} ${row.home_team_name} ${row.away_team_name}`);
}

function containsAny(text: string, variants: string[]) {
  return variants.some((variant) => text.includes(variant.replace(/\s+/g, ' ')) || text.includes(variant.replace(/\s+/g, '_')));
}

async function findMatch(homeKey: string, awayKey: string): Promise<MatchRow | null> {
  const rows = (await sql`
    SELECT id, home_team_id, away_team_id, home_team_name, away_team_name, fixture_key
    FROM world_cup_matches
    WHERE competition_key = ${WORLD_CUP_2026_KEY}
    ORDER BY kickoff_at DESC NULLS LAST, id DESC
    LIMIT 300
  `) as MatchRow[];
  const homeVariants = teamVariants(homeKey);
  const awayVariants = teamVariants(awayKey);
  return rows.find((row) => containsAny(rowText(row), homeVariants) && containsAny(rowText(row), awayVariants)) ?? null;
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
    if (!pdfUrl || !/^https:\/\//i.test(pdfUrl)) return NextResponse.json({ success: false, error: 'Informe pdfUrl com a URL HTTPS do relatório PMSR da FIFA.' }, { status: 400 });
    const codes = extractCodesFromUrl(pdfUrl);
    if (!codes) return NextResponse.json({ success: false, error: 'Não foi possível identificar os códigos das seleções pelo nome do PDF.' }, { status: 400 });
    const response = await fetch(pdfUrl, { cache: 'no-store' });
    if (!response.ok) return NextResponse.json({ success: false, error: `Falha ao baixar PDF FIFA: HTTP ${response.status}` }, { status: 502 });
    const buffer = Buffer.from(await response.arrayBuffer());
    const text = await parsePdfText(buffer);
    const stats = extractStats(text);
    const match = await findMatch(codes.homeKey, codes.awayKey);
    if (!match) return NextResponse.json({ success: false, error: 'Partida não encontrada no banco persistido.', detected: codes, extractedStats: stats }, { status: 404 });
    if (!body.dryRun) for (const stat of stats) await saveStat(match, stat, codes.homeKey, codes.awayKey, pdfUrl);
    return NextResponse.json({
      success: true,
      dryRun: Boolean(body.dryRun),
      match,
      detected: codes,
      extractedStats: stats,
      savedValues: body.dryRun ? 0 : stats.reduce((sum, stat) => sum + (stat.home !== null ? 1 : 0) + (stat.away !== null ? 1 : 0), 0),
      warning: stats.length === 0 ? 'PDF baixado, mas nenhum padrão de estatística foi identificado. Pode ser necessário ajustar o parser para o layout PMSR.' : null,
      scope: 'Somente Copa do Mundo: world_cup_matches e world_cup_match_statistics.',
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro ao importar PMSR FIFA.' }, { status: 500 });
  }
}
