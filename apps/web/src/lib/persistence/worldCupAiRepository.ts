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

const TEAM_KEY: Record<string, string> = {
  brazil: 'brasil', brasil: 'brasil', scotland: 'escocia', escocia: 'escocia', tchequia: 'tchequia', mexico: 'mexico', 'africa do sul': 'africa do sul', canada: 'canada', suica: 'suica', catar: 'catar', marrocos: 'marrocos', haiti: 'haiti', usa: 'eua', eua: 'eua', australia: 'australia', paraguai: 'paraguai', turquia: 'turquia', alemanha: 'alemanha', 'costa do marfim': 'costa do marfim', equador: 'equador', curacao: 'curacao', holanda: 'holanda', japao: 'japao', suecia: 'suecia', tunisia: 'tunisia', belgica: 'belgica', egito: 'egito', ira: 'ira', 'nova zelandia': 'nova zelandia', espanha: 'espanha', uruguai: 'uruguai', 'arabia saudita': 'arabia saudita', 'cabo verde': 'cabo verde', franca: 'franca', noruega: 'noruega', senegal: 'senegal', iraque: 'iraque', argentina: 'argentina', austria: 'austria', jordania: 'jordania', argelia: 'argelia', colombia: 'colombia', congo: 'rd congo', 'rd congo': 'rd congo', portugal: 'portugal', uzbequistao: 'uzbequistao', inglaterra: 'inglaterra', gana: 'gana', panama: 'panama', croacia: 'croacia', france: 'franca', spain: 'espanha', england: 'inglaterra', japan: 'japao', sweden: 'suecia', croatia: 'croacia', germany: 'alemanha', belgium: 'belgica', norway: 'noruega'
};

const WORLD_CUP_TEAM_ALIASES = Object.keys(TEAM_KEY);
type MetricAlias = { keys: string[]; label: string; aliases: string[]; combined?: 'cards' };
const METRIC_ALIASES: MetricAlias[] = [
  { keys: ['corners'], label: 'escanteios', aliases: ['escanteio', 'escanteios', 'corner', 'corners', 'cantos'] },
  { keys: ['shots'], label: 'finalizações', aliases: ['finalizacao', 'finalizacoes', 'chute', 'chutes', 'remate', 'remates', 'arremate', 'arremates', 'shots'] },
  { keys: ['shots_on_target', 'shotsontarget'], label: 'finalizações no gol', aliases: ['finalizacoes no gol', 'chutes no gol', 'no gol', 'shots on target'] },
  { keys: ['shots_off_target', 'shotsofftarget'], label: 'finalizações para fora', aliases: ['finalizacoes para fora', 'chutes para fora', 'para fora', 'shots off target'] },
  { keys: ['possession'], label: 'posse de bola', aliases: ['posse', 'posse de bola', 'possession', 'controle da bola'] },
  { keys: ['passes'], label: 'passes totais', aliases: ['passes totais', 'passes', 'passe total', 'troca de passes'] },
  { keys: ['completed_passes', 'completedpasses'], label: 'passes concluídos', aliases: ['passes concluidos', 'passes certos', 'passe certo', 'completed passes'] },
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

function teamKey(value: unknown) { const n = normalize(value); return TEAM_KEY[n] ?? n; }
function isWorldCupIntent(question: string) { const q = normalize(question); return q.includes('copa') || q.includes('mundial') || q.includes('fifa') || q.includes('world cup') || WORLD_CUP_TEAM_ALIASES.some((alias) => alias.length >= 3 && q.includes(alias)); }
function competitionLabel() { return 'Copa do Mundo 2026'; }
function metricScores(question: string) { const q = normalize(question); return METRIC_ALIASES.map((metric) => ({ metric, score: Math.max(...metric.aliases.map((alias) => q.lastIndexOf(normalize(alias)))) })).filter((item) => item.score >= 0).sort((a, b) => b.score - a.score); }
function metricFromQuestion(question: string) { return metricScores(question)[0]?.metric ?? null; }
function metricsFromQuestion(question: string) { const list = metricScores(question).map((item) => item.metric); return list.filter((metric, index) => list.findIndex((m) => m.label === metric.label) === index).slice(0, 4); }
function isStatQuestion(question: string) { const q = normalize(question); return Boolean(metricFromQuestion(question)) || ['estatistica', 'estatisticas', 'quantas', 'quantos', 'quem teve mais', 'quem finalizou mais', 'qual foi', 'analise', 'analisa', 'desempenho', 'dominou', 'mereceu', 'justo', 'melhor', 'over', 'under', 'tendencia'].some((term) => q.includes(normalize(term))); }
function wantsAnalysis(question: string) { const q = normalize(question); return ['analise', 'analisa', 'desempenho', 'quem foi melhor', 'dominou', 'dominio', 'mereceu', 'justo', 'explica', 'por que', 'porque', 'ofensivamente', 'pressionou', 'criou mais'].some((term) => q.includes(normalize(term))); }
function wantsCornerSpecialist(question: string) { const q = normalize(question); return (q.includes('escanteio') || q.includes('corner') || q.includes('canto') || q.includes('over') || q.includes('under')) && ['over', 'under', 'tendencia', 'tendência', 'linha'].some((term) => q.includes(normalize(term))); }
function metricKey(row: any) { return normalize(row.metric_key).replace(/\s+/g, '_'); }
function metricMatches(row: any, metric: MetricAlias) { const key = metricKey(row); const text = normalize(`${row.metric_key} ${row.metric_name}`); return metric.keys.includes(key) || metric.aliases.some((alias) => text.includes(normalize(alias))); }
function scoreMatch(question: string, homeTeam: string, awayTeam: string): number { const q = normalize(question); const compact = q.replace(/\s+/g, ''); let score = 0; for (const name of [homeTeam, awayTeam, teamKey(homeTeam), teamKey(awayTeam)]) { const n = normalize(name); if (n && q.includes(n)) score += 8; if (n && compact.includes(n.replace(/\s+/g, ''))) score += 5; for (const part of n.split(' ').filter((p) => p.length >= 4)) if (q.includes(part)) score += 2; } return score; }
async function findAskedMatch(question: string) { const matches = await sql`SELECT id, home_team_name, away_team_name, home_score, away_score, status, kickoff_at, group_name, round_name FROM world_cup_matches WHERE competition_key = ${WORLD_CUP_2026_KEY} ORDER BY kickoff_at DESC NULLS LAST, id DESC LIMIT 220`; return matches.map((match) => ({ match, score: scoreMatch(question, match.home_team_name, match.away_team_name) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score)[0]?.match ?? null; }
function numberValue(row: any): number { const value = row?.value_numeric ?? row?.value_text ?? 0; const parsed = Number(String(value).replace('%', '').replace(',', '.')); return Number.isFinite(parsed) ? parsed : 0; }
function formatValue(value: number, key = ''): string { if (key.includes('possession')) return `${value}%`; if (key.includes('expected_goals') || key.includes('xg')) return value.toFixed(2).replace('.', ','); return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ','); }
function sourcePriority(source: string) { return source === 'fifa' ? 1 : source === '365scores' ? 2 : 9; }
function pickSourceRows(rows: any[]) { const bestSource = rows.slice().sort((a, b) => sourcePriority(a.source_key) - sourcePriority(b.source_key))[0]?.source_key; return rows.filter((row) => row.source_key === bestSource); }
function bestTeamMetric(rows: any[], wantedTeam: string) { const wanted = teamKey(wantedTeam); return pickSourceRows(rows).filter((row) => teamKey(row.team_name) === wanted)[0] ?? null; }
async function getMatchStats(matchId: number) { return await sql`SELECT ms.source_key, ms.metric_key, ms.metric_name, ms.value_numeric, ms.value_text, t.name AS team_name FROM world_cup_match_statistics ms JOIN world_cup_teams t ON t.id = ms.team_id WHERE ms.match_id = ${matchId} ORDER BY CASE ms.source_key WHEN 'fifa' THEN 1 WHEN '365scores' THEN 2 ELSE 9 END, ms.metric_key, t.name`; }
function sourceLabel(source?: string) { return source === 'fifa' ? 'FIFA' : source === '365scores' ? '365Scores' : 'base local'; }
function cardValue(rows: any[], team: string, keys: string[]) { return numberValue(bestTeamMetric(rows.filter((row) => keys.includes(metricKey(row))), team)); }
function statValue(rows: any[], team: string, keys: string[]) { return numberValue(bestTeamMetric(rows.filter((row) => keys.includes(metricKey(row))), team)); }

function formatCardsAnswer(selected: any, rows: any[]) {
  const sourceRows = pickSourceRows(rows.filter((row) => ['yellow_cards', 'yellowcards', 'red_cards', 'redcards'].includes(metricKey(row))));
  const hy = cardValue(sourceRows, selected.home_team_name, ['yellow_cards', 'yellowcards']);
  const ay = cardValue(sourceRows, selected.away_team_name, ['yellow_cards', 'yellowcards']);
  const hr = cardValue(sourceRows, selected.home_team_name, ['red_cards', 'redcards']);
  const ar = cardValue(sourceRows, selected.away_team_name, ['red_cards', 'redcards']);
  const total = hy + ay + hr + ar;
  const reading = total >= 7 ? 'Foi um jogo quente disciplinarmente.' : total <= 3 ? 'Foi uma partida relativamente disciplinada.' : 'Foi uma partida com nível moderado de cartões.';
  return `${competitionLabel()} — ${selected.home_team_name} ${selected.home_score ?? '-'} x ${selected.away_score ?? '-'} ${selected.away_team_name}.\n\nCartões:\n- ${selected.home_team_name}: ${hy} amarelos e ${hr} vermelhos\n- ${selected.away_team_name}: ${ay} amarelos e ${ar} vermelhos\n\nTotal: ${hy + ay} amarelos e ${hr + ar} vermelhos. ${reading}\n\nFonte: ${sourceLabel(sourceRows[0]?.source_key)}.`;
}

function naturalMetric(selected: any, metric: MetricAlias, homeValue: number, awayValue: number, key: string) {
  const home = selected.home_team_name;
  const away = selected.away_team_name;
  if (key.includes('possession')) {
    const leader = homeValue > awayValue ? home : awayValue > homeValue ? away : null;
    return `Posse de bola:\n- ${home}: ${formatValue(homeValue, key)}\n- ${away}: ${formatValue(awayValue, key)}\n\n${leader ? `${leader} teve mais controle da bola.` : 'A posse ficou equilibrada.'}`;
  }
  if (key.includes('expected_goals') || key.includes('xg')) {
    const leader = homeValue > awayValue ? home : awayValue > homeValue ? away : null;
    return `Gols esperados (xG):\n- ${home}: ${formatValue(homeValue, key)}\n- ${away}: ${formatValue(awayValue, key)}\n\n${leader ? `${leader} criou chances de maior qualidade.` : 'O xG ficou equilibrado.'}`;
  }
  const total = homeValue + awayValue;
  const leader = homeValue > awayValue ? home : awayValue > homeValue ? away : null;
  return `${metric.label[0].toUpperCase()}${metric.label.slice(1)}:\n- ${home}: ${formatValue(homeValue, key)}\n- ${away}: ${formatValue(awayValue, key)}\nTotal: ${formatValue(total, key)}.\n\n${leader ? `${leader} liderou em ${metric.label}.` : `As equipes empataram em ${metric.label}.`}`;
}

function formatSingleMetricAnswer(question: string, selected: any, rows: any[], metric: MetricAlias) {
  if (metric.combined === 'cards') return formatCardsAnswer(selected, rows);
  const metricRows = rows.filter((row) => metricMatches(row, metric));
  if (metricRows.length === 0) return `Encontrei o jogo ${selected.home_team_name} x ${selected.away_team_name} no banco da ${competitionLabel()}, mas ainda não há estatística de ${metric.label} gravada para essa partida.`;
  const homeRow = bestTeamMetric(metricRows, selected.home_team_name);
  const awayRow = bestTeamMetric(metricRows, selected.away_team_name);
  if (!homeRow || !awayRow) return null;
  const homeValue = numberValue(homeRow);
  const awayValue = numberValue(awayRow);
  const key = metricKey(homeRow);
  return `${competitionLabel()} — ${selected.home_team_name} ${selected.home_score ?? '-'} x ${selected.away_score ?? '-'} ${selected.away_team_name}.\n\n${naturalMetric(selected, metric, homeValue, awayValue, key)}\n\nFonte: ${sourceLabel(homeRow.source_key)}.`;
}

function formatMultipleMetricAnswer(selected: any, rows: any[], metrics: MetricAlias[]) {
  const sourceRows = pickSourceRows(rows);
  const lines = metrics.filter((m) => !m.combined).map((metric) => {
    const metricRows = sourceRows.filter((row) => metricMatches(row, metric));
    const home = bestTeamMetric(metricRows, selected.home_team_name);
    const away = bestTeamMetric(metricRows, selected.away_team_name);
    if (!home || !away) return null;
    const key = metricKey(home);
    return `- ${metric.label}: ${selected.home_team_name} ${formatValue(numberValue(home), key)} x ${formatValue(numberValue(away), key)} ${selected.away_team_name}`;
  }).filter(Boolean);
  if (lines.length === 0) return null;
  return `${competitionLabel()} — ${selected.home_team_name} ${selected.home_score ?? '-'} x ${selected.away_score ?? '-'} ${selected.away_team_name}.\n\nResumo solicitado:\n${lines.join('\n')}\n\nFonte: ${sourceLabel(sourceRows[0]?.source_key)}.`;
}

function formatAllStatsAnswer(selected: any, rows: any[]) {
  const sourceRows = pickSourceRows(rows);
  const lines = METRIC_ALIASES.filter((m) => !m.combined).map((metric) => { const metricRows = sourceRows.filter((row) => metricMatches(row, metric)); const home = bestTeamMetric(metricRows, selected.home_team_name); const away = bestTeamMetric(metricRows, selected.away_team_name); if (!home || !away) return null; const key = metricKey(home); return `- ${metric.label}: ${selected.home_team_name} ${formatValue(numberValue(home), key)} x ${formatValue(numberValue(away), key)} ${selected.away_team_name}`; }).filter(Boolean).slice(0, 14);
  if (lines.length === 0) return null;
  return `${competitionLabel()} — ${selected.home_team_name} ${selected.home_score ?? '-'} x ${selected.away_score ?? '-'} ${selected.away_team_name}.\n\nResumo das principais estatísticas:\n${lines.join('\n')}\n\nFonte: ${sourceLabel(sourceRows[0]?.source_key)}.`;
}

function formatAnalysisAnswer(selected: any, rows: any[]) {
  const sourceRows = pickSourceRows(rows);
  const hShots = statValue(sourceRows, selected.home_team_name, ['shots']);
  const aShots = statValue(sourceRows, selected.away_team_name, ['shots']);
  const hTarget = statValue(sourceRows, selected.home_team_name, ['shots_on_target', 'shotsontarget']);
  const aTarget = statValue(sourceRows, selected.away_team_name, ['shots_on_target', 'shotsontarget']);
  const hPoss = statValue(sourceRows, selected.home_team_name, ['possession']);
  const aPoss = statValue(sourceRows, selected.away_team_name, ['possession']);
  const hXg = statValue(sourceRows, selected.home_team_name, ['expected_goals', 'xg']);
  const aXg = statValue(sourceRows, selected.away_team_name, ['expected_goals', 'xg']);
  const hCorners = statValue(sourceRows, selected.home_team_name, ['corners']);
  const aCorners = statValue(sourceRows, selected.away_team_name, ['corners']);
  const hScore = Number(selected.home_score ?? 0);
  const aScore = Number(selected.away_score ?? 0);
  const winner = hScore > aScore ? selected.home_team_name : aScore > hScore ? selected.away_team_name : null;
  const homeIndex = hShots + hTarget + hXg * 2 + hCorners * 0.4;
  const awayIndex = aShots + aTarget + aXg * 2 + aCorners * 0.4;
  const dominant = homeIndex > awayIndex ? selected.home_team_name : awayIndex > homeIndex ? selected.away_team_name : null;
  const conclusion = winner ? `${winner} venceu no placar.` : 'O placar terminou empatado.';
  const reading = dominant ? `${dominant} teve os melhores indicadores ofensivos considerando finalizações, chutes no gol, xG e escanteios.` : 'Os indicadores ofensivos ficaram equilibrados.';
  return `${competitionLabel()} — ${selected.home_team_name} ${selected.home_score ?? '-'} x ${selected.away_score ?? '-'} ${selected.away_team_name}.\n\nAnálise do jogo:\n${conclusion} ${reading}\n\nNúmeros-chave:\n- Finalizações: ${selected.home_team_name} ${hShots} x ${aShots} ${selected.away_team_name}\n- Finalizações no gol: ${selected.home_team_name} ${hTarget} x ${aTarget} ${selected.away_team_name}\n- Posse: ${selected.home_team_name} ${hPoss}% x ${aPoss}% ${selected.away_team_name}\n- xG: ${selected.home_team_name} ${formatValue(hXg, 'xg')} x ${formatValue(aXg, 'xg')} ${selected.away_team_name}\n- Escanteios: ${selected.home_team_name} ${hCorners} x ${aCorners} ${selected.away_team_name}\n\nFonte: ${sourceLabel(sourceRows[0]?.source_key)}.`;
}

function formatCornerSpecialistAnswer(selected: any, rows: any[]) {
  const sourceRows = pickSourceRows(rows);
  const hCorners = statValue(sourceRows, selected.home_team_name, ['corners']);
  const aCorners = statValue(sourceRows, selected.away_team_name, ['corners']);
  const hCrosses = statValue(sourceRows, selected.home_team_name, ['crosses']);
  const aCrosses = statValue(sourceRows, selected.away_team_name, ['crosses']);
  const hShots = statValue(sourceRows, selected.home_team_name, ['shots']);
  const aShots = statValue(sourceRows, selected.away_team_name, ['shots']);
  const total = hCorners + aCorners;
  const profile = total >= 10 ? 'perfil de over 9.5 escanteios' : total >= 8 ? 'jogo próximo da linha principal de escanteios' : 'perfil baixo de escanteios';
  const leader = hCorners > aCorners ? selected.home_team_name : aCorners > hCorners ? selected.away_team_name : 'equilíbrio nos cantos';
  return `${competitionLabel()} — ${selected.home_team_name} ${selected.home_score ?? '-'} x ${selected.away_score ?? '-'} ${selected.away_team_name}.\n\nLeitura de escanteios:\nO jogo teve ${total} escanteios: ${selected.home_team_name} ${hCorners} x ${aCorners} ${selected.away_team_name}. Foi um ${profile}.\n\nIndicadores relacionados:\n- Cruzamentos: ${selected.home_team_name} ${hCrosses} x ${aCrosses} ${selected.away_team_name}\n- Finalizações: ${selected.home_team_name} ${hShots} x ${aShots} ${selected.away_team_name}\n\nEquipe mais forte em cantos: ${leader}.\n\nFonte: ${sourceLabel(sourceRows[0]?.source_key)}.`;
}

export async function answerWorldCupFromDatabase(question: string): Promise<string | null> {
  const q = normalize(question);
  if (!isWorldCupIntent(question)) return null;
  try { assertPersistentDatabaseConfigured(); } catch { return null; }

  if (q.includes('previsao') || q.includes('proximo jogo')) {
    const rows = await sql`SELECT id, home_team_name, away_team_name, kickoff_at, group_name, round_name, status FROM world_cup_matches WHERE competition_key = ${WORLD_CUP_2026_KEY} AND kickoff_at >= NOW() - INTERVAL '2 hours' AND LOWER(COALESCE(status, '')) NOT IN ('finished', 'fim', 'final', 'ft') ORDER BY kickoff_at ASC NULLS LAST, id ASC LIMIT 20`;
    if (rows.length > 0) {
      const teamFiltered = rows.filter((row) => scoreMatch(question, row.home_team_name, row.away_team_name) > 0);
      const selectedRows = teamFiltered.length ? teamFiltered : rows.slice(0, 5);
      const lines = selectedRows.map((row) => `- ${row.home_team_name} x ${row.away_team_name} (${row.kickoff_at ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(row.kickoff_at)) : 'data não informada'})`).join('\n');
      return `Próximos jogos da ${competitionLabel()} encontrados no banco:\n\n${lines}\n\nPara ver escanteios, cartões e xG previstos, abra Copa do Mundo > Próximos e clique no jogo.`;
    }
  }

  if (q.includes('classificacao') || q.includes('classificação') || q.includes('tabela') || q.includes('grupo')) {
    const rows = await sql`SELECT s.group_name, s.position, t.name AS team_name, s.played, s.goal_difference, s.points FROM world_cup_standings s JOIN world_cup_teams t ON t.id = s.team_id WHERE s.competition_key = ${WORLD_CUP_2026_KEY} ORDER BY s.group_name NULLS LAST, s.position, s.points DESC, s.goal_difference DESC, t.name LIMIT 80`;
    if (rows.length === 0) return 'Ainda não existe classificação da Copa do Mundo gravada no banco persistente.';
    const grouped = rows.reduce<Record<string, typeof rows>>((acc, row) => { const group = row.group_name || 'Grupo sem nome'; acc[group] = acc[group] ?? []; acc[group].push(row); return acc; }, {});
    return Object.entries(grouped).map(([group, items]) => `${group}:\n${items.map((row) => `${row.position}. ${row.team_name} — ${row.points} pts, ${row.played}J, SG ${row.goal_difference}`).join('\n')}`).join('\n\n');
  }

  if (q.includes('resultado') || q.includes('placar') || q.includes('venceu') || q.includes('ganhou') || q.includes('quanto terminou') || q.includes('quanto foi') || q.includes('score')) {
    const selected = await findAskedMatch(question);
    if (!selected) return null;
    let winner = 'Empate';
    if (selected.home_score !== null && selected.away_score !== null) {
      if (Number(selected.home_score) > Number(selected.away_score)) winner = selected.home_team_name;
      else if (Number(selected.away_score) > Number(selected.home_score)) winner = selected.away_team_name;
    } else winner = 'Resultado ainda não informado';
    return [`${competitionLabel()} — resultado: ${selected.home_team_name} ${selected.home_score ?? '-'} x ${selected.away_score ?? '-'} ${selected.away_team_name}`, '', `Vencedor: ${winner}`, `Status: ${selected.status ?? 'não informado'}`].join('\n');
  }

  if (isStatQuestion(question)) {
    const selected = await findAskedMatch(question);
    if (!selected) return null;
    const rows = await getMatchStats(Number(selected.id));
    if (rows.length === 0) return `Encontrei o jogo ${selected.home_team_name} x ${selected.away_team_name} no banco da ${competitionLabel()}, mas ainda não há estatísticas gravadas para essa partida.`;
    if (wantsAnalysis(question)) return formatAnalysisAnswer(selected, rows);
    if (wantsCornerSpecialist(question)) return formatCornerSpecialistAnswer(selected, rows);
    const requestedMetrics = metricsFromQuestion(question);
    if (requestedMetrics.length > 1) return formatMultipleMetricAnswer(selected, rows, requestedMetrics);
    if (requestedMetrics.length === 1) return formatSingleMetricAnswer(question, selected, rows, requestedMetrics[0]);
    return formatAllStatsAnswer(selected, rows);
  }

  return null;
}
