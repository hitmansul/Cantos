import sql from '@/app/api/utils/sql';
import { assertPersistentDatabaseConfigured } from './database';
import { WORLD_CUP_2026_KEY } from './worldCupRepository';

function normalize(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CLUB_COMPETITION_TERMS = [
  'brasileirao', 'brasileiro', 'serie a', 'serie b', 'libertadores', 'sul americana',
  'sulamericana', 'copa do brasil', 'champions', 'premier league', 'la liga',
  'bundesliga', 'ligue 1', 'mundial de clubes', 'flamengo', 'palmeiras', 'fluminense',
  'corinthians', 'sao paulo', 'vasco', 'botafogo', 'gremio', 'internacional',
  'real madrid', 'barcelona', 'liverpool', 'manchester', 'river plate', 'boca juniors'
];

const TEAM_KEY: Record<string, string> = {
  brazil: 'brasil', brasil: 'brasil', scotland: 'escocia', escocia: 'escocia', tchequia: 'tchequia', mexico: 'mexico', 'africa do sul': 'africa do sul', canada: 'canada', suica: 'suica', catar: 'catar', marrocos: 'marrocos', haiti: 'haiti', usa: 'eua', eua: 'eua', australia: 'australia', paraguai: 'paraguai', turquia: 'turquia', alemanha: 'alemanha', 'costa do marfim': 'costa do marfim', equador: 'equador', curacao: 'curacao', holanda: 'holanda', japao: 'japao', suecia: 'suecia', tunisia: 'tunisia', belgica: 'belgica', egito: 'egito', ira: 'ira', 'nova zelandia': 'nova zelandia', espanha: 'espanha', uruguai: 'uruguai', 'arabia saudita': 'arabia saudita', 'cabo verde': 'cabo verde', franca: 'franca', noruega: 'noruega', senegal: 'senegal', iraque: 'iraque', argentina: 'argentina', austria: 'austria', jordania: 'jordania', argelia: 'argelia', colombia: 'colombia', congo: 'rd congo', 'rd congo': 'rd congo', portugal: 'portugal', uzbequistao: 'uzbequistao', inglaterra: 'inglaterra', gana: 'gana', panama: 'panama', croacia: 'croacia', france: 'franca', spain: 'espanha', england: 'inglaterra', japan: 'japao', sweden: 'suecia', croatia: 'croacia', germany: 'alemanha', belgium: 'belgica', norway: 'noruega', 'congo dr': 'rd congo'
};

const DISPLAY_NAMES: Record<string, string> = {
  brasil: 'Brasil', escocia: 'Escócia', tchequia: 'Tchéquia', mexico: 'México', 'africa do sul': 'África do Sul', canada: 'Canadá', suica: 'Suíça', catar: 'Catar', marrocos: 'Marrocos', haiti: 'Haiti', eua: 'EUA', australia: 'Austrália', paraguai: 'Paraguai', turquia: 'Turquia', alemanha: 'Alemanha', 'costa do marfim': 'Costa do Marfim', equador: 'Equador', curacao: 'Curaçao', holanda: 'Holanda', japao: 'Japão', suecia: 'Suécia', tunisia: 'Tunísia', belgica: 'Bélgica', egito: 'Egito', ira: 'Irã', 'nova zelandia': 'Nova Zelândia', espanha: 'Espanha', uruguai: 'Uruguai', 'arabia saudita': 'Arábia Saudita', 'cabo verde': 'Cabo Verde', franca: 'França', noruega: 'Noruega', senegal: 'Senegal', iraque: 'Iraque', argentina: 'Argentina', austria: 'Áustria', jordania: 'Jordânia', argelia: 'Argélia', colombia: 'Colômbia', 'rd congo': 'RD Congo', portugal: 'Portugal', uzbequistao: 'Uzbequistão', inglaterra: 'Inglaterra', gana: 'Gana', panama: 'Panamá', croacia: 'Croácia'
};

const WORLD_CUP_TEAM_ALIASES = Object.keys(TEAM_KEY);

type MetricAlias = { keys: string[]; label: string; aliases: string[]; combined?: 'cards' };
const METRICS: MetricAlias[] = [
  { keys: ['corners'], label: 'escanteios', aliases: ['escanteio', 'escanteios', 'corner', 'corners', 'cantos'] },
  { keys: ['shots'], label: 'finalizações', aliases: ['finalizacao', 'finalizacoes', 'chute', 'chutes', 'remate', 'remates', 'arremate', 'arremates', 'shots'] },
  { keys: ['shots_on_target', 'shotsontarget'], label: 'finalizações no gol', aliases: ['finalizacoes no gol', 'chutes no gol', 'no gol', 'shots on target'] },
  { keys: ['shots_off_target', 'shotsofftarget'], label: 'finalizações para fora', aliases: ['finalizacoes para fora', 'chutes para fora', 'para fora', 'shots off target'] },
  { keys: ['possession'], label: 'posse de bola', aliases: ['posse', 'posse de bola', 'possession', 'controle da bola'] },
  { keys: ['passes'], label: 'passes totais', aliases: ['passes totais', 'passes', 'troca de passes'] },
  { keys: ['completed_passes', 'completedpasses'], label: 'passes concluídos', aliases: ['passes concluidos', 'passes certos', 'completed passes'] },
  { keys: ['crosses'], label: 'cruzamentos', aliases: ['cruzamentos', 'cruzamento', 'bola na area', 'crosses'] },
  { keys: ['completed_crosses', 'completedcrosses'], label: 'cruzamentos concluídos', aliases: ['cruzamentos concluidos', 'cruzamentos certos', 'completed crosses'] },
  { keys: ['yellow_cards', 'yellowcards'], label: 'cartões amarelos', aliases: ['cartoes amarelos', 'cartao amarelo', 'amarelos', 'yellow cards'] },
  { keys: ['red_cards', 'redcards'], label: 'cartões vermelhos', aliases: ['cartoes vermelhos', 'cartao vermelho', 'vermelhos', 'red cards'] },
  { keys: ['yellow_cards', 'yellowcards', 'red_cards', 'redcards'], label: 'cartões', aliases: ['cartoes', 'cartao', 'cartões', 'cartão', 'cards', 'disciplina'], combined: 'cards' },
  { keys: ['fouls'], label: 'faltas', aliases: ['faltas', 'falta', 'fouls'] },
  { keys: ['offsides'], label: 'impedimentos', aliases: ['impedimentos', 'impedimento', 'offsides'] },
  { keys: ['goalkeeper_saves', 'saves'], label: 'defesas do goleiro', aliases: ['defesas do goleiro', 'defesas', 'saves'] },
  { keys: ['expected_goals', 'xg'], label: 'gols esperados (xG)', aliases: ['xg', 'gols esperados', 'expected goals', 'chances claras'] },
  { keys: ['goals'], label: 'gols', aliases: ['gols', 'gol'] },
  { keys: ['assists'], label: 'assistências', aliases: ['assistencias', 'assistencia', 'assists'] },
];

type Aggregate = { name: string; key: string; total: number; count: number; source: string; avg: number };

function teamKey(value: unknown) { const n = normalize(value); return TEAM_KEY[n] ?? n; }
function teamLabel(value: unknown) { const key = teamKey(value); return DISPLAY_NAMES[key] ?? String(value ?? key); }
function hasWholeTerm(question: string, term: string) { return ` ${normalize(question)} `.includes(` ${normalize(term)} `); }
function mentionedWorldCupTeams(question: string) { const found = new Set<string>(); for (const alias of WORLD_CUP_TEAM_ALIASES) if (alias.length >= 3 && hasWholeTerm(question, alias)) found.add(TEAM_KEY[alias] ?? alias); return found.size; }
function isWorldCupIntent(question: string) { const q = normalize(question); if (CLUB_COMPETITION_TERMS.some((term) => q.includes(normalize(term)))) return false; if (q.includes('copa do mundo') || q.includes('world cup') || q.includes('fifa world cup')) return true; if ((q.includes('mundial') || q.includes('fifa')) && !q.includes('mundial de clubes')) return true; return mentionedWorldCupTeams(question) >= 2; }
function metricScores(question: string) { const q = normalize(question); return METRICS.map((metric) => ({ metric, score: Math.max(...metric.aliases.map((alias) => q.lastIndexOf(normalize(alias)))) })).filter((item) => item.score >= 0).sort((a, b) => b.score - a.score); }
function metricsFromQuestion(question: string) { const list = metricScores(question).map((item) => item.metric); return list.filter((metric, index) => list.findIndex((m) => m.label === metric.label) === index).slice(0, 4); }
function metricFromQuestion(question: string) { return metricScores(question)[0]?.metric ?? null; }
function isStatQuestion(question: string) { const q = normalize(question); return Boolean(metricFromQuestion(question)) || ['estatistica', 'estatisticas', 'quantas', 'quantos', 'quem teve mais', 'quem finalizou mais', 'qual foi', 'analise', 'analisa', 'desempenho', 'dominou', 'mereceu', 'justo', 'melhor', 'over', 'under', 'tendencia', 'ranking', 'top', 'media', 'média', 'comparar', 'compare'].some((term) => q.includes(normalize(term))); }
function wantsAnalysis(question: string) { const q = normalize(question); return ['analise', 'analisa', 'desempenho', 'quem foi melhor', 'dominou', 'dominio', 'mereceu', 'justo', 'explica', 'por que', 'porque', 'ofensivamente', 'pressionou', 'criou mais', 'jogo aberto', 'truncado'].some((term) => q.includes(normalize(term))); }
function wantsCornerSpecialist(question: string) { const q = normalize(question); return (q.includes('escanteio') || q.includes('corner') || q.includes('canto') || q.includes('over') || q.includes('under')) && ['over', 'under', 'tendencia', 'tendência', 'linha'].some((term) => q.includes(normalize(term))); }
function wantsRanking(question: string) { const q = normalize(question); return ['ranking', 'top', 'quem mais', 'maiores', 'lidera', 'lideram'].some((term) => q.includes(normalize(term))) && !q.includes('quem foi melhor'); }
function wantsAverage(question: string) { const q = normalize(question); return q.includes('media') || q.includes('média') || q.includes('por jogo'); }
function wantsComparison(question: string) { const q = normalize(question); return q.includes('compare') || q.includes('comparar') || q.includes('comparacao') || q.includes('comparação'); }
function metricKey(row: any) { return normalize(row.metric_key).replace(/\s+/g, '_'); }
function metricMatches(row: any, metric: MetricAlias) { const key = metricKey(row); const text = normalize(`${row.metric_key} ${row.metric_name}`); return metric.keys.includes(key) || metric.aliases.some((alias) => text.includes(normalize(alias))); }
function scoreMatch(question: string, homeTeam: string, awayTeam: string) { let score = 0; for (const name of [homeTeam, awayTeam, teamKey(homeTeam), teamKey(awayTeam)]) { const n = normalize(name); if (n && hasWholeTerm(question, n)) score += 10; for (const part of n.split(' ').filter((p) => p.length >= 4)) if (hasWholeTerm(question, part)) score += 2; } return score; }
function numberValue(row: any): number { const parsed = Number(String(row?.value_numeric ?? row?.value_text ?? 0).replace('%', '').replace(',', '.')); return Number.isFinite(parsed) ? parsed : 0; }
function formatValue(value: number, key = '') { if (key.includes('possession')) return `${Math.round(value)}%`; if (key.includes('expected_goals') || key === 'xg') return value.toFixed(2).replace('.', ','); return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ','); }
function sourcePriority(source: string) { return source === 'fifa' ? 1 : source === '365scores' ? 2 : 9; }
function sourceLabel(source?: string) { return source === 'fifa' ? 'FIFA' : source === '365scores' ? '365Scores' : source === 'api-football' ? 'API-Football' : 'base local'; }
function pickSourceRows(rows: any[]) { const bestSource = rows.slice().sort((a, b) => sourcePriority(a.source_key) - sourcePriority(b.source_key))[0]?.source_key; return rows.filter((row) => row.source_key === bestSource); }
function bestTeamMetric(rows: any[], wantedTeam: string) { const wanted = teamKey(wantedTeam); return pickSourceRows(rows).find((row) => teamKey(row.team_name) === wanted) ?? null; }
function statValue(rows: any[], team: string, keys: string[]) { return numberValue(bestTeamMetric(rows.filter((row) => keys.includes(metricKey(row))), team)); }
function header(match: any) { return `Copa do Mundo 2026 — ${teamLabel(match.home_team_name)} ${match.home_score ?? '-'} x ${match.away_score ?? '-'} ${teamLabel(match.away_team_name)}.`; }
function defaultMetric() { return METRICS.find((metric) => metric.keys.includes('corners')) ?? METRICS[0]; }

async function findAskedMatch(question: string) {
  const matches = await sql`SELECT id, home_team_name, away_team_name, home_score, away_score, status, kickoff_at, group_name, round_name FROM world_cup_matches WHERE competition_key = ${WORLD_CUP_2026_KEY} ORDER BY kickoff_at DESC NULLS LAST, id DESC LIMIT 220`;
  return matches.map((match) => ({ match, score: scoreMatch(question, match.home_team_name, match.away_team_name) })).filter((item) => item.score >= 10).sort((a, b) => b.score - a.score)[0]?.match ?? null;
}
async function getMatchStats(matchId: number) { return await sql`SELECT ms.source_key, ms.metric_key, ms.metric_name, ms.value_numeric, ms.value_text, t.name AS team_name FROM world_cup_match_statistics ms JOIN world_cup_teams t ON t.id = ms.team_id WHERE ms.match_id = ${matchId} ORDER BY CASE ms.source_key WHEN 'fifa' THEN 1 WHEN '365scores' THEN 2 ELSE 9 END, ms.metric_key, t.name`; }
async function getAllWorldCupStats() { return await sql`SELECT ms.match_id, ms.source_key, ms.metric_key, ms.metric_name, ms.value_numeric, ms.value_text, t.name AS team_name, m.home_team_name, m.away_team_name, m.home_score, m.away_score FROM world_cup_match_statistics ms JOIN world_cup_teams t ON t.id = ms.team_id JOIN world_cup_matches m ON m.id = ms.match_id WHERE m.competition_key = ${WORLD_CUP_2026_KEY} ORDER BY ms.match_id, CASE ms.source_key WHEN 'fifa' THEN 1 WHEN '365scores' THEN 2 ELSE 9 END`; }

function teamNamesInQuestion(question: string) { const found: string[] = []; for (const alias of WORLD_CUP_TEAM_ALIASES) { if (alias.length >= 3 && hasWholeTerm(question, alias)) { const canonical = TEAM_KEY[alias] ?? alias; if (!found.includes(canonical)) found.push(canonical); } } return found; }
function filterMetricRows(rows: any[], metric: MetricAlias) { return rows.filter((row) => metricMatches(row, metric)); }
function dedupeBestRows(rows: any[]) { const grouped = new Map<string, any[]>(); for (const row of rows) { const key = `${row.match_id}:${teamKey(row.team_name)}:${metricKey(row)}`; grouped.set(key, [...(grouped.get(key) ?? []), row]); } return Array.from(grouped.values()).map((items) => items.sort((a, b) => sourcePriority(a.source_key) - sourcePriority(b.source_key))[0]); }
function aggregateByTeam(rows: any[]): Aggregate[] { const map = new Map<string, Aggregate>(); for (const row of dedupeBestRows(rows)) { const key = teamKey(row.team_name); const current = map.get(key) ?? { name: teamLabel(key), key, total: 0, count: 0, source: row.source_key, avg: 0 }; current.total += numberValue(row); current.count += 1; if (sourcePriority(row.source_key) < sourcePriority(current.source)) current.source = row.source_key; current.name = teamLabel(key); map.set(key, current); } return Array.from(map.values()).map((item) => ({ ...item, avg: item.count ? item.total / item.count : 0 })).sort((a, b) => b.total - a.total); }
function selectAggregate(aggregates: Aggregate[], key: string) { return aggregates.find((item) => item.key === key); }

async function formatRanking(question: string) {
  const metric = metricFromQuestion(question) ?? defaultMetric();
  if (metric.combined) return null;
  const allRows = await getAllWorldCupStats();
  const rows = filterMetricRows(allRows, metric);
  if (rows.length === 0) return `Ainda não encontrei ranking de ${metric.label} na base da Copa do Mundo.`;
  const useAvg = wantsAverage(question);
  const ranking = aggregateByTeam(rows).sort((a, b) => useAvg ? b.avg - a.avg : b.total - a.total).slice(0, 10);
  const lines = ranking.map((item, index) => `${index + 1}. ${item.name} — ${useAvg ? `${formatValue(item.avg, metric.keys[0])} por jogo` : `${formatValue(item.total, metric.keys[0])} no total`} (${item.count} jogos com dados)`).join('\n');
  return `Ranking da Copa do Mundo 2026 — ${metric.label}.\n\n${lines}\n\nFonte: base local da Cantos, priorizando FIFA e usando 365Scores quando necessário.`;
}

async function formatTeamAverage(question: string) {
  const metric = metricFromQuestion(question) ?? defaultMetric();
  if (metric.combined) return null;
  const teams = teamNamesInQuestion(question);
  if (teams.length === 0) return null;
  const allRows = await getAllWorldCupStats();
  const rows = filterMetricRows(allRows, metric).filter((row) => teams.includes(teamKey(row.team_name)));
  if (rows.length === 0) return `Ainda não encontrei ${metric.label} para ${teams.map(teamLabel).join(' e ')} na base da Copa do Mundo.`;
  const aggregates = aggregateByTeam(rows).filter((item) => teams.includes(item.key));
  const lines = teams.map((team) => selectAggregate(aggregates, team)).filter(Boolean).map((item) => `- ${item!.name}: média de ${formatValue(item!.avg, metric.keys[0])} por jogo (${formatValue(item!.total, metric.keys[0])} no total em ${item!.count} jogos com dados)`).join('\n');
  return `Média da Copa do Mundo 2026 — ${metric.label}.\n\n${lines}\n\nFonte: base local da Cantos, priorizando FIFA e usando 365Scores quando necessário.`;
}

async function formatTeamComparison(question: string) {
  const teams = teamNamesInQuestion(question).slice(0, 2);
  if (teams.length < 2) return null;
  const allRows = await getAllWorldCupStats();
  const summaryMetrics = [
    METRICS.find((m) => m.keys.includes('corners'))!,
    METRICS.find((m) => m.keys.includes('shots'))!,
    METRICS.find((m) => m.keys.includes('shots_on_target'))!,
    METRICS.find((m) => m.keys.includes('possession'))!,
    METRICS.find((m) => m.keys.includes('expected_goals'))!,
    METRICS.find((m) => m.keys.includes('yellow_cards'))!,
  ].filter(Boolean);
  const lines: string[] = [];
  let firstWins = 0;
  let secondWins = 0;
  for (const metric of summaryMetrics) {
    const aggregates = aggregateByTeam(filterMetricRows(allRows, metric).filter((row) => teams.includes(teamKey(row.team_name))));
    const a = selectAggregate(aggregates, teams[0]);
    const b = selectAggregate(aggregates, teams[1]);
    if (!a || !b) continue;
    const leader = a.avg > b.avg ? a.name : b.avg > a.avg ? b.name : 'equilíbrio';
    if (a.avg > b.avg) firstWins += 1;
    if (b.avg > a.avg) secondWins += 1;
    lines.push(`- ${metric.label}: ${a.name} ${formatValue(a.avg, metric.keys[0])}/jogo x ${formatValue(b.avg, metric.keys[0])}/jogo ${b.name} → ${leader}`);
  }
  if (lines.length === 0) return null;
  const aName = teamLabel(teams[0]);
  const bName = teamLabel(teams[1]);
  const reading = firstWins > secondWins ? `${aName} aparece melhor no conjunto das métricas comparadas.` : secondWins > firstWins ? `${bName} aparece melhor no conjunto das métricas comparadas.` : 'O comparativo ficou equilibrado no conjunto das métricas.';
  return `Comparação na Copa do Mundo 2026 — ${aName} x ${bName}.\n\n${lines.join('\n')}\n\nLeitura do analista: ${reading} A comparação usa médias por jogo para evitar distorção por número diferente de partidas.\n\nFonte: base local da Cantos, priorizando FIFA e usando 365Scores quando necessário.`;
}

function formatCards(match: any, rows: any[]) {
  const sourceRows = pickSourceRows(rows.filter((row) => ['yellow_cards', 'yellowcards', 'red_cards', 'redcards'].includes(metricKey(row))));
  const hy = statValue(sourceRows, match.home_team_name, ['yellow_cards', 'yellowcards']); const ay = statValue(sourceRows, match.away_team_name, ['yellow_cards', 'yellowcards']); const hr = statValue(sourceRows, match.home_team_name, ['red_cards', 'redcards']); const ar = statValue(sourceRows, match.away_team_name, ['red_cards', 'redcards']);
  const total = hy + ay + hr + ar; const reading = total >= 7 ? 'Foi um jogo quente disciplinarmente.' : total <= 3 ? 'Foi uma partida relativamente disciplinada.' : 'Foi uma partida com nível moderado de cartões.';
  return `${header(match)}\n\nCartões:\n- ${teamLabel(match.home_team_name)}: ${hy} amarelos e ${hr} vermelhos\n- ${teamLabel(match.away_team_name)}: ${ay} amarelos e ${ar} vermelhos\n\nTotal: ${hy + ay} amarelos e ${hr + ar} vermelhos. ${reading}\n\nFonte: ${sourceLabel(sourceRows[0]?.source_key)}.`;
}
function naturalMetric(match: any, metric: MetricAlias, homeValue: number, awayValue: number, key: string) { const home = teamLabel(match.home_team_name); const away = teamLabel(match.away_team_name); if (key.includes('possession')) { const leader = homeValue > awayValue ? home : awayValue > homeValue ? away : null; return `Posse de bola:\n- ${home}: ${formatValue(homeValue, key)}\n- ${away}: ${formatValue(awayValue, key)}\n\n${leader ? `${leader} teve mais controle da bola.` : 'A posse ficou equilibrada.'}`; } if (key.includes('expected_goals') || key === 'xg') { const leader = homeValue > awayValue ? home : awayValue > homeValue ? away : null; return `Gols esperados (xG):\n- ${home}: ${formatValue(homeValue, key)}\n- ${away}: ${formatValue(awayValue, key)}\n\n${leader ? `${leader} criou chances de maior qualidade.` : 'O xG ficou equilibrado.'}`; } const total = homeValue + awayValue; const leader = homeValue > awayValue ? home : awayValue > homeValue ? away : null; return `${metric.label[0].toUpperCase()}${metric.label.slice(1)}:\n- ${home}: ${formatValue(homeValue, key)}\n- ${away}: ${formatValue(awayValue, key)}\nTotal: ${formatValue(total, key)}.\n\n${leader ? `${leader} liderou em ${metric.label}.` : `As equipes empataram em ${metric.label}.`}`; }
function formatSingleMetric(match: any, rows: any[], metric: MetricAlias) { if (metric.combined === 'cards') return formatCards(match, rows); const metricRows = rows.filter((row) => metricMatches(row, metric)); const home = bestTeamMetric(metricRows, match.home_team_name); const away = bestTeamMetric(metricRows, match.away_team_name); if (!home || !away) return `Encontrei ${teamLabel(match.home_team_name)} x ${teamLabel(match.away_team_name)}, mas ainda não há estatística de ${metric.label} gravada para essa partida.`; return `${header(match)}\n\n${naturalMetric(match, metric, numberValue(home), numberValue(away), metricKey(home))}\n\nFonte: ${sourceLabel(home.source_key)}.`; }
function formatMultipleMetrics(match: any, rows: any[], metrics: MetricAlias[]) { const sourceRows = pickSourceRows(rows); const lines = metrics.filter((m) => !m.combined).map((metric) => { const metricRows = sourceRows.filter((row) => metricMatches(row, metric)); const home = bestTeamMetric(metricRows, match.home_team_name); const away = bestTeamMetric(metricRows, match.away_team_name); if (!home || !away) return null; const key = metricKey(home); return `- ${metric.label}: ${teamLabel(match.home_team_name)} ${formatValue(numberValue(home), key)} x ${formatValue(numberValue(away), key)} ${teamLabel(match.away_team_name)}`; }).filter(Boolean); return lines.length ? `${header(match)}\n\nResumo solicitado:\n${lines.join('\n')}\n\nFonte: ${sourceLabel(sourceRows[0]?.source_key)}.` : null; }
function formatAllStats(match: any, rows: any[]) { const sourceRows = pickSourceRows(rows); const lines = METRICS.filter((m) => !m.combined).map((metric) => { const metricRows = sourceRows.filter((row) => metricMatches(row, metric)); const home = bestTeamMetric(metricRows, match.home_team_name); const away = bestTeamMetric(metricRows, match.away_team_name); if (!home || !away) return null; const key = metricKey(home); return `- ${metric.label}: ${teamLabel(match.home_team_name)} ${formatValue(numberValue(home), key)} x ${formatValue(numberValue(away), key)} ${teamLabel(match.away_team_name)}`; }).filter(Boolean).slice(0, 14); return lines.length ? `${header(match)}\n\nResumo das principais estatísticas:\n${lines.join('\n')}\n\nFonte: ${sourceLabel(sourceRows[0]?.source_key)}.` : null; }
function formatAnalysis(match: any, rows: any[]) { const sourceRows = pickSourceRows(rows); const hShots = statValue(sourceRows, match.home_team_name, ['shots']); const aShots = statValue(sourceRows, match.away_team_name, ['shots']); const hTarget = statValue(sourceRows, match.home_team_name, ['shots_on_target', 'shotsontarget']); const aTarget = statValue(sourceRows, match.away_team_name, ['shots_on_target', 'shotsontarget']); const hPoss = statValue(sourceRows, match.home_team_name, ['possession']); const aPoss = statValue(sourceRows, match.away_team_name, ['possession']); const hXg = statValue(sourceRows, match.home_team_name, ['expected_goals', 'xg']); const aXg = statValue(sourceRows, match.away_team_name, ['expected_goals', 'xg']); const hCorners = statValue(sourceRows, match.home_team_name, ['corners']); const aCorners = statValue(sourceRows, match.away_team_name, ['corners']); const homeIndex = hShots + hTarget + hXg * 2 + hCorners * 0.4; const awayIndex = aShots + aTarget + aXg * 2 + aCorners * 0.4; const dominant = homeIndex > awayIndex ? teamLabel(match.home_team_name) : awayIndex > homeIndex ? teamLabel(match.away_team_name) : null; const winner = Number(match.home_score ?? 0) > Number(match.away_score ?? 0) ? teamLabel(match.home_team_name) : Number(match.away_score ?? 0) > Number(match.home_score ?? 0) ? teamLabel(match.away_team_name) : null; const resultText = winner ? `${winner} venceu no placar.` : 'O jogo terminou empatado.'; const reading = dominant ? `${dominant} teve os melhores indicadores ofensivos considerando finalizações, chutes no gol, xG e escanteios.` : 'Os principais indicadores ofensivos ficaram equilibrados.'; return `${header(match)}\n\nAnálise do jogo:\n${resultText} ${reading}\n\nNúmeros-chave:\n- Finalizações: ${teamLabel(match.home_team_name)} ${hShots} x ${aShots} ${teamLabel(match.away_team_name)}\n- Finalizações no gol: ${teamLabel(match.home_team_name)} ${hTarget} x ${aTarget} ${teamLabel(match.away_team_name)}\n- Posse: ${teamLabel(match.home_team_name)} ${hPoss}% x ${aPoss}% ${teamLabel(match.away_team_name)}\n- xG: ${teamLabel(match.home_team_name)} ${formatValue(hXg, 'xg')} x ${formatValue(aXg, 'xg')} ${teamLabel(match.away_team_name)}\n- Escanteios: ${teamLabel(match.home_team_name)} ${hCorners} x ${aCorners} ${teamLabel(match.away_team_name)}\n\nFonte: ${sourceLabel(sourceRows[0]?.source_key)}.`; }
function formatCornersSpecialist(match: any, rows: any[]) { const sourceRows = pickSourceRows(rows); const hCorners = statValue(sourceRows, match.home_team_name, ['corners']); const aCorners = statValue(sourceRows, match.away_team_name, ['corners']); const hCrosses = statValue(sourceRows, match.home_team_name, ['crosses']); const aCrosses = statValue(sourceRows, match.away_team_name, ['crosses']); const hShots = statValue(sourceRows, match.home_team_name, ['shots']); const aShots = statValue(sourceRows, match.away_team_name, ['shots']); const total = hCorners + aCorners; const profile = total >= 10 ? 'perfil de over 9.5 escanteios' : total >= 8 ? 'jogo próximo da linha principal de escanteios' : 'perfil baixo de escanteios'; const leader = hCorners > aCorners ? teamLabel(match.home_team_name) : aCorners > hCorners ? teamLabel(match.away_team_name) : 'equilíbrio nos cantos'; return `${header(match)}\n\nLeitura de escanteios:\nO jogo teve ${total} escanteios: ${teamLabel(match.home_team_name)} ${hCorners} x ${aCorners} ${teamLabel(match.away_team_name)}. Foi um ${profile}.\n\nIndicadores relacionados:\n- Cruzamentos: ${teamLabel(match.home_team_name)} ${hCrosses} x ${aCrosses} ${teamLabel(match.away_team_name)}\n- Finalizações: ${teamLabel(match.home_team_name)} ${hShots} x ${aShots} ${teamLabel(match.away_team_name)}\n\nEquipe mais forte em cantos: ${leader}.\n\nFonte: ${sourceLabel(sourceRows[0]?.source_key)}.`; }

export async function answerWorldCupFromDatabase(question: string): Promise<string | null> {
  const q = normalize(question);
  if (!isWorldCupIntent(question)) return null;
  try { assertPersistentDatabaseConfigured(); } catch { return null; }

  if (wantsComparison(question)) { const comparison = await formatTeamComparison(question); if (comparison) return comparison; }
  if (wantsAverage(question) || teamNamesInQuestion(question).length > 0) { const average = await formatTeamAverage(question); if (average && wantsAverage(question)) return average; }
  if (wantsRanking(question) && !teamNamesInQuestion(question).length) { const ranking = await formatRanking(question); if (ranking) return ranking; }

  if (q.includes('previsao') || q.includes('proximo jogo')) {
    const rows = await sql`SELECT id, home_team_name, away_team_name, kickoff_at, group_name, round_name, status FROM world_cup_matches WHERE competition_key = ${WORLD_CUP_2026_KEY} AND kickoff_at >= NOW() - INTERVAL '2 hours' AND LOWER(COALESCE(status, '')) NOT IN ('finished', 'fim', 'final', 'ft') ORDER BY kickoff_at ASC NULLS LAST, id ASC LIMIT 20`;
    if (rows.length > 0) { const teamFiltered = rows.filter((row) => scoreMatch(question, row.home_team_name, row.away_team_name) > 0); const selectedRows = teamFiltered.length ? teamFiltered : rows.slice(0, 5); const lines = selectedRows.map((row) => `- ${teamLabel(row.home_team_name)} x ${teamLabel(row.away_team_name)}`).join('\n'); return `Próximos jogos da Copa do Mundo encontrados no banco:\n\n${lines}\n\nPara ver escanteios, cartões e xG previstos, abra Copa do Mundo > Próximos e clique no jogo.`; }
  }

  const match = await findAskedMatch(question);
  if (!match) return null;
  if (q.includes('resultado') || q.includes('placar') || q.includes('venceu') || q.includes('ganhou') || q.includes('quanto terminou') || q.includes('quanto foi') || q.includes('score')) { const winner = Number(match.home_score ?? 0) > Number(match.away_score ?? 0) ? teamLabel(match.home_team_name) : Number(match.away_score ?? 0) > Number(match.home_score ?? 0) ? teamLabel(match.away_team_name) : 'Empate'; return `${header(match)}\n\nVencedor: ${winner}\nStatus: ${match.status ?? 'não informado'}.`; }
  if (!isStatQuestion(question)) return null;
  const rows = await getMatchStats(Number(match.id));
  if (rows.length === 0) return `Encontrei ${teamLabel(match.home_team_name)} x ${teamLabel(match.away_team_name)}, mas ainda não há estatísticas gravadas para esse jogo.`;
  if (wantsAnalysis(question)) return formatAnalysis(match, rows);
  if (wantsCornerSpecialist(question)) return formatCornersSpecialist(match, rows);
  const requested = metricsFromQuestion(question);
  if (requested.length > 1) return formatMultipleMetrics(match, rows, requested);
  if (requested.length === 1) return formatSingleMetric(match, rows, requested[0]);
  return formatAllStats(match, rows);
}
