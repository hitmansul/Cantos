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
  brazil: 'brasil', brasil: 'brasil', scotland: 'escocia', escocia: 'escocia', tchequia: 'tchequia', mexico: 'mexico', 'africa do sul': 'africa do sul', canada: 'canada', suica: 'suica', catar: 'catar', marrocos: 'marrocos', haiti: 'haiti', usa: 'eua', eua: 'eua', australia: 'australia', paraguai: 'paraguai', turquia: 'turquia', alemanha: 'alemanha', 'costa do marfim': 'costa do marfim', equador: 'equador', curacao: 'curacao', holanda: 'holanda', japao: 'japao', suecia: 'suecia', tunisia: 'tunisia', belgica: 'belgica', egito: 'egito', ira: 'ira', 'nova zelandia': 'nova zelandia', espanha: 'espanha', uruguai: 'uruguai', 'arabia saudita': 'arabia saudita', 'cabo verde': 'cabo verde', franca: 'franca', noruega: 'noruega', senegal: 'senegal', iraque: 'iraque', argentina: 'argentina', austria: 'austria', jordania: 'jordania', argelia: 'argelia', colombia: 'colombia', congo: 'rd congo', 'rd congo': 'rd congo', portugal: 'portugal', uzbequistao: 'uzbequistao', inglaterra: 'inglaterra', gana: 'gana', panama: 'panama', croacia: 'croacia', france: 'franca', spain: 'espanha', england: 'inglaterra', japan: 'japao', sweden: 'suecia', croatia: 'croacia', germany: 'alemanha', belgium: 'belgica', norway: 'noruega'
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

function teamKey(value: unknown) {
  const n = normalize(value);
  return TEAM_KEY[n] ?? n;
}

function hasWholeTerm(question: string, term: string) {
  return ` ${normalize(question)} `.includes(` ${normalize(term)} `);
}

function mentionedWorldCupTeams(question: string) {
  const found = new Set<string>();
  for (const alias of WORLD_CUP_TEAM_ALIASES) {
    if (alias.length >= 3 && hasWholeTerm(question, alias)) found.add(TEAM_KEY[alias] ?? alias);
  }
  return found.size;
}

function isWorldCupIntent(question: string) {
  const q = normalize(question);
  if (CLUB_COMPETITION_TERMS.some((term) => q.includes(normalize(term)))) return false;
  if (q.includes('copa do mundo') || q.includes('world cup') || q.includes('fifa world cup')) return true;
  if ((q.includes('mundial') || q.includes('fifa')) && !q.includes('mundial de clubes')) return true;
  return mentionedWorldCupTeams(question) >= 2;
}

function metricScores(question: string) {
  const q = normalize(question);
  return METRICS
    .map((metric) => ({ metric, score: Math.max(...metric.aliases.map((alias) => q.lastIndexOf(normalize(alias)))) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score);
}

function metricsFromQuestion(question: string) {
  const list = metricScores(question).map((item) => item.metric);
  return list.filter((metric, index) => list.findIndex((m) => m.label === metric.label) === index).slice(0, 4);
}

function metricFromQuestion(question: string) {
  return metricScores(question)[0]?.metric ?? null;
}

function isStatQuestion(question: string) {
  const q = normalize(question);
  return Boolean(metricFromQuestion(question)) || ['estatistica', 'estatisticas', 'quantas', 'quantos', 'quem teve mais', 'quem finalizou mais', 'qual foi', 'analise', 'analisa', 'desempenho', 'dominou', 'mereceu', 'justo', 'melhor', 'over', 'under', 'tendencia'].some((term) => q.includes(normalize(term)));
}

function wantsAnalysis(question: string) {
  const q = normalize(question);
  return ['analise', 'analisa', 'desempenho', 'quem foi melhor', 'dominou', 'dominio', 'mereceu', 'justo', 'explica', 'por que', 'porque', 'ofensivamente', 'pressionou', 'criou mais'].some((term) => q.includes(normalize(term)));
}

function wantsCornerSpecialist(question: string) {
  const q = normalize(question);
  return (q.includes('escanteio') || q.includes('corner') || q.includes('canto') || q.includes('over') || q.includes('under')) && ['over', 'under', 'tendencia', 'tendência', 'linha'].some((term) => q.includes(normalize(term)));
}

function metricKey(row: any) {
  return normalize(row.metric_key).replace(/\s+/g, '_');
}

function metricMatches(row: any, metric: MetricAlias) {
  const key = metricKey(row);
  const text = normalize(`${row.metric_key} ${row.metric_name}`);
  return metric.keys.includes(key) || metric.aliases.some((alias) => text.includes(normalize(alias)));
}

function scoreMatch(question: string, homeTeam: string, awayTeam: string) {
  let score = 0;
  for (const name of [homeTeam, awayTeam, teamKey(homeTeam), teamKey(awayTeam)]) {
    const n = normalize(name);
    if (n && hasWholeTerm(question, n)) score += 10;
    for (const part of n.split(' ').filter((p) => p.length >= 4)) if (hasWholeTerm(question, part)) score += 2;
  }
  return score;
}

async function findAskedMatch(question: string) {
  const matches = await sql`
    SELECT id, home_team_name, away_team_name, home_score, away_score, status, kickoff_at, group_name, round_name
    FROM world_cup_matches
    WHERE competition_key = ${WORLD_CUP_2026_KEY}
    ORDER BY kickoff_at DESC NULLS LAST, id DESC
    LIMIT 220
  `;
  return matches
    .map((match) => ({ match, score: scoreMatch(question, match.home_team_name, match.away_team_name) }))
    .filter((item) => item.score >= 10)
    .sort((a, b) => b.score - a.score)[0]?.match ?? null;
}

async function getMatchStats(matchId: number) {
  return await sql`
    SELECT ms.source_key, ms.metric_key, ms.metric_name, ms.value_numeric, ms.value_text, t.name AS team_name
    FROM world_cup_match_statistics ms
    JOIN world_cup_teams t ON t.id = ms.team_id
    WHERE ms.match_id = ${matchId}
    ORDER BY CASE ms.source_key WHEN 'fifa' THEN 1 WHEN '365scores' THEN 2 ELSE 9 END, ms.metric_key, t.name
  `;
}

function sourcePriority(source: string) {
  return source === 'fifa' ? 1 : source === '365scores' ? 2 : 9;
}

function pickSourceRows(rows: any[]) {
  const bestSource = rows.slice().sort((a, b) => sourcePriority(a.source_key) - sourcePriority(b.source_key))[0]?.source_key;
  return rows.filter((row) => row.source_key === bestSource);
}

function bestTeamMetric(rows: any[], wantedTeam: string) {
  const wanted = teamKey(wantedTeam);
  return pickSourceRows(rows).find((row) => teamKey(row.team_name) === wanted) ?? null;
}

function numberValue(row: any): number {
  const parsed = Number(String(row?.value_numeric ?? row?.value_text ?? 0).replace('%', '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatValue(value: number, key = '') {
  if (key.includes('possession')) return `${value}%`;
  if (key.includes('expected_goals') || key === 'xg') return value.toFixed(2).replace('.', ',');
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

function sourceLabel(source?: string) {
  return source === 'fifa' ? 'FIFA' : source === '365scores' ? '365Scores' : 'base local';
}

function statValue(rows: any[], team: string, keys: string[]) {
  return numberValue(bestTeamMetric(rows.filter((row) => keys.includes(metricKey(row))), team));
}

function header(match: any) {
  return `Copa do Mundo 2026 — ${match.home_team_name} ${match.home_score ?? '-'} x ${match.away_score ?? '-'} ${match.away_team_name}.`;
}

function formatCards(match: any, rows: any[]) {
  const sourceRows = pickSourceRows(rows.filter((row) => ['yellow_cards', 'yellowcards', 'red_cards', 'redcards'].includes(metricKey(row))));
  const hy = statValue(sourceRows, match.home_team_name, ['yellow_cards', 'yellowcards']);
  const ay = statValue(sourceRows, match.away_team_name, ['yellow_cards', 'yellowcards']);
  const hr = statValue(sourceRows, match.home_team_name, ['red_cards', 'redcards']);
  const ar = statValue(sourceRows, match.away_team_name, ['red_cards', 'redcards']);
  const total = hy + ay + hr + ar;
  const reading = total >= 7 ? 'Foi um jogo quente disciplinarmente.' : total <= 3 ? 'Foi uma partida relativamente disciplinada.' : 'Foi uma partida com nível moderado de cartões.';
  return `${header(match)}\n\nCartões:\n- ${match.home_team_name}: ${hy} amarelos e ${hr} vermelhos\n- ${match.away_team_name}: ${ay} amarelos e ${ar} vermelhos\n\nTotal: ${hy + ay} amarelos e ${hr + ar} vermelhos. ${reading}\n\nFonte: ${sourceLabel(sourceRows[0]?.source_key)}.`;
}

function naturalMetric(match: any, metric: MetricAlias, homeValue: number, awayValue: number, key: string) {
  const home = match.home_team_name;
  const away = match.away_team_name;
  if (key.includes('possession')) {
    const leader = homeValue > awayValue ? home : awayValue > homeValue ? away : null;
    return `Posse de bola:\n- ${home}: ${formatValue(homeValue, key)}\n- ${away}: ${formatValue(awayValue, key)}\n\n${leader ? `${leader} teve mais controle da bola.` : 'A posse ficou equilibrada.'}`;
  }
  if (key.includes('expected_goals') || key === 'xg') {
    const leader = homeValue > awayValue ? home : awayValue > homeValue ? away : null;
    return `Gols esperados (xG):\n- ${home}: ${formatValue(homeValue, key)}\n- ${away}: ${formatValue(awayValue, key)}\n\n${leader ? `${leader} criou chances de maior qualidade.` : 'O xG ficou equilibrado.'}`;
  }
  const total = homeValue + awayValue;
  const leader = homeValue > awayValue ? home : awayValue > homeValue ? away : null;
  return `${metric.label[0].toUpperCase()}${metric.label.slice(1)}:\n- ${home}: ${formatValue(homeValue, key)}\n- ${away}: ${formatValue(awayValue, key)}\nTotal: ${formatValue(total, key)}.\n\n${leader ? `${leader} liderou em ${metric.label}.` : `As equipes empataram em ${metric.label}.`}`;
}

function formatSingleMetric(match: any, rows: any[], metric: MetricAlias) {
  if (metric.combined === 'cards') return formatCards(match, rows);
  const metricRows = rows.filter((row) => metricMatches(row, metric));
  const home = bestTeamMetric(metricRows, match.home_team_name);
  const away = bestTeamMetric(metricRows, match.away_team_name);
  if (!home || !away) return `Encontrei ${match.home_team_name} x ${match.away_team_name}, mas ainda não há estatística de ${metric.label} gravada para essa partida.`;
  return `${header(match)}\n\n${naturalMetric(match, metric, numberValue(home), numberValue(away), metricKey(home))}\n\nFonte: ${sourceLabel(home.source_key)}.`;
}

function formatMultipleMetrics(match: any, rows: any[], metrics: MetricAlias[]) {
  const sourceRows = pickSourceRows(rows);
  const lines = metrics.filter((m) => !m.combined).map((metric) => {
    const metricRows = sourceRows.filter((row) => metricMatches(row, metric));
    const home = bestTeamMetric(metricRows, match.home_team_name);
    const away = bestTeamMetric(metricRows, match.away_team_name);
    if (!home || !away) return null;
    const key = metricKey(home);
    return `- ${metric.label}: ${match.home_team_name} ${formatValue(numberValue(home), key)} x ${formatValue(numberValue(away), key)} ${match.away_team_name}`;
  }).filter(Boolean);
  return lines.length ? `${header(match)}\n\nResumo solicitado:\n${lines.join('\n')}\n\nFonte: ${sourceLabel(sourceRows[0]?.source_key)}.` : null;
}

function formatAllStats(match: any, rows: any[]) {
  const sourceRows = pickSourceRows(rows);
  const lines = METRICS.filter((m) => !m.combined).map((metric) => {
    const metricRows = sourceRows.filter((row) => metricMatches(row, metric));
    const home = bestTeamMetric(metricRows, match.home_team_name);
    const away = bestTeamMetric(metricRows, match.away_team_name);
    if (!home || !away) return null;
    const key = metricKey(home);
    return `- ${metric.label}: ${match.home_team_name} ${formatValue(numberValue(home), key)} x ${formatValue(numberValue(away), key)} ${match.away_team_name}`;
  }).filter(Boolean).slice(0, 14);
  return lines.length ? `${header(match)}\n\nResumo das principais estatísticas:\n${lines.join('\n')}\n\nFonte: ${sourceLabel(sourceRows[0]?.source_key)}.` : null;
}

function formatAnalysis(match: any, rows: any[]) {
  const sourceRows = pickSourceRows(rows);
  const hShots = statValue(sourceRows, match.home_team_name, ['shots']);
  const aShots = statValue(sourceRows, match.away_team_name, ['shots']);
  const hTarget = statValue(sourceRows, match.home_team_name, ['shots_on_target', 'shotsontarget']);
  const aTarget = statValue(sourceRows, match.away_team_name, ['shots_on_target', 'shotsontarget']);
  const hPoss = statValue(sourceRows, match.home_team_name, ['possession']);
  const aPoss = statValue(sourceRows, match.away_team_name, ['possession']);
  const hXg = statValue(sourceRows, match.home_team_name, ['expected_goals', 'xg']);
  const aXg = statValue(sourceRows, match.away_team_name, ['expected_goals', 'xg']);
  const hCorners = statValue(sourceRows, match.home_team_name, ['corners']);
  const aCorners = statValue(sourceRows, match.away_team_name, ['corners']);
  const homeIndex = hShots + hTarget + hXg * 2 + hCorners * 0.4;
  const awayIndex = aShots + aTarget + aXg * 2 + aCorners * 0.4;
  const dominant = homeIndex > awayIndex ? match.home_team_name : awayIndex > homeIndex ? match.away_team_name : null;
  const winner = Number(match.home_score ?? 0) > Number(match.away_score ?? 0) ? match.home_team_name : Number(match.away_score ?? 0) > Number(match.home_score ?? 0) ? match.away_team_name : null;
  const resultText = winner ? `${winner} venceu no placar.` : 'O jogo terminou empatado.';
  const reading = dominant ? `${dominant} teve os melhores indicadores ofensivos considerando finalizações, chutes no gol, xG e escanteios.` : 'Os principais indicadores ofensivos ficaram equilibrados.';
  return `${header(match)}\n\nAnálise do jogo:\n${resultText} ${reading}\n\nNúmeros-chave:\n- Finalizações: ${match.home_team_name} ${hShots} x ${aShots} ${match.away_team_name}\n- Finalizações no gol: ${match.home_team_name} ${hTarget} x ${aTarget} ${match.away_team_name}\n- Posse: ${match.home_team_name} ${hPoss}% x ${aPoss}% ${match.away_team_name}\n- xG: ${match.home_team_name} ${formatValue(hXg, 'xg')} x ${formatValue(aXg, 'xg')} ${match.away_team_name}\n- Escanteios: ${match.home_team_name} ${hCorners} x ${aCorners} ${match.away_team_name}\n\nFonte: ${sourceLabel(sourceRows[0]?.source_key)}.`;
}

function formatCornersSpecialist(match: any, rows: any[]) {
  const sourceRows = pickSourceRows(rows);
  const hCorners = statValue(sourceRows, match.home_team_name, ['corners']);
  const aCorners = statValue(sourceRows, match.away_team_name, ['corners']);
  const hCrosses = statValue(sourceRows, match.home_team_name, ['crosses']);
  const aCrosses = statValue(sourceRows, match.away_team_name, ['crosses']);
  const hShots = statValue(sourceRows, match.home_team_name, ['shots']);
  const aShots = statValue(sourceRows, match.away_team_name, ['shots']);
  const total = hCorners + aCorners;
  const profile = total >= 10 ? 'perfil de over 9.5 escanteios' : total >= 8 ? 'jogo próximo da linha principal de escanteios' : 'perfil baixo de escanteios';
  const leader = hCorners > aCorners ? match.home_team_name : aCorners > hCorners ? match.away_team_name : 'equilíbrio nos cantos';
  return `${header(match)}\n\nLeitura de escanteios:\nO jogo teve ${total} escanteios: ${match.home_team_name} ${hCorners} x ${aCorners} ${match.away_team_name}. Foi um ${profile}.\n\nIndicadores relacionados:\n- Cruzamentos: ${match.home_team_name} ${hCrosses} x ${aCrosses} ${match.away_team_name}\n- Finalizações: ${match.home_team_name} ${hShots} x ${aShots} ${match.away_team_name}\n\nEquipe mais forte em cantos: ${leader}.\n\nFonte: ${sourceLabel(sourceRows[0]?.source_key)}.`;
}

export async function answerWorldCupFromDatabase(question: string): Promise<string | null> {
  const q = normalize(question);
  if (!isWorldCupIntent(question)) return null;
  try { assertPersistentDatabaseConfigured(); } catch { return null; }

  if (q.includes('previsao') || q.includes('proximo jogo')) {
    const rows = await sql`
      SELECT id, home_team_name, away_team_name, kickoff_at, group_name, round_name, status
      FROM world_cup_matches
      WHERE competition_key = ${WORLD_CUP_2026_KEY}
        AND kickoff_at >= NOW() - INTERVAL '2 hours'
        AND LOWER(COALESCE(status, '')) NOT IN ('finished', 'fim', 'final', 'ft')
      ORDER BY kickoff_at ASC NULLS LAST, id ASC
      LIMIT 20
    `;
    if (rows.length > 0) {
      const teamFiltered = rows.filter((row) => scoreMatch(question, row.home_team_name, row.away_team_name) > 0);
      const selectedRows = teamFiltered.length ? teamFiltered : rows.slice(0, 5);
      const lines = selectedRows.map((row) => `- ${row.home_team_name} x ${row.away_team_name}`).join('\n');
      return `Próximos jogos da Copa do Mundo encontrados no banco:\n\n${lines}\n\nPara ver escanteios, cartões e xG previstos, abra Copa do Mundo > Próximos e clique no jogo.`;
    }
  }

  const match = await findAskedMatch(question);
  if (!match) return null;

  if (q.includes('resultado') || q.includes('placar') || q.includes('venceu') || q.includes('ganhou') || q.includes('quanto terminou') || q.includes('quanto foi') || q.includes('score')) {
    const winner = Number(match.home_score ?? 0) > Number(match.away_score ?? 0) ? match.home_team_name : Number(match.away_score ?? 0) > Number(match.home_score ?? 0) ? match.away_team_name : 'Empate';
    return `${header(match)}\n\nVencedor: ${winner}\nStatus: ${match.status ?? 'não informado'}.`;
  }

  if (!isStatQuestion(question)) return null;

  const rows = await getMatchStats(Number(match.id));
  if (rows.length === 0) return `Encontrei ${match.home_team_name} x ${match.away_team_name}, mas ainda não há estatísticas gravadas para esse jogo.`;

  if (wantsAnalysis(question)) return formatAnalysis(match, rows);
  if (wantsCornerSpecialist(question)) return formatCornersSpecialist(match, rows);

  const requested = metricsFromQuestion(question);
  if (requested.length > 1) return formatMultipleMetrics(match, rows, requested);
  if (requested.length === 1) return formatSingleMetric(match, rows, requested[0]);
  return formatAllStats(match, rows);
}
