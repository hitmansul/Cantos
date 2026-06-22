import sql from '@/app/api/utils/sql';
import { assertPersistentDatabaseConfigured } from './database';
import { WORLD_CUP_2026_KEY } from './worldCupRepository';

const TEAM_ALIASES: Record<string, string> = {
  canada: 'canada',
  'canada': 'canada',
  catar: 'qatar',
  qatar: 'qatar',
  mexico: 'mexico',
  'coreia do sul': 'korea republic',
  coreia: 'korea republic',
  portugal: 'portugal',
  congo: 'rd congo',
  'rd congo': 'rd congo',
  'republica democratica do congo': 'rd congo',
  uruguai: 'uruguay',
  uruguay: 'uruguay',
  'cabo verde': 'cape verde islands',
  'cape verde': 'cape verde islands',
  'cape verde islands': 'cape verde islands',
  eua: 'usa',
  usa: 'usa',
  'estados unidos': 'usa',
};

function normalize(value: unknown): string {
  const base = String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return TEAM_ALIASES[base] ?? base;
}

function isCornerMetric(metricKey: string, metricName: string): boolean {
  const text = normalize(`${metricKey} ${metricName}`);
  return text.includes('corner') || text.includes('escanteio');
}

function isCardMetric(metricKey: string, metricName: string): boolean {
  const text = normalize(`${metricKey} ${metricName}`);
  return text.includes('card') || text.includes('cartao') || text.includes('yellow') || text.includes('red');
}

function scoreMatch(question: string, homeTeam: string, awayTeam: string): number {
  const q = normalize(question);
  const home = normalize(homeTeam);
  const away = normalize(awayTeam);

  let score = 0;

  if (q.includes(home)) score += 5;
  if (q.includes(away)) score += 5;

  const compactQuestion = q.replace(/\s+/g, '');
  const compactHome = home.replace(/\s+/g, '');
  const compactAway = away.replace(/\s+/g, '');

  if (compactQuestion.includes(compactHome)) score += 3;
  if (compactQuestion.includes(compactAway)) score += 3;

  return score;
}

export async function answerWorldCupFromDatabase(question: string): Promise<string | null> {
  const q = normalize(question);

  const isWorldCup =
    q.includes('copa') ||
    q.includes('mundial') ||
    q.includes('fifa') ||
    q.includes('portugal') ||
    q.includes('congo') ||
    q.includes('canada') ||
    q.includes('qatar') ||
    q.includes('catar') ||
    q.includes('mexico') ||
    q.includes('uruguay') ||
    q.includes('uruguai') ||
    q.includes('cabo verde');

  if (!isWorldCup) return null;

  try {
    assertPersistentDatabaseConfigured();
  } catch {
    return null;
  }

  if (
    q.includes('quais jogos') ||
    q.includes('jogos no banco') ||
    q.includes('partidas no banco') ||
    q.includes('jogos da copa')
  ) {
    const rows = await sql`
      SELECT home_team_name, away_team_name, home_score, away_score, status, group_name, round_name
      FROM world_cup_matches
      WHERE competition_key = ${WORLD_CUP_2026_KEY}
      ORDER BY kickoff_at NULLS LAST, id
      LIMIT 30
    `;

    if (rows.length === 0) return 'Ainda não existem jogos da Copa gravados no banco persistente.';

    return `Jogos da Copa encontrados no banco:\n\n${rows
      .map((row) => {
        const score =
          row.home_score !== null && row.away_score !== null
            ? ` ${row.home_score} x ${row.away_score}`
            : '';
        const round = row.group_name || row.round_name ? ` — ${row.group_name ?? row.round_name}` : '';
        const status = row.status ? ` (${row.status})` : '';
        return `- ${row.home_team_name}${score} ${row.away_team_name}${round}${status}`;
      })
      .join('\n')}`;
  }

  if (q.includes('classificacao') || q.includes('classificação') || q.includes('tabela') || q.includes('grupo')) {
    const rows = await sql`
      SELECT s.group_name, s.position, t.name AS team_name, s.played, s.goal_difference, s.points
      FROM world_cup_standings s
      JOIN world_cup_teams t ON t.id = s.team_id
      WHERE s.competition_key = ${WORLD_CUP_2026_KEY}
      ORDER BY s.group_name NULLS LAST, s.position, s.points DESC, s.goal_difference DESC, t.name
      LIMIT 80
    `;

    if (rows.length === 0) return 'Ainda não existe classificação da Copa gravada no banco persistente.';

    const grouped = rows.reduce<Record<string, typeof rows>>((acc, row) => {
      const group = row.group_name || 'Grupo sem nome';
      acc[group] = acc[group] ?? [];
      acc[group].push(row);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([group, items]) => {
        const lines = items
          .map((row) => `${row.position}. ${row.team_name} — ${row.points} pts, ${row.played}J, SG ${row.goal_difference}`)
          .join('\n');
        return `${group}:\n${lines}`;
      })
      .join('\n\n');
  }

  if (q.includes('escanteio') || q.includes('corner')) {
    return answerMatchMetric(question, 'corner');
  }

  if (q.includes('cartao') || q.includes('cartoes') || q.includes('cartão') || q.includes('cartões')) {
    return answerMatchMetric(question, 'card');
  }

  return null;
}

async function answerMatchMetric(question: string, type: 'corner' | 'card'): Promise<string | null> {
  const matches = await sql`
    SELECT id, home_team_name, away_team_name, home_score, away_score, status, kickoff_at
    FROM world_cup_matches
    WHERE competition_key = ${WORLD_CUP_2026_KEY}
    ORDER BY kickoff_at DESC NULLS LAST, id DESC
    LIMIT 100
  `;

  const selected = matches
    .map((match) => ({ match, score: scoreMatch(question, match.home_team_name, match.away_team_name) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.match;

  if (!selected) return null;

  const stats = await sql`
    SELECT ms.metric_key, ms.metric_name, ms.value_numeric, ms.value_text, t.name AS team_name
    FROM world_cup_match_statistics ms
    JOIN world_cup_teams t ON t.id = ms.team_id
    WHERE ms.match_id = ${Number(selected.id)}
    ORDER BY ms.metric_key, t.name
  `;

  const filtered =
    type === 'corner'
      ? stats.filter((row) => isCornerMetric(row.metric_key, row.metric_name))
      : stats.filter((row) => isCardMetric(row.metric_key, row.metric_name));

  if (filtered.length === 0) {
    const label = type === 'corner' ? 'escanteios' : 'cartões';
    return `Encontrei o jogo ${selected.home_team_name} x ${selected.away_team_name} no banco, mas ainda não há estatística de ${label} gravada para essa partida.`;
  }

  if (type === 'corner') {
    const home = filtered.find((row) => normalize(row.team_name) === normalize(selected.home_team_name));
    const away = filtered.find((row) => normalize(row.team_name) === normalize(selected.away_team_name));

    const homeValue = Number(home?.value_numeric ?? home?.value_text ?? 0);
    const awayValue = Number(away?.value_numeric ?? away?.value_text ?? 0);
    const total = homeValue + awayValue;

    return `${selected.home_team_name} x ${selected.away_team_name} teve ${total} escanteios no total.\n\n- ${selected.home_team_name}: ${homeValue}\n- ${selected.away_team_name}: ${awayValue}`;
  }

  return `Cartões em ${selected.home_team_name} x ${selected.away_team_name}:\n\n${filtered
    .map((row) => `- ${row.team_name} — ${row.metric_name}: ${row.value_numeric ?? row.value_text ?? 'não informado'}`)
    .join('\n')}`;
}
