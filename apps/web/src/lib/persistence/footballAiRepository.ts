import sql from '@/app/api/utils/sql';
import { assertPersistentDatabaseConfigured } from './database';

function normalize(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type MetricIntent = {
  keys: string[];
  label: string;
  aliases: string[];
  combined?: 'cards';
  group?: 'attack' | 'build' | 'discipline' | 'defense';
};

const METRICS: MetricIntent[] = [
  { keys: ['corners'], label: 'escanteios', aliases: ['escanteio', 'escanteios', 'corner', 'corners', 'cantos'], group: 'attack' },
  { keys: ['shots'], label: 'finalizações', aliases: ['finalizacao', 'finalizacoes', 'chute', 'chutes', 'remate', 'remates', 'arremate', 'arremates', 'shots'], group: 'attack' },
  { keys: ['shots_on_target', 'shotsontarget'], label: 'finalizações no gol', aliases: ['finalizacoes no gol', 'chutes no gol', 'no gol', 'shots on target'], group: 'attack' },
  { keys: ['shots_off_target', 'shotsofftarget'], label: 'finalizações para fora', aliases: ['finalizacoes para fora', 'chutes para fora', 'para fora', 'shots off target'], group: 'attack' },
  { keys: ['possession'], label: 'posse de bola', aliases: ['posse', 'posse de bola', 'possession', 'controle da bola'], group: 'build' },
  { keys: ['passes'], label: 'passes totais', aliases: ['passes totais', 'passes', 'troca de passes'], group: 'build' },
  { keys: ['completed_passes', 'completedpasses'], label: 'passes concluídos', aliases: ['passes concluidos', 'passes certos', 'completed passes'], group: 'build' },
  { keys: ['crosses'], label: 'cruzamentos', aliases: ['cruzamentos', 'cruzamento', 'bola na area', 'crosses'], group: 'attack' },
  { keys: ['completed_crosses', 'completedcrosses'], label: 'cruzamentos concluídos', aliases: ['cruzamentos concluidos', 'cruzamentos certos', 'completed crosses'], group: 'attack' },
  { keys: ['yellow_cards', 'yellowcards'], label: 'cartões amarelos', aliases: ['cartoes amarelos', 'cartao amarelo', 'amarelos', 'yellow cards'], group: 'discipline' },
  { keys: ['red_cards', 'redcards'], label: 'cartões vermelhos', aliases: ['cartoes vermelhos', 'cartao vermelho', 'vermelhos', 'red cards'], group: 'discipline' },
  { keys: ['yellow_cards', 'yellowcards', 'red_cards', 'redcards'], label: 'cartões', aliases: ['cartoes', 'cartao', 'cartões', 'cartão', 'cards', 'disciplina'], combined: 'cards', group: 'discipline' },
  { keys: ['fouls'], label: 'faltas', aliases: ['faltas', 'falta', 'fouls'], group: 'discipline' },
  { keys: ['offsides'], label: 'impedimentos', aliases: ['impedimentos', 'impedimento', 'offsides'], group: 'attack' },
  { keys: ['goalkeeper_saves', 'saves'], label: 'defesas do goleiro', aliases: ['defesas do goleiro', 'defesas', 'saves'], group: 'defense' },
  { keys: ['expected_goals', 'xg'], label: 'gols esperados (xG)', aliases: ['xg', 'gols esperados', 'expected goals', 'chance clara', 'chances claras'], group: 'attack' },
  { keys: ['goals'], label: 'gols', aliases: ['gols', 'gol'], group: 'attack' },
  { keys: ['assists'], label: 'assistências', aliases: ['assistencias', 'assistencia', 'assists'], group: 'attack' },
];

const COMPETITIONS: Array<{ label: string; aliases: string[] }> = [
  { label: 'Brasileirão', aliases: ['brasileirao', 'brasileiro serie a', 'serie a brasil', 'campeonato brasileiro'] },
  { label: 'Brasileirão Série B', aliases: ['serie b', 'brasileirao serie b', 'brasileiro serie b'] },
  { label: 'Copa do Brasil', aliases: ['copa do brasil'] },
  { label: 'Libertadores', aliases: ['libertadores', 'copa libertadores'] },
  { label: 'Sul-Americana', aliases: ['sul americana', 'sulamericana', 'copa sul americana'] },
  { label: 'Champions League', aliases: ['champions', 'champions league', 'ucl', 'liga dos campeoes'] },
  { label: 'Europa League', aliases: ['europa league', 'liga europa'] },
  { label: 'Conference League', aliases: ['conference league'] },
  { label: 'Premier League', aliases: ['premier league', 'ingles', 'inglaterra'] },
  { label: 'La Liga', aliases: ['la liga', 'espanhol', 'espanha'] },
  { label: 'Serie A Italiana', aliases: ['serie a italiana', 'italiano', 'italia'] },
  { label: 'Bundesliga', aliases: ['bundesliga', 'alemao', 'alemanha'] },
  { label: 'Ligue 1', aliases: ['ligue 1', 'frances', 'franca'] },
  { label: 'Mundial de Clubes', aliases: ['mundial de clubes', 'club world cup'] },
  { label: 'Copa do Mundo', aliases: ['copa do mundo', 'mundial', 'world cup', 'fifa'] },
];

function competitionFromQuestion(question: string): string | null {
  const q = normalize(question);
  const found = COMPETITIONS.find((competition) => competition.aliases.some((alias) => q.includes(normalize(alias))));
  return found?.label ?? null;
}

function metricScores(question: string) {
  const q = normalize(question);
  return METRICS
    .map((metric) => ({ metric, score: Math.max(...metric.aliases.map((alias) => q.lastIndexOf(normalize(alias)))) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score);
}

function metricFromQuestion(question: string): MetricIntent | null {
  return metricScores(question)[0]?.metric ?? null;
}

function metricsFromQuestion(question: string): MetricIntent[] {
  const selected = metricScores(question).map((item) => item.metric);
  const unique = selected.filter((metric, index) => selected.findIndex((m) => m.label === metric.label) === index);
  return unique.slice(0, 4);
}

function isStatsQuestion(question: string) {
  const q = normalize(question);
  return Boolean(metricFromQuestion(question)) || ['estatistica', 'estatisticas', 'quantas', 'quantos', 'quem teve mais', 'comparar', 'compare', 'analise', 'analisa', 'desempenho', 'dominou', 'dominio', 'mereceu', 'justo', 'melhor', 'ofensivo', 'pressao', 'pressionou', 'over', 'under', 'tendencia', 'tendência'].some((term) => q.includes(normalize(term)));
}

function wantsAnalysis(question: string) {
  const q = normalize(question);
  return ['analise', 'analisa', 'desempenho', 'quem foi melhor', 'dominou', 'dominio', 'mereceu', 'justo', 'explica', 'por que', 'porque', 'ofensivamente', 'pressionou', 'criou mais'].some((term) => q.includes(normalize(term)));
}

function wantsCornerSpecialist(question: string) {
  const q = normalize(question);
  return q.includes('escanteio') || q.includes('corner') || q.includes('canto') || q.includes('over') || q.includes('under');
}

function scoreEvent(question: string, event: any): number {
  const q = normalize(question);
  const compact = q.replace(/\s+/g, '');
  let score = 0;
  for (const name of [event.home_team_name, event.away_team_name]) {
    const n = normalize(name);
    if (!n) continue;
    if (q.includes(n)) score += 12;
    if (compact.includes(n.replace(/\s+/g, ''))) score += 8;
    for (const part of n.split(' ').filter((p) => p.length >= 4)) if (q.includes(part)) score += 2;
  }
  const competition = competitionFromQuestion(question);
  if (competition && normalize(event.competition_name).includes(normalize(competition))) score += 8;
  return score;
}

function metricKey(row: any) {
  return normalize(row.metric_key).replace(/\s+/g, '_');
}

function metricMatches(row: any, metric: MetricIntent) {
  const key = metricKey(row);
  const text = normalize(`${row.metric_key} ${row.metric_name}`);
  return metric.keys.includes(key) || metric.aliases.some((alias) => text.includes(normalize(alias)));
}

function numberValue(row: any): number {
  const value = row?.value_numeric ?? row?.value_text ?? 0;
  const parsed = Number(String(value).replace('%', '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatValue(value: number, key = '') {
  if (key.includes('possession')) return `${value}%`;
  if (key.includes('expected_goals') || key === 'xg') return value.toFixed(2).replace('.', ',');
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

function sideRows(rows: any[], side: 'home' | 'away') {
  return rows.filter((row) => row.team_side === side || normalize(row.team_name) === normalize(side));
}

async function findGenericEvent(question: string) {
  const competition = competitionFromQuestion(question);
  const events = await sql`
    SELECT id, competition_key, competition_name, home_team_name, away_team_name, home_score, away_score, status, match_minute, kickoff_at, source_key
    FROM live_events
    WHERE (${competition}::text IS NULL OR LOWER(COALESCE(competition_name, '')) LIKE ${'%' + normalize(competition ?? '').replace(/ /g, '%') + '%'})
    ORDER BY kickoff_at DESC NULLS LAST, id DESC
    LIMIT 300
  `;
  return events
    .map((event) => ({ event, score: scoreEvent(question, event) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.event ?? null;
}

async function getGenericStats(eventId: number) {
  return await sql`
    SELECT team_side, team_name, metric_key, metric_name, value_numeric, value_text, source_key
    FROM live_event_statistics
    WHERE live_event_id = ${eventId}
    ORDER BY metric_key, team_side
  `;
}

function metricValue(rows: any[], metric: MetricIntent, side: 'home' | 'away') {
  const metricRows = rows.filter((row) => metricMatches(row, metric));
  const row = sideRows(metricRows, side)[0];
  return row ? { row, value: numberValue(row), key: metricKey(row) } : null;
}

function formatCards(event: any, rows: any[]) {
  const yellows = rows.filter((row) => ['yellow_cards', 'yellowcards'].includes(metricKey(row)));
  const reds = rows.filter((row) => ['red_cards', 'redcards'].includes(metricKey(row)));
  const hy = numberValue(sideRows(yellows, 'home')[0]);
  const ay = numberValue(sideRows(yellows, 'away')[0]);
  const hr = numberValue(sideRows(reds, 'home')[0]);
  const ar = numberValue(sideRows(reds, 'away')[0]);
  const total = hy + ay + hr + ar;
  const discipline = total >= 7 ? 'Foi uma partida bastante carregada em cartões.' : total <= 3 ? 'Foi um jogo relativamente disciplinado.' : 'Foi uma partida com nível moderado de cartões.';
  return `Cartões:\n- ${event.home_team_name}: ${hy} amarelos e ${hr} vermelhos\n- ${event.away_team_name}: ${ay} amarelos e ${ar} vermelhos\n\nTotal: ${hy + ay} amarelos e ${hr + ar} vermelhos. ${discipline}`;
}

function naturalSingleMetric(event: any, metric: MetricIntent, homeValue: number, awayValue: number, key: string) {
  const home = event.home_team_name;
  const away = event.away_team_name;
  const total = homeValue + awayValue;
  if (key.includes('possession')) {
    const dominant = homeValue > awayValue ? home : awayValue > homeValue ? away : 'nenhuma equipe';
    const extra = dominant === 'nenhuma equipe' ? 'A posse ficou equilibrada.' : `${dominant} teve mais controle da bola.`;
    return `Posse de bola:\n- ${home}: ${formatValue(homeValue, key)}\n- ${away}: ${formatValue(awayValue, key)}\n\n${extra}`;
  }
  if (key.includes('expected_goals') || key === 'xg') {
    const better = homeValue > awayValue ? home : awayValue > homeValue ? away : 'as equipes ficaram equilibradas';
    const extra = typeof better === 'string' && better.includes('equilibradas') ? 'O xG indica equilíbrio nas chances criadas.' : `${better} criou chances de maior qualidade.`;
    return `Gols esperados (xG):\n- ${home}: ${formatValue(homeValue, key)}\n- ${away}: ${formatValue(awayValue, key)}\n\n${extra}`;
  }
  const leader = homeValue > awayValue ? home : awayValue > homeValue ? away : null;
  const extra = leader ? `${leader} liderou em ${metric.label}.` : `As equipes ficaram empatadas em ${metric.label}.`;
  return `${metric.label[0].toUpperCase()}${metric.label.slice(1)}:\n- ${home}: ${formatValue(homeValue, key)}\n- ${away}: ${formatValue(awayValue, key)}\nTotal: ${formatValue(total, key)}.\n\n${extra}`;
}

function formatSingleMetric(event: any, rows: any[], metric: MetricIntent) {
  if (metric.combined === 'cards') return formatCards(event, rows);
  const home = metricValue(rows, metric, 'home');
  const away = metricValue(rows, metric, 'away');
  if (!home || !away) return null;
  return naturalSingleMetric(event, metric, home.value, away.value, home.key);
}

function formatMultipleMetrics(event: any, rows: any[], metrics: MetricIntent[]) {
  const blocks = metrics
    .filter((metric) => !metric.combined)
    .map((metric) => {
      const home = metricValue(rows, metric, 'home');
      const away = metricValue(rows, metric, 'away');
      if (!home || !away) return null;
      return `- ${metric.label}: ${event.home_team_name} ${formatValue(home.value, home.key)} x ${formatValue(away.value, home.key)} ${event.away_team_name}`;
    })
    .filter(Boolean);
  return blocks.length ? `Resumo solicitado:\n${blocks.join('\n')}` : null;
}

function formatAllStats(event: any, rows: any[]) {
  const lines = METRICS
    .filter((metric) => !metric.combined)
    .map((metric) => {
      const home = metricValue(rows, metric, 'home');
      const away = metricValue(rows, metric, 'away');
      if (!home || !away) return null;
      return `- ${metric.label}: ${event.home_team_name} ${formatValue(home.value, home.key)} x ${formatValue(away.value, home.key)} ${event.away_team_name}`;
    })
    .filter(Boolean)
    .slice(0, 12);
  return lines.length ? `Resumo das principais estatísticas:\n${lines.join('\n')}` : null;
}

function findMetric(rows: any[], keys: string[], side: 'home' | 'away') {
  const wanted = rows.filter((row) => keys.includes(metricKey(row)));
  return numberValue(sideRows(wanted, side)[0]);
}

function analyzeMatch(event: any, rows: any[]) {
  const home = event.home_team_name;
  const away = event.away_team_name;
  const homeScore = Number(event.home_score ?? 0);
  const awayScore = Number(event.away_score ?? 0);
  const hShots = findMetric(rows, ['shots'], 'home');
  const aShots = findMetric(rows, ['shots'], 'away');
  const hTarget = findMetric(rows, ['shots_on_target', 'shotsontarget'], 'home');
  const aTarget = findMetric(rows, ['shots_on_target', 'shotsontarget'], 'away');
  const hPoss = findMetric(rows, ['possession'], 'home');
  const aPoss = findMetric(rows, ['possession'], 'away');
  const hXg = findMetric(rows, ['expected_goals', 'xg'], 'home');
  const aXg = findMetric(rows, ['expected_goals', 'xg'], 'away');
  const hCorners = findMetric(rows, ['corners'], 'home');
  const aCorners = findMetric(rows, ['corners'], 'away');

  const attackLeader = hShots + hTarget + hXg * 2 + hCorners * 0.4 > aShots + aTarget + aXg * 2 + aCorners * 0.4 ? home : away;
  const possessionLeader = hPoss > aPoss ? home : aPoss > hPoss ? away : 'nenhuma equipe';
  const winner = homeScore > awayScore ? home : awayScore > homeScore ? away : null;
  const resultText = winner ? `${winner} venceu no placar.` : 'O jogo terminou empatado.';
  const possessionText = possessionLeader === 'nenhuma equipe' ? 'A posse de bola ficou equilibrada.' : `${possessionLeader} teve mais posse de bola.`;

  return `Análise do jogo:\n${resultText} Em volume ofensivo, ${attackLeader} apresentou os melhores sinais considerando finalizações, chutes no gol, xG e escanteios. ${possessionText}\n\nNúmeros-chave:\n- Finalizações: ${home} ${hShots} x ${aShots} ${away}\n- Finalizações no gol: ${home} ${hTarget} x ${aTarget} ${away}\n- Posse: ${home} ${hPoss}% x ${aPoss}% ${away}\n- xG: ${home} ${formatValue(hXg, 'xg')} x ${formatValue(aXg, 'xg')} ${away}\n- Escanteios: ${home} ${hCorners} x ${aCorners} ${away}`;
}

function cornerSpecialist(event: any, rows: any[]) {
  const hCorners = findMetric(rows, ['corners'], 'home');
  const aCorners = findMetric(rows, ['corners'], 'away');
  const hCrosses = findMetric(rows, ['crosses'], 'home');
  const aCrosses = findMetric(rows, ['crosses'], 'away');
  const hShots = findMetric(rows, ['shots'], 'home');
  const aShots = findMetric(rows, ['shots'], 'away');
  const total = hCorners + aCorners;
  const line = total >= 10 ? 'perfil de over 9.5 escanteios' : total >= 8 ? 'jogo perto da linha principal de escanteios' : 'perfil mais baixo de escanteios';
  const side = hCorners > aCorners ? event.home_team_name : aCorners > hCorners ? event.away_team_name : 'nenhuma equipe disparou nos cantos';
  return `Leitura de escanteios:\nO jogo teve ${total} escanteios: ${event.home_team_name} ${hCorners} x ${aCorners} ${event.away_team_name}. Pelo volume, foi um ${line}.\n\nIndicadores relacionados:\n- Cruzamentos: ${event.home_team_name} ${hCrosses} x ${aCrosses} ${event.away_team_name}\n- Finalizações: ${event.home_team_name} ${hShots} x ${aShots} ${event.away_team_name}\n\nEquipe mais forte em cantos: ${side}.`;
}

function sourceText(rows: any[]) {
  const source = rows[0]?.source_key;
  if (source === '365scores') return '365Scores';
  if (source === 'api-football') return 'API-Football';
  if (source === 'sofascore') return 'SofaScore';
  if (source === 'fifa') return 'FIFA';
  return source ? String(source) : 'base local';
}

export async function answerFootballFromDatabase(question: string): Promise<string | null> {
  const q = normalize(question);
  if (q.includes('copa do mundo') || q.includes('mundial') || q.includes('world cup')) return null;
  if (!isStatsQuestion(question)) return null;
  try { assertPersistentDatabaseConfigured(); } catch { return null; }

  const event = await findGenericEvent(question);
  if (!event) return null;
  const rows = await getGenericStats(Number(event.id));
  if (rows.length === 0) return `Encontrei ${event.home_team_name} x ${event.away_team_name}${event.competition_name ? ` em ${event.competition_name}` : ''}, mas ainda não há estatísticas gravadas para esse jogo.`;

  const metricList = metricsFromQuestion(question);
  let details: string | null = null;
  if (wantsAnalysis(question)) details = analyzeMatch(event, rows);
  else if (wantsCornerSpecialist(question) && (q.includes('over') || q.includes('under') || q.includes('tendencia') || q.includes('tendência'))) details = cornerSpecialist(event, rows);
  else if (metricList.length > 1) details = formatMultipleMetrics(event, rows, metricList);
  else if (metricList.length === 1) details = formatSingleMetric(event, rows, metricList[0]);
  else details = formatAllStats(event, rows);

  if (!details) return `Encontrei ${event.home_team_name} x ${event.away_team_name}, mas não achei essa estatística específica na base local.`;

  const competition = event.competition_name || competitionFromQuestion(question) || 'competição identificada';
  const score = event.home_score !== null && event.away_score !== null ? `${event.home_score} x ${event.away_score}` : 'placar não informado';
  const intro = `${competition} — ${event.home_team_name} ${score} ${event.away_team_name}.`;

  return `${intro}\n\n${details}\n\nFonte: ${sourceText(rows)}.`;
}
