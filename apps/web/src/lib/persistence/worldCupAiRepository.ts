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

const WORLD_CUP_TEAM_ALIASES = [
  'mexico','coreia','coreia do sul','tchequia','africa do sul','canada','suica','bosnia','bosnia e herzegovina','catar','qatar',
  'brasil','marrocos','escocia','haiti','eua','estados unidos','australia','paraguai','turquia','alemanha','costa do marfim',
  'equador','curacao','holanda','japao','suecia','tunisia','belgica','egito','ira','iran','nova zelandia','espanha',
  'uruguai','arabia saudita','cabo verde','franca','noruega','senegal','iraque','argentina','austria','jordania','argelia',
  'colombia','congo','rd congo','dr congo','portugal','uzbequistao','inglaterra','gana','panama','croacia'
].map(normalize);

function isWorldCupIntent(question: string) {
  const q = normalize(question);
  if (q.includes('copa') || q.includes('mundial') || q.includes('fifa') || q.includes('world cup')) return true;
  return WORLD_CUP_TEAM_ALIASES.some((alias) => alias.length >= 3 && q.includes(alias));
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
  const compactQuestion = q.replace(/\s+/g, '');
  const compactHome = home.replace(/\s+/g, '');
  const compactAway = away.replace(/\s+/g, '');
  let score = 0;
  if (q.includes(home)) score += 6;
  if (q.includes(away)) score += 6;
  if (compactQuestion.includes(compactHome)) score += 4;
  if (compactQuestion.includes(compactAway)) score += 4;
  for (const part of home.split(' ').filter((p) => p.length >= 4)) if (q.includes(part)) score += 2;
  for (const part of away.split(' ').filter((p) => p.length >= 4)) if (q.includes(part)) score += 2;
  return score;
}

async function findAskedMatch(question: string) {
  const matches = await sql`
    SELECT id, home_team_name, away_team_name, home_score, away_score, status, kickoff_at
    FROM world_cup_matches
    WHERE competition_key = ${WORLD_CUP_2026_KEY}
    ORDER BY kickoff_at DESC NULLS LAST, id DESC
    LIMIT 150
  `;
  return matches
    .map((match) => ({ match, score: scoreMatch(question, match.home_team_name, match.away_team_name) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.match ?? null;
}

export async function answerWorldCupFromDatabase(question: string): Promise<string | null> {
  const q = normalize(question);
  if (!isWorldCupIntent(question)) return null;

  try {
    assertPersistentDatabaseConfigured();
  } catch {
    return null;
  }

  if (q.includes('previsao') || q.includes('previsao de escanteios') || q.includes('proximo jogo')) {
    const rows = await sql`
      SELECT id, home_team_name, away_team_name, kickoff_at, group_name, round_name, status
      FROM world_cup_matches
      WHERE competition_key = ${WORLD_CUP_2026_KEY}
        AND kickoff_at >= NOW() - INTERVAL '2 hours'
        AND LOWER(COALESCE(status, '')) NOT IN ('finished', 'fim', 'final', 'ft')
      ORDER BY kickoff_at ASC NULLS LAST, id ASC
      LIMIT 20
    `;

    if (rows.length > 0 && (q.includes('proximo') || q.includes('previsao'))) {
      const teamFiltered = rows.filter((row) => scoreMatch(question, row.home_team_name, row.away_team_name) > 0);
      const selectedRows = teamFiltered.length ? teamFiltered : rows.slice(0, 5);
      const lines = selectedRows.map((row) => `- ${row.home_team_name} x ${row.away_team_name} (${row.kickoff_at ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(row.kickoff_at)) : 'data não informada'})`).join('\n');
      return `Próximos jogos da Copa encontrados no banco:\n\n${lines}\n\nPara ver escanteios, cartões e xG previstos, abra Copa do Mundo > Próximos e clique no jogo.`;
    }
  }

  if (q.includes('quais jogos') || q.includes('jogos no banco') || q.includes('partidas no banco') || q.includes('jogos da copa')) {
    const rows = await sql`
      SELECT home_team_name, away_team_name, home_score, away_score, status, kickoff_at, group_name, round_name
      FROM world_cup_matches
      WHERE competition_key = ${WORLD_CUP_2026_KEY}
      ORDER BY kickoff_at NULLS LAST, id
      LIMIT 30
    `;
    if (rows.length === 0) return 'Ainda não existem jogos da Copa gravados no banco persistente.';
    const games = rows.map((row) => {
      const score = row.home_score !== null && row.away_score !== null ? ` ${row.home_score} x ${row.away_score}` : '';
      const group = row.group_name || row.round_name ? ` — ${row.group_name ?? row.round_name}` : '';
      const status = row.status ? ` (${row.status})` : '';
      return `- ${row.home_team_name}${score} ${row.away_team_name}${group}${status}`;
    }).join('\n');
    return `Jogos da Copa encontrados no banco:\n\n${games}`;
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
    return [`Resultado: ${selected.home_team_name} ${selected.home_score ?? '-'} x ${selected.away_score ?? '-'} ${selected.away_team_name}`, '', `Vencedor: ${winner}`, `Status: ${selected.status ?? 'não informado'}`].join('\n');
  }

  if (q.includes('quantos escanteios') || q.includes('escanteios teve') || q.includes('total de escanteios') || q.includes('quantos corners')) {
    const selected = await findAskedMatch(question);
    if (!selected) return null;
    const stats = await sql`
      SELECT ms.metric_key, ms.metric_name, ms.value_numeric, ms.value_text, t.name AS team_name
      FROM world_cup_match_statistics ms
      JOIN world_cup_teams t ON t.id = ms.team_id
      WHERE ms.match_id = ${Number(selected.id)}
      ORDER BY CASE ms.source_key WHEN 'fifa' THEN 1 WHEN '365scores' THEN 2 ELSE 9 END, ms.metric_key, t.name
    `;
    const cornerRows = stats.filter((row) => isCornerMetric(row.metric_key, row.metric_name));
    if (cornerRows.length === 0) return `Encontrei o jogo ${selected.home_team_name} x ${selected.away_team_name} no banco, mas ainda não há estatística de escanteios gravada para essa partida.`;
    const homeCorner = cornerRows.find((row) => normalize(row.team_name) === normalize(selected.home_team_name));
    const awayCorner = cornerRows.find((row) => normalize(row.team_name) === normalize(selected.away_team_name));
    const homeValue = Number(homeCorner?.value_numeric ?? homeCorner?.value_text ?? 0);
    const awayValue = Number(awayCorner?.value_numeric ?? awayCorner?.value_text ?? 0);
    const total = homeValue + awayValue;
    return `${selected.home_team_name} x ${selected.away_team_name} teve ${total} escanteios no total.\n\n- ${selected.home_team_name}: ${homeValue}\n- ${selected.away_team_name}: ${awayValue}`;
  }

  if (q.includes('cartao') || q.includes('cartoes') || q.includes('cartão') || q.includes('cartões')) {
    const selected = await findAskedMatch(question);
    if (!selected) return null;
    const stats = await sql`
      SELECT ms.metric_key, ms.metric_name, ms.value_numeric, ms.value_text, t.name AS team_name
      FROM world_cup_match_statistics ms
      JOIN world_cup_teams t ON t.id = ms.team_id
      WHERE ms.match_id = ${Number(selected.id)}
      ORDER BY CASE ms.source_key WHEN 'fifa' THEN 1 WHEN '365scores' THEN 2 ELSE 9 END, ms.metric_key, t.name
    `;
    const cardRows = stats.filter((row) => isCardMetric(row.metric_key, row.metric_name));
    if (cardRows.length === 0) return `Encontrei o jogo ${selected.home_team_name} x ${selected.away_team_name} no banco, mas ainda não há estatísticas de cartões gravadas para essa partida.`;
    return `Cartões em ${selected.home_team_name} x ${selected.away_team_name}:\n\n${cardRows.map((row) => `- ${row.team_name} — ${row.metric_name}: ${row.value_numeric ?? row.value_text ?? 'não informado'}`).join('\n')}`;
  }

  return null;
}
