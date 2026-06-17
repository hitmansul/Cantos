import { findWorldCupTeam, normalizeWorldCupText } from './worldCupTeams';

export type WorldCupCornerMomentLabel = '0-15' | '16-30' | '31-45+' | '46-60' | '61-75' | '76-90+';
export type WorldCupCornerMomentStats = Record<WorldCupCornerMomentLabel, number>;

export type WorldCupCornerStats = {
  team: string;
  competition: 'Copa do Mundo';
  season: number;
  matches: number;
  cornersFor: number;
  cornersAgainst: number;
  totalCornersInMatches: number;
  avgCornersFor: number;
  avgCornersAgainst: number;
  avgTotalCorners: number;
  firstHalfCornersFor: number;
  secondHalfCornersFor: number;
  cornersWinning: number;
  cornersDrawing: number;
  cornersLosing: number;
  cornerMoments: WorldCupCornerMomentStats;
  over85Pct: number;
  over95Pct: number;
  over105Pct: number;
  source: 'fifa-match-report' | '365scores' | 'api-football' | 'manual';
  updatedAt: string;
};

export const CORNER_MOMENT_LABELS: WorldCupCornerMomentLabel[] = ['0-15', '16-30', '31-45+', '46-60', '61-75', '76-90+'];
export const EMPTY_CORNER_MOMENTS: WorldCupCornerMomentStats = { '0-15': 0, '16-30': 0, '31-45+': 0, '46-60': 0, '61-75': 0, '76-90+': 0 };

/** Base exclusiva da Copa do Mundo. O cron/FIFA deve popular conforme jogos terminarem. */
export const worldCupCornerStats: WorldCupCornerStats[] = [];

export function minuteToCornerMoment(minute: number): WorldCupCornerMomentLabel {
  if (minute <= 15) return '0-15';
  if (minute <= 30) return '16-30';
  if (minute <= 45) return '31-45+';
  if (minute <= 60) return '46-60';
  if (minute <= 75) return '61-75';
  return '76-90+';
}

export function findWorldCupCornerStats(teamText: string): WorldCupCornerStats | null {
  const team = findWorldCupTeam(teamText);
  const key = normalizeWorldCupText(team?.team ?? teamText);
  return worldCupCornerStats.find((stats) => {
    const statsKey = normalizeWorldCupText(stats.team);
    return statsKey === key || statsKey.includes(key) || key.includes(statsKey);
  }) ?? null;
}

export function rankWorldCupCorners(): WorldCupCornerStats[] {
  return [...worldCupCornerStats].sort((a, b) => b.avgCornersFor - a.avgCornersFor);
}

export function peakCornerMoment(stats: WorldCupCornerStats) {
  const total = Math.max(1, stats.cornersFor);
  const [moment, corners] = Object.entries(stats.cornerMoments).sort((a, b) => b[1] - a[1])[0] as [WorldCupCornerMomentLabel, number];
  return { moment, corners, pct: Math.round((corners / total) * 100) };
}

export function worldCupCornersSummary(teamText: string): string | null {
  const stats = findWorldCupCornerStats(teamText);
  if (!stats) return null;
  const peak = peakCornerMoment(stats);
  return [
    `🚩 Escanteios na Copa do Mundo — ${stats.team}`,
    '',
    `Jogos analisados: ${stats.matches}`,
    `Média a favor: ${stats.avgCornersFor} escanteios/jogo`,
    `Média contra: ${stats.avgCornersAgainst} escanteios/jogo`,
    `Total médio nos jogos: ${stats.avgTotalCorners}`,
    '',
    `Período com mais escanteios: ${peak.moment} (${peak.corners} escanteios, ${peak.pct}%).`,
    `1º tempo: ${stats.firstHalfCornersFor} | 2º tempo: ${stats.secondHalfCornersFor}.`,
    `Over 8.5: ${stats.over85Pct}% | Over 9.5: ${stats.over95Pct}% | Over 10.5: ${stats.over105Pct}%.`,
  ].join('\n');
}

export function emptyWorldCupCornersReply(): string {
  return [
    'Ainda não tenho estatísticas oficiais de escanteios da Copa do Mundo suficientes para esse recorte.',
    '',
    'Regra aplicada:',
    '- Copa do Mundo usa somente jogos da Copa do Mundo.',
    '- Não misturo Eliminatórias, amistosos, Copa América, Euro ou ligas nacionais.',
    '- Assim que os relatórios oficiais FIFA/rotas ao vivo forem sincronizados, essa resposta passa a trazer médias e probabilidades de escanteios da Copa.',
  ].join('\n');
}
