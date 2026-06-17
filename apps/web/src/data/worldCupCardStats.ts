import { findWorldCupTeam, normalizeWorldCupText } from './worldCupTeams';

export type WorldCupCardMomentLabel = '0-15' | '16-30' | '31-45+' | '46-60' | '61-75' | '76-90+';
export type WorldCupScoreState = 'winning' | 'drawing' | 'losing';
export type WorldCupCardMomentStats = Record<WorldCupCardMomentLabel, number>;
export type WorldCupCardSituationMomentStats = Record<WorldCupScoreState, WorldCupCardMomentStats>;

export type WorldCupCardStats = {
  team: string;
  competition: 'Copa do Mundo';
  season: number;
  matches: number;
  yellowCards: number;
  redCards: number;
  totalCards: number;
  avgYellowPerMatch: number;
  avgRedPerMatch: number;
  avgCardsPerMatch: number;
  firstHalfCards: number;
  secondHalfCards: number;
  cardsWinning: number;
  cardsDrawing: number;
  cardsLosing: number;
  cardMoments: WorldCupCardMomentStats;
  cardMomentsBySituation: WorldCupCardSituationMomentStats;
  source: 'fifa-match-report' | '365scores' | 'api-football' | 'manual';
  updatedAt: string;
};

export const CARD_MOMENT_LABELS: WorldCupCardMomentLabel[] = ['0-15', '16-30', '31-45+', '46-60', '61-75', '76-90+'];
export const EMPTY_CARD_MOMENTS: WorldCupCardMomentStats = { '0-15': 0, '16-30': 0, '31-45+': 0, '46-60': 0, '61-75': 0, '76-90+': 0 };
export const EMPTY_CARD_MOMENTS_BY_SITUATION: WorldCupCardSituationMomentStats = {
  winning: { ...EMPTY_CARD_MOMENTS },
  drawing: { ...EMPTY_CARD_MOMENTS },
  losing: { ...EMPTY_CARD_MOMENTS },
};

/** Base exclusiva da Copa do Mundo. O cron/FIFA deve popular conforme jogos terminarem. */
export const worldCupCardStats: WorldCupCardStats[] = [];

export function minuteToCardMoment(minute: number): WorldCupCardMomentLabel {
  if (minute <= 15) return '0-15';
  if (minute <= 30) return '16-30';
  if (minute <= 45) return '31-45+';
  if (minute <= 60) return '46-60';
  if (minute <= 75) return '61-75';
  return '76-90+';
}

export function scoreStateLabel(state: WorldCupScoreState): string {
  if (state === 'winning') return 'vencendo';
  if (state === 'losing') return 'perdendo';
  return 'empatando';
}

export function findWorldCupCardStats(teamText: string): WorldCupCardStats | null {
  const team = findWorldCupTeam(teamText);
  const key = normalizeWorldCupText(team?.team ?? teamText);
  return worldCupCardStats.find((stats) => {
    const statsKey = normalizeWorldCupText(stats.team);
    return statsKey === key || statsKey.includes(key) || key.includes(statsKey);
  }) ?? null;
}

export function rankWorldCupCardsByMoment(moment?: WorldCupCardMomentLabel): WorldCupCardStats[] {
  return [...worldCupCardStats].sort((a, b) => {
    const aValue = moment ? a.cardMoments[moment] : a.avgCardsPerMatch;
    const bValue = moment ? b.cardMoments[moment] : b.avgCardsPerMatch;
    return bValue - aValue;
  });
}

export function peakCardMoment(stats: WorldCupCardStats) {
  const total = Math.max(1, stats.totalCards);
  const [moment, cards] = Object.entries(stats.cardMoments).sort((a, b) => b[1] - a[1])[0] as [WorldCupCardMomentLabel, number];
  return { moment, cards, pct: Math.round((cards / total) * 100) };
}

export function peakCardSituation(stats: WorldCupCardStats) {
  const total = Math.max(1, stats.cardsWinning + stats.cardsDrawing + stats.cardsLosing);
  const rows: Array<[WorldCupScoreState, number]> = [
    ['winning', stats.cardsWinning],
    ['drawing', stats.cardsDrawing],
    ['losing', stats.cardsLosing],
  ];
  const [state, cards] = rows.sort((a, b) => b[1] - a[1])[0];
  return { state, cards, pct: Math.round((cards / total) * 100) };
}

export function worldCupCardsSummary(teamText: string): string | null {
  const stats = findWorldCupCardStats(teamText);
  if (!stats) return null;
  const peakMoment = peakCardMoment(stats);
  const peakSituation = peakCardSituation(stats);
  return [
    `📒 Cartões na Copa do Mundo — ${stats.team}`,
    '',
    `Jogos analisados: ${stats.matches}`,
    `Média total: ${stats.avgCardsPerMatch} cartões/jogo`,
    `Amarelos: ${stats.avgYellowPerMatch}/jogo`,
    `Vermelhos: ${stats.avgRedPerMatch}/jogo`,
    '',
    `Mais cartões por período: ${peakMoment.moment} (${peakMoment.cards} cartões, ${peakMoment.pct}%).`,
    `Mais cartões por situação: ${scoreStateLabel(peakSituation.state)} (${peakSituation.cards} cartões, ${peakSituation.pct}%).`,
    `1º tempo: ${stats.firstHalfCards} | 2º tempo: ${stats.secondHalfCards}.`,
  ].join('\n');
}

export function emptyWorldCupCardsReply(): string {
  return [
    'Ainda não tenho estatísticas oficiais de cartões da Copa do Mundo suficientes para esse recorte.',
    '',
    'Regra aplicada:',
    '- Copa do Mundo usa somente jogos da Copa do Mundo.',
    '- Não misturo Eliminatórias, amistosos, Copa América, Euro ou ligas nacionais.',
    '- Assim que os relatórios oficiais FIFA/rotas ao vivo forem sincronizados, essa resposta passa a trazer cartões por período e por situação do placar.',
  ].join('\n');
}
