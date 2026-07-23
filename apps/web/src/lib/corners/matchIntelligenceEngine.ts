import type { CornerProjection, CornerProjectionInput, CornerSample } from './statisticalEngine';

export type TeamCornerDna = {
  team: string;
  attackPressure: number;
  cornerProduction: number;
  cornersConceded: number;
  pace: number;
  intensity: number;
  stability: number;
  trend: 'rising' | 'stable' | 'falling';
  trendPercent: number;
  sampleSize: number;
};

export type MatchCompatibility = {
  score: number;
  label: 'very-high' | 'high' | 'moderate' | 'low';
  tendency: 'high-corners' | 'balanced' | 'low-corners';
  reasons: string[];
};

export type MatchIntelligence = {
  version: string;
  homeDna: TeamCornerDna;
  awayDna: TeamCornerDna;
  compatibility: MatchCompatibility;
  stabilityScore: number;
  pressureTrend: {
    home: TeamCornerDna['trend'];
    away: TeamCornerDna['trend'];
    combinedPercent: number;
  };
  whyBet: string[];
  whyNotBet: string[];
  executiveSummary: string;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function valid(samples: CornerSample[]) {
  return samples.filter((sample) => Number.isFinite(sample.cornersFor) && Number.isFinite(sample.cornersAgainst));
}

function trendFrom(values: number[]) {
  if (values.length < 4) return { trend: 'stable' as const, percent: 0 };
  const split = Math.max(2, Math.floor(values.length / 2));
  const recent = mean(values.slice(0, split));
  const previous = mean(values.slice(split));
  if (previous <= 0) return { trend: 'stable' as const, percent: 0 };
  const percent = ((recent - previous) / previous) * 100;
  if (percent >= 8) return { trend: 'rising' as const, percent: round(percent) };
  if (percent <= -8) return { trend: 'falling' as const, percent: round(percent) };
  return { trend: 'stable' as const, percent: round(percent) };
}

function buildTeamDna(team: string, samples: CornerSample[]): TeamCornerDna {
  const data = valid(samples);
  const forValues = data.map((sample) => sample.cornersFor);
  const againstValues = data.map((sample) => sample.cornersAgainst);
  const totals = data.map((sample) => sample.cornersFor + sample.cornersAgainst);
  const produced = mean(forValues);
  const conceded = mean(againstValues);
  const volatility = standardDeviation(totals);
  const trend = trendFrom(forValues);

  return {
    team,
    attackPressure: round(clamp((produced / 7) * 100)),
    cornerProduction: round(clamp((produced / 8) * 100)),
    cornersConceded: round(clamp((conceded / 8) * 100)),
    pace: round(clamp((mean(totals) / 13) * 100)),
    intensity: round(clamp(((produced * 0.65 + mean(totals) * 0.35) / 9) * 100)),
    stability: round(clamp(100 - volatility * 13)),
    trend: trend.trend,
    trendPercent: trend.percent,
    sampleSize: data.length,
  };
}

function compatibility(home: TeamCornerDna, away: TeamCornerDna, projection: CornerProjection): MatchCompatibility {
  const attackingFit = (home.cornerProduction + away.cornerProduction) / 2;
  const concessionFit = (home.cornersConceded + away.cornersConceded) / 2;
  const tempoFit = (home.pace + away.pace + home.intensity + away.intensity) / 4;
  const projectedFit = clamp((projection.expectedTotalCorners / 13) * 100);
  const score = round(clamp(attackingFit * 0.3 + concessionFit * 0.2 + tempoFit * 0.25 + projectedFit * 0.25));
  const reasons: string[] = [];

  if (attackingFit >= 70) reasons.push('As duas equipes apresentam produção ofensiva elevada de escanteios.');
  if (concessionFit >= 65) reasons.push('Os perfis defensivos permitem volume relevante de escanteios ao adversário.');
  if (tempoFit >= 70) reasons.push('Ritmo e intensidade combinados favorecem pressão territorial.');
  if (home.trend === 'rising' || away.trend === 'rising') reasons.push('Ao menos uma equipe apresenta tendência recente de crescimento.');
  if (!reasons.length) reasons.push('A combinação dos estilos não apresenta um gatilho dominante neste momento.');

  return {
    score,
    label: score >= 85 ? 'very-high' : score >= 70 ? 'high' : score >= 50 ? 'moderate' : 'low',
    tendency: projection.expectedTotalCorners >= 11 ? 'high-corners' : projection.expectedTotalCorners <= 8.5 ? 'low-corners' : 'balanced',
    reasons,
  };
}

export function buildMatchIntelligence(input: CornerProjectionInput, projection: CornerProjection): MatchIntelligence {
  const homeDna = buildTeamDna(input.homeTeam, input.homeSamples);
  const awayDna = buildTeamDna(input.awayTeam, input.awaySamples);
  const matchCompatibility = compatibility(homeDna, awayDna, projection);
  const stabilityScore = round((homeDna.stability + awayDna.stability + projection.confidence * 100) / 3);
  const combinedTrend = round((homeDna.trendPercent + awayDna.trendPercent) / 2);

  const whyBet: string[] = [];
  const whyNotBet: string[] = [];
  const bestOffer = [...projection.evaluatedOffers].sort((a, b) => b.expectedValue - a.expectedValue)[0];

  if (projection.expectedTotalCorners >= 10.5) whyBet.push(`Projeção central de ${round(projection.expectedTotalCorners)} escanteios.`);
  if (matchCompatibility.score >= 70) whyBet.push(`Compatibilidade de estilos em ${matchCompatibility.score}%.`);
  if (stabilityScore >= 65) whyBet.push(`Estabilidade combinada de ${stabilityScore}%.`);
  if (bestOffer?.expectedValue > 0.03) whyBet.push(`Melhor mercado apresenta EV de ${round(bestOffer.expectedValue * 100)}%.`);

  if (projection.confidence < 0.52) whyNotBet.push('Confiança estatística abaixo do nível recomendado.');
  if (stabilityScore < 50) whyNotBet.push('As equipes apresentam comportamento recente instável.');
  if (projection.sampleSize < 8) whyNotBet.push('A amostra disponível ainda é pequena.');
  if (projection.volatility > 4) whyNotBet.push('A volatilidade recente aumenta o risco da projeção.');
  if (!bestOffer) whyNotBet.push('Não há odd de mercado validada para confirmar valor.');
  else if (bestOffer.expectedValue <= 0) whyNotBet.push('A melhor odd disponível não apresenta valor esperado positivo.');
  if (matchCompatibility.score < 50) whyNotBet.push('Os estilos das equipes têm baixa compatibilidade para gerar muitos escanteios.');

  const executiveSummary = projection.decision === 'bet'
    ? `O Match Intelligence Engine encontrou cenário favorável, com compatibilidade de ${matchCompatibility.score}% e estabilidade de ${stabilityScore}%.`
    : projection.decision === 'monitor'
      ? `O jogo merece acompanhamento, mas ainda existem sinais mistos entre projeção, estabilidade e preço de mercado.`
      : `A recomendação atual é não entrar: os riscos identificados superam as evidências favoráveis.`;

  return {
    version: '1.0.0',
    homeDna,
    awayDna,
    compatibility: matchCompatibility,
    stabilityScore,
    pressureTrend: { home: homeDna.trend, away: awayDna.trend, combinedPercent: combinedTrend },
    whyBet,
    whyNotBet,
    executiveSummary,
  };
}
