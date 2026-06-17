import { isWorldCupQuestion, findWorldCupTeam } from '@/data/worldCupTeams';
import {
  emptyWorldCupCardsReply,
  peakCardMoment,
  peakCardSituation,
  scoreStateLabel,
  worldCupCardStats,
  worldCupCardsSummary,
} from '@/data/worldCupCardStats';
import {
  emptyWorldCupCornersReply,
  rankWorldCupCorners,
  worldCupCornerStats,
  worldCupCornersSummary,
} from '@/data/worldCupCornerStats';

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00ba\u00b0]/g, 'o')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function askedWorldCupCardsStats(text: string): boolean {
  const normalized = normalize(text);
  if (!isWorldCupQuestion(text)) return false;
  return ['cartao', 'cartoes', 'amarelo', 'amarelos', 'vermelho', 'vermelhos', 'advertencia', 'advertencias', 'arbitro', 'juiz']
    .some((term) => normalized.includes(term));
}

export function askedWorldCupCornersStats(text: string): boolean {
  const normalized = normalize(text);
  if (!isWorldCupQuestion(text)) return false;
  return ['escanteio', 'escanteios', 'corner', 'corners', 'media', 'probabilidade', 'over 8', 'over 9', 'over 10']
    .some((term) => normalized.includes(term));
}

export function worldCupCardsStatsReply(question: string): string | null {
  if (!askedWorldCupCardsStats(question)) return null;
  const team = findWorldCupTeam(question);
  if (team) return worldCupCardsSummary(team.team) ?? emptyWorldCupCardsReply();
  if (worldCupCardStats.length === 0) return emptyWorldCupCardsReply();

  const normalized = normalize(question);
  if (normalized.includes('ranking') || normalized.includes('mais cart')) {
    const rows = [...worldCupCardStats]
      .sort((a, b) => b.avgCardsPerMatch - a.avgCardsPerMatch)
      .slice(0, 10)
      .map((item, index) => `${index + 1}. ${item.team}: ${item.avgCardsPerMatch} cartões/jogo (${item.matches} jogos)`)
      .join('\n');
    return `Ranking de cartões da Copa do Mundo:\n\n${rows}`;
  }

  const rows = [...worldCupCardStats]
    .sort((a, b) => b.avgCardsPerMatch - a.avgCardsPerMatch)
    .slice(0, 5)
    .map((item, index) => {
      const moment = peakCardMoment(item);
      const situation = peakCardSituation(item);
      return `${index + 1}. ${item.team}: ${item.avgCardsPerMatch}/jogo | pico ${moment.moment} | mais ${scoreStateLabel(situation.state)}`;
    })
    .join('\n');

  return `Resumo de cartões da Copa do Mundo:\n\n${rows}`;
}

export function worldCupCornersStatsReply(question: string): string | null {
  if (!askedWorldCupCornersStats(question)) return null;
  const team = findWorldCupTeam(question);
  if (team) return worldCupCornersSummary(team.team) ?? emptyWorldCupCornersReply();
  if (worldCupCornerStats.length === 0) return emptyWorldCupCornersReply();

  const rows = rankWorldCupCorners()
    .slice(0, 10)
    .map((item, index) => `${index + 1}. ${item.team}: ${item.avgCornersFor} escanteios a favor/jogo (${item.matches} jogos)`)
    .join('\n');

  return `Ranking de escanteios da Copa do Mundo:\n\n${rows}`;
}

export function worldCupStatsReply(question: string): string | null {
  return worldCupCardsStatsReply(question) ?? worldCupCornersStatsReply(question);
}
