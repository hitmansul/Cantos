export type LiveSideStats = {
  dangerousAttacks: number;
  attacks?: number;
  shots: number;
  shotsOnTarget?: number;
  crosses?: number;
  possession?: number;
  corners: number;
  goals: number;
  redCards?: number;
};

export type LiveMarketOffer = {
  bookmaker: string;
  line: number;
  side: 'over' | 'under';
  odd: number;
};

export type LiveSnapshotInput = {
  fixtureKey?: string;
  homeTeam: string;
  awayTeam: string;
  minute: number;
  addedTime?: number;
  home: LiveSideStats;
  away: LiveSideStats;
  pregameExpectedTotal: number;
  pregameConfidence: number;
  previousSnapshot?: LiveIntelligenceSnapshot;
  marketOffers?: LiveMarketOffer[];
  bankroll?: number;
  riskProfile?: 'conservative' | 'balanced' | 'aggressive';
};

export type LiveRecommendation = 'bet' | 'monitor' | 'no-bet' | 'market-closed';

export type LiveIntelligenceSnapshot = {
  version: string;
  fixtureKey?: string;
  homeTeam: string;
  awayTeam: string;
  minute: number;
  score: { home: number; away: number };
  corners: { home: number; away: number; total: number };
  pressure: { home: number; away: number; combined: number; leader: 'home' | 'away' | 'balanced' };
  momentum: { score: number; label: 'very-high' | 'high' | 'moderate' | 'low'; leader: 'home' | 'away' | 'balanced' };
  pace: number;
  projectedFinalCorners: number;
  projectedRange: { min: number; max: number };
  confidence: number;
  market?: {
    bookmaker: string;
    line: number;
    side: 'over' | 'under';
    odd: number;
    probability: number;
    fairOdd: number | null;
    expectedValue: number;
    edge: number;
    recommendedStakePercent: number;
    recommendedStake: number | null;
  };
  recommendation: LiveRecommendation;
  reasons: string[];
  changeReasons: string[];
  alert?: string;
  generatedAt: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

function sidePressure(stats: LiveSideStats) {
  const possession = stats.possession ?? 50;
  const attacks = stats.attacks ?? stats.dangerousAttacks * 2;
  const shotsOnTarget = stats.shotsOnTarget ?? Math.min(stats.shots, Math.round(stats.shots * 0.4));
  const crosses = stats.crosses ?? stats.corners * 3;
  const redPenalty = (stats.redCards ?? 0) * 12;

  return clamp(
    stats.dangerousAttacks * 2.2
      + attacks * 0.35
      + stats.shots * 3
      + shotsOnTarget * 4
      + crosses * 0.8
      + stats.corners * 5
      + (possession - 50) * 0.45
      - redPenalty,
    0,
    100,
  );
}

function poissonProbability(k: number, lambda: number) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let factorial = 1;
  for (let index = 2; index <= k; index += 1) factorial *= index;
  return Math.exp(-lambda) * lambda ** k / factorial;
}

function lineProbability(lambda: number, currentCorners: number, line: number, side: 'over' | 'under') {
  const remainingLambda = Math.max(0.05, lambda - currentCorners);
  const maxAdditional = Math.max(25, Math.ceil(remainingLambda + 8 * Math.sqrt(Math.max(remainingLambda, 1))));
  let probability = 0;
  let normalization = 0;

  for (let additional = 0; additional <= maxAdditional; additional += 1) {
    const raw = poissonProbability(additional, remainingLambda);
    normalization += raw;
    const finalTotal = currentCorners + additional;
    if (side === 'over' ? finalTotal > line : finalTotal < line) probability += raw;
  }

  return normalization > 0 ? probability / normalization : 0;
}

function riskMultiplier(profile: LiveSnapshotInput['riskProfile']) {
  if (profile === 'aggressive') return 1;
  if (profile === 'balanced') return 0.5;
  return 0.25;
}

function evaluateBestMarket(input: LiveSnapshotInput, projectedFinalCorners: number, confidence: number) {
  const currentCorners = input.home.corners + input.away.corners;
  const offers = (input.marketOffers ?? []).filter((offer) => offer.odd > 1 && Number.isFinite(offer.line));
  const evaluated = offers.map((offer) => {
    const probability = lineProbability(projectedFinalCorners, currentCorners, offer.line, offer.side);
    const implied = 1 / offer.odd;
    const expectedValue = probability * offer.odd - 1;
    const edge = probability - implied;
    const fairOdd = probability > 0 ? 1 / probability : null;
    const rawKelly = offer.odd > 1 ? Math.max(0, ((offer.odd - 1) * probability - (1 - probability)) / (offer.odd - 1)) : 0;
    const recommendedStakePercent = clamp(rawKelly * riskMultiplier(input.riskProfile ?? 'conservative') * confidence * 100, 0, 4);
    const bankroll = input.bankroll && input.bankroll > 0 ? input.bankroll : null;

    return {
      ...offer,
      probability,
      fairOdd,
      expectedValue,
      edge,
      recommendedStakePercent,
      recommendedStake: bankroll ? bankroll * recommendedStakePercent / 100 : null,
    };
  }).sort((a, b) => b.expectedValue - a.expectedValue || b.edge - a.edge);

  const best = evaluated[0];
  if (!best) return undefined;
  return {
    bookmaker: best.bookmaker,
    line: best.line,
    side: best.side,
    odd: round(best.odd, 2),
    probability: round(best.probability, 4),
    fairOdd: best.fairOdd ? round(best.fairOdd, 2) : null,
    expectedValue: round(best.expectedValue, 4),
    edge: round(best.edge, 4),
    recommendedStakePercent: round(best.recommendedStakePercent, 2),
    recommendedStake: best.recommendedStake ? round(best.recommendedStake, 2) : null,
  };
}

export function buildLiveIntelligence(input: LiveSnapshotInput): LiveIntelligenceSnapshot {
  const minute = clamp(input.minute + (input.addedTime ?? 0), 0, 130);
  const regulationMinute = clamp(minute, 1, 90);
  const elapsedRatio = clamp(regulationMinute / 90, 0.05, 1);
  const currentCorners = input.home.corners + input.away.corners;
  const homePressure = sidePressure(input.home);
  const awayPressure = sidePressure(input.away);
  const combinedPressure = clamp((homePressure + awayPressure) / 2, 0, 100);
  const pressureLeader = Math.abs(homePressure - awayPressure) < 8 ? 'balanced' : homePressure > awayPressure ? 'home' : 'away';

  const liveCornerPace = currentCorners / elapsedRatio;
  const pressureBoost = (combinedPressure - 50) / 100 * Math.max(0, 90 - regulationMinute) / 18;
  const scoreDifference = Math.abs(input.home.goals - input.away.goals);
  const trailingPressureBoost = scoreDifference > 0 ? Math.max(0, 90 - regulationMinute) / 90 * 0.6 : 0;
  const redCards = (input.home.redCards ?? 0) + (input.away.redCards ?? 0);
  const redCardAdjustment = redCards ? 0.35 : 0;
  const blendedBase = input.pregameExpectedTotal * (1 - elapsedRatio * 0.58) + liveCornerPace * (elapsedRatio * 0.58);
  const projectedFinalCorners = clamp(Math.max(currentCorners, blendedBase + pressureBoost + trailingPressureBoost + redCardAdjustment), currentCorners, 25);

  const volatilityPenalty = Math.abs(liveCornerPace - input.pregameExpectedTotal) * 0.018;
  const confidence = clamp(input.pregameConfidence * 0.62 + elapsedRatio * 0.3 + combinedPressure / 100 * 0.13 - volatilityPenalty, 0.25, 0.94);
  const remaining = Math.max(0, projectedFinalCorners - currentCorners);
  const spread = clamp(Math.sqrt(Math.max(remaining, 1)) * 1.15, 1.2, 4.5);
  const momentumScore = clamp(combinedPressure * 0.68 + Math.min(100, liveCornerPace / 14 * 100) * 0.32, 0, 100);
  const momentumLabel = momentumScore >= 85 ? 'very-high' : momentumScore >= 70 ? 'high' : momentumScore >= 50 ? 'moderate' : 'low';
  const market = evaluateBestMarket(input, projectedFinalCorners, confidence);

  const reasons: string[] = [];
  if (combinedPressure >= 75) reasons.push('A pressão ofensiva ao vivo está em nível elevado.');
  if (liveCornerPace >= input.pregameExpectedTotal + 1) reasons.push('O ritmo atual de escanteios está acima da projeção pré-jogo.');
  if (scoreDifference > 0 && regulationMinute >= 30) reasons.push('O placar cria incentivo para a equipe em desvantagem aumentar a pressão.');
  if (currentCorners === 0 && regulationMinute >= 30) reasons.push('A ausência de escanteios até este momento reduz a força de mercados over.');
  if (combinedPressure < 40) reasons.push('A partida apresenta baixa pressão ofensiva neste recorte.');
  if (market?.expectedValue && market.expectedValue > 0.05) reasons.push(`A melhor linha possui EV positivo de ${round(market.expectedValue * 100, 1)}%.`);
  if (market && market.expectedValue <= 0) reasons.push('A melhor odd disponível ainda não oferece valor esperado positivo.');

  let recommendation: LiveRecommendation = 'monitor';
  if (regulationMinute >= 88) recommendation = 'market-closed';
  else if (market && market.expectedValue >= 0.05 && market.edge >= 0.025 && confidence >= 0.55) recommendation = 'bet';
  else if (!market || market.expectedValue <= 0 || confidence < 0.45 || combinedPressure < 35) recommendation = 'no-bet';

  const changeReasons: string[] = [];
  const previous = input.previousSnapshot;
  if (previous) {
    if (previous.recommendation !== recommendation) changeReasons.push(`A recomendação mudou de ${previous.recommendation} para ${recommendation}.`);
    if (combinedPressure - previous.pressure.combined >= 12) changeReasons.push('A pressão ofensiva aumentou significativamente desde a última atualização.');
    if (previous.pressure.combined - combinedPressure >= 12) changeReasons.push('A pressão ofensiva perdeu intensidade desde a última atualização.');
    if (market && previous.market && market.expectedValue - previous.market.expectedValue >= 0.04) changeReasons.push('O valor esperado melhorou com a nova odd e o novo cenário de jogo.');
    if (market && previous.market && previous.market.expectedValue - market.expectedValue >= 0.04) changeReasons.push('A movimentação da odd reduziu o valor esperado da entrada.');
    if (input.home.goals + input.away.goals > previous.score.home + previous.score.away) changeReasons.push('Um gol alterou o comportamento esperado das equipes.');
    if (currentCorners > previous.corners.total) changeReasons.push('Novo escanteio incorporado à projeção dinâmica.');
  }

  const alert = recommendation === 'bet' && market
    ? `Agora existe valor: ${market.side === 'over' ? 'Over' : 'Under'} ${market.line} a ${market.odd}.`
    : previous?.recommendation === 'bet' && recommendation !== 'bet'
      ? 'O mercado perdeu valor. Não entrar neste momento.'
      : undefined;

  return {
    version: '1.0.0',
    fixtureKey: input.fixtureKey,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    minute,
    score: { home: input.home.goals, away: input.away.goals },
    corners: { home: input.home.corners, away: input.away.corners, total: currentCorners },
    pressure: {
      home: round(homePressure, 1),
      away: round(awayPressure, 1),
      combined: round(combinedPressure, 1),
      leader: pressureLeader,
    },
    momentum: { score: round(momentumScore, 1), label: momentumLabel, leader: pressureLeader },
    pace: round(liveCornerPace, 2),
    projectedFinalCorners: round(projectedFinalCorners, 2),
    projectedRange: { min: round(Math.max(currentCorners, projectedFinalCorners - spread), 1), max: round(projectedFinalCorners + spread, 1) },
    confidence: round(confidence, 4),
    market,
    recommendation,
    reasons,
    changeReasons,
    alert,
    generatedAt: new Date().toISOString(),
  };
}
