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
};

const METRICS: MetricIntent[] = [
  { keys: ['corners'], label: 'escanteios', aliases: ['escanteio', 'escanteios', 'corner', 'corners', 'cantos'] },
  { keys: ['shots'], label: 'finalizações', aliases: ['finalizacao', 'finalizacoes', 'chute', 'chutes', 'remate', 'remates', 'shots'] },
  { keys: ['shots_on_target', 'shotsontarget'], label: 'finalizações no gol', aliases: ['finalizacoes no gol', 'chutes no gol', 'no gol', 'shots on target'] },
  { keys: ['shots_off_target', 'shotsofftarget'], label: 'finalizações para fora', aliases: ['finalizacoes para fora', 'chutes para fora', 'para fora', 'shots off target'] },
  { keys: ['possession'], label: 'posse de bola', aliases: ['posse', 'posse de bola', 'possession'] },
  { keys: ['passes'], label: 'passes totais', aliases: ['passes totais', 'passes'] },
  { keys: ['completed_passes', 'completedpasses'], label: 'passes concluídos', aliases: ['passes concluidos', 'passes certos', 'completed passes'] },
  { keys: ['crosses'], label: 'cruzamentos', aliases: ['cruzamentos', 'cruzamento', 'crosses'] },
  { keys: ['completed_crosses', 'completedcrosses'], label: 'cruzamentos concluídos', aliases: ['cruzamentos concluidos', 'cruzamentos certos', 'completed crosses'] },
  { keys: ['yellow_cards', 'yellowcards'], label: 'cartões amarelos', aliases: ['cartoes amarelos', 'cartao amarelo', 'amarelos', 'yellow cards'] },
  { keys: ['red_cards', 'redcards'], label: 'cartões vermelhos', aliases: ['cartoes vermelhos', 'cartao vermelho', 'vermelhos', 'red cards'] },
  { keys: ['yellow_cards', 'yellowcards', 'red_cards', 'redcards'], label: 'cartões', aliases: ['cartoes', 'cartao', 'cartões', 'cartão', 'cards'], combined: 'cards' },
  { keys: ['fouls'], label: 'faltas', aliases: ['faltas', 'falta', 'fouls'] },
  { keys: ['offsides'], label: 'impedimentos', aliases: ['impedimentos', 'impedimento', 'offsides'] },
  { keys: ['goalkeeper_saves', 'saves'], label: 'defesas do goleiro', aliases: ['defesas do goleiro', 'defesas', 'saves'] },
  { keys: ['expected_goals', 'xg'], label: 'gols esperados (xG)', aliases: ['xg', 'gols esperados', 'expected goals'] },
  { keys: ['goals'], label: 'gols', aliases: ['gols', 'gol'] },
  { keys: ['assists'], label: 'assistências', aliases: ['assistencias', 'assistencia', 'assists'] },
];

const COMPETITIONS: Array<{ label: string; aliases: string[] }> = [
  { label: 'Brasileirão', aliases: ['brasileirao', 'brasileiro serie a', 'serie a brasil', 'campeonato brasileiro'] },
  { label: 'Brasileirão Série B', aliases: ['serie b', 'brasileirao serie b', 'brasileiro serie b'] },
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
  { label: 'Copa do Mundo', aliases: ['copa do mundo', 'mundial', 'world cup', 'fifa'] },
];

function competitionFromQuestion(question: string): string | null {
  const q = normalize(question);
  const found = COMPETITIONS.find((competition) => competition.aliases.some((alias) => q.includes(normalize(alias))));
  return found?.label ?? null;
}

function metricFromQuestion(question: string): MetricIntent | null {
  const q = normalize(question);
  return METRICS
    .map((metric) => ({ metric, score: Math.max(...metric.aliases.map((alias) => q.lastIndexOf(normalize(alias)))) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score)[0]?.metric ?? null;
}

function isStatsQuestion(question: string) {
  const q = normalize(question);
  return Boolean(metricFromQuestion(question)) || ['estatistica', 'estatisticas', 'quantas', 'quantos', 'quem teve mais', 'comparar', 'compare', 'analise', 'analisa', 'desempenho'].some((term) => q.includes(term));
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

function sideName(event: any, side: string | null | undefined) {
  if (side === 'home') return event.home_team_name;
  if (side === 'away') return event.away_team_name;
  return 'Equipe';
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
    LIMIT 250
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

function formatCards(event: any, rows: any[]) {
  const yellows = rows.filter((row) => ['yellow_cards', 'yellowcards'].includes(metricKey(row)));
  const reds = rows.filter((row) => ['red_cards', 'redcards'].includes(metricKey(row)));
  const hy = numberValue(sideRows(yellows, 'home')[0]);
  const ay = numberValue(sideRows(yellows, 'away')[0]);
  const hr = numberValue(sideRows(reds, 'home')[0]);
  const ar = numberValue(sideRows(reds, 'away')[0]);
  return `Cartões:\n- ${event.home_team_name}: ${hy} amarelos e ${hr} vermelhos\n- ${event.away_team_name}: ${ay} amarelos e ${ar} vermelhos\n\nTotal: ${hy + ay} amarelos e ${hr + ar} vermelhos.`;
}

function formatSingleMetric(event: any, rows: any[], metric: MetricIntent) {
  if (metric.combined === 'cards') return formatCards(event, rows);
  const metricRows = rows.filter((row) => metricMatches(row, metric));
  const home = sideRows(metricRows, 'home')[0];
  const away = sideRows(metricRows, 'away')[0];
  if (!home || !away) return null;
  const homeValue = numberValue(home);
  const awayValue = numberValue(away);
  const key = metricKey(home);
  const totalLine = key.includes('possession') || key.includes('expected_goals') || key === 'xg' ? '' : `\nTotal: ${formatValue(homeValue + awayValue, key)}.`;
  return `${metric.label[0].toUpperCase()}${metric.label.slice(1)}:\n- ${event.home_team_name}: ${formatValue(homeValue, key)}\n- ${event.away_team_name}: ${formatValue(awayValue, key)}${totalLine}`;
}

function formatAllStats(event: any, rows: any[]) {
  const lines = METRICS
    .filter((metric) => !metric.combined)
    .map((metric) => {
      const metricRows = rows.filter((row) => metricMatches(row, metric));
      const home = sideRows(metricRows, 'home')[0];
      const away = sideRows(metricRows, 'away')[0];
      if (!home || !away) return null;
      const key = metricKey(home);
      return `- ${metric.label}: ${event.home_team_name} ${formatValue(numberValue(home), key)} x ${formatValue(numberValue(away), key)} ${event.away_team_name}`;
    })
    .filter(Boolean)
    .slice(0, 12);
  return lines.length ? `Estatísticas disponíveis:\n${lines.join('\n')}` : null;
}

function sourceText(rows: any[]) {
  const source = rows[0]?.source_key;
  if (source === '365scores') return '365Scores';
  if (source === 'api-football') return 'API-Football';
  if (source === 'sofascore') return 'SofaScore';
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

  const metric = metricFromQuestion(question);
  const details = metric ? formatSingleMetric(event, rows, metric) : formatAllStats(event, rows);
  if (!details) return `Encontrei ${event.home_team_name} x ${event.away_team_name}, mas não achei essa estatística específica na base local.`;

  const competition = event.competition_name || competitionFromQuestion(question) || 'competição identificada';
  const score = event.home_score !== null && event.away_score !== null ? `${event.home_score} x ${event.away_score}` : 'placar não informado';
  const intro = `${competition} — ${event.home_team_name} ${score} ${event.away_team_name}.`;

  return `${intro}\n\n${details}\n\nFonte: ${sourceText(rows)}.`;
}
