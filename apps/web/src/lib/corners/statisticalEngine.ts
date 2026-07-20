export type CornerSample = {
  cornersFor: number;
  cornersAgainst: number;
  venue?: 'home' | 'away' | 'neutral';
  weight?: number;
};

export type CornerMarketOffer = {
  bookmaker: string;
  line: number;
  side: 'over' | 'under';
  odd: number;
};

export type CornerProjectionInput = {
  homeTeam: string;
  awayTeam: string;
  homeSamples: CornerSample[];
  awaySamples: CornerSample[];
  leagueAverageTotal?: number;
  recentFormWeight?: number;
  marketOffers?: CornerMarketOffer[];
};

export type CornerLineProjection = {
  line: number;
  overProbability: number;
  underProbability: number;
  pushProbability: number;
  fairOverOdd: number | null;
  fairUnderOdd: number | null;
  bestOverOffer?: EvaluatedOffer;
  bestUnderOffer?: EvaluatedOffer;
};

export type EvaluatedOffer = CornerMarketOffer & {
  modelProbability: number;
  fairOdd: number | null;
  expectedValue: number;
  edge: number;
  isValueBet: boolean;
};

export type CornerProjection = {
  homeTeam: string;
  awayTeam: string;
  expectedHomeCorners: number;
  expectedAwayCorners: number;
  expectedTotalCorners: number;
  confidence: number;
  sampleSize: number;
  lines: CornerLineProjection[];
  evaluatedOffers: EvaluatedOffer[];
  generatedAt: string;
};

const DEFAULT_LINES = [7.5, 8.5, 9.5, 10.5, 11.5, 12.5];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function validSamples(samples: CornerSample[]): CornerSample[] {
  return samples.filter(
    (sample) =>
      Number.isFinite(sample.cornersFor) &&
      Number.isFinite(sample.cornersAgainst) &&
      sample.cornersFor >= 0 &&
      sample.cornersAgainst >= 0,
  );
}

function weightedMean(samples: CornerSample[], selector: (sample: CornerSample) => number, recentFormWeight: number): number {
  if (samples.length === 0) return 0;

  let weightedTotal = 0;
  let totalWeight = 0;
  const recency = clamp(recentFormWeight, 0, 1);

  samples.forEach((sample, index) => {
    const position = samples.length === 1 ? 1 : index / (samples.length - 1);
    const recencyMultiplier = 1 - recency + recency * (0.5 + position);
    const weight = Math.max(0.01, sample.weight ?? 1) * recencyMultiplier;
    weightedTotal += selector(sample) * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? weightedTotal / totalWeight : 0;
}

function poissonProbability(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let factorial = 1;
  for (let i = 2; i <= k; i += 1) factorial *= i;
  return (Math.exp(-lambda) * lambda ** k) / factorial;
}

function poissonDistribution(lambda: number): number[] {
  const max = Math.max(30, Math.ceil(lambda + 8 * Math.sqrt(Math.max(lambda, 1))));
  const probabilities: number[] = [];
  let total = 0;

  for (let k = 0; k <= max; k += 1) {
    const probability = poissonProbability(k, lambda);
    probabilities.push(probability);
    total += probability;
  }

  if (total > 0) return probabilities.map((probability) => probability / total);
  return probabilities;
}

function lineProbabilities(lambda: number, line: number) {
  const distribution = poissonDistribution(lambda);
  const integerLine = Number.isInteger(line);
  let over = 0;
  let under = 0;
  let push = 0;

  distribution.forEach((probability, totalCorners) => {
    if (totalCorners > line) over += probability;
    else if (totalCorners < line) under += probability;
    else if (integerLine) push += probability;
  });

  return { over, under, push };
}

function fairOdd(probability: number): number | null {
  return probability > 0 ? round(1 / probability, 2) : null;
}

function estimateExpectedCorners(input: CornerProjectionInput) {
  const home = validSamples(input.homeSamples);
  const away = validSamples(input.awaySamples);
  const recentFormWeight = input.recentFormWeight ?? 0.35;
  const leagueTotal = input.leagueAverageTotal && input.leagueAverageTotal > 0 ? input.leagueAverageTotal : 10;
  const leagueTeamAverage = leagueTotal / 2;

  const homeFor = weightedMean(home, (sample) => sample.cornersFor, recentFormWeight) || leagueTeamAverage;
  const homeAgainst = weightedMean(home, (sample) => sample.cornersAgainst, recentFormWeight) || leagueTeamAverage;
  const awayFor = weightedMean(away, (sample) => sample.cornersFor, recentFormWeight) || leagueTeamAverage;
  const awayAgainst = weightedMean(away, (sample) => sample.cornersAgainst, recentFormWeight) || leagueTeamAverage;

  const homeAttackStrength = homeFor / leagueTeamAverage;
  const awayDefenceWeakness = awayAgainst / leagueTeamAverage;
  const awayAttackStrength = awayFor / leagueTeamAverage;
  const homeDefenceWeakness = homeAgainst / leagueTeamAverage;

  const expectedHome = clamp(leagueTeamAverage * homeAttackStrength * awayDefenceWeakness, 1, 10);
  const expectedAway = clamp(leagueTeamAverage * awayAttackStrength * homeDefenceWeakness, 1, 10);

  return {
    expectedHome,
    expectedAway,
    expectedTotal: expectedHome + expectedAway,
    sampleSize: home.length + away.length,
  };
}

function evaluateOffer(offer: CornerMarketOffer, probability: number): EvaluatedOffer {
  const normalizedOdd = Number.isFinite(offer.odd) && offer.odd > 1 ? offer.odd : 0;
  const expectedValue = normalizedOdd > 0 ? probability * normalizedOdd - 1 : -1;
  const impliedProbability = normalizedOdd > 0 ? 1 / normalizedOdd : 1;
  const edge = probability - impliedProbability;

  return {
    ...offer,
    modelProbability: round(probability),
    fairOdd: fairOdd(probability),
    expectedValue: round(expectedValue),
    edge: round(edge),
    isValueBet: expectedValue >= 0.03 && edge >= 0.02,
  };
}

export function projectCornerMarket(input: CornerProjectionInput): CornerProjection {
  const estimate = estimateExpectedCorners(input);
  const offers = (input.marketOffers ?? []).filter(
    (offer) => Number.isFinite(offer.line) && Number.isFinite(offer.odd) && offer.odd > 1,
  );
  const lines = Array.from(new Set([...DEFAULT_LINES, ...offers.map((offer) => offer.line)])).sort((a, b) => a - b);
  const evaluatedOffers: EvaluatedOffer[] = [];

  const lineProjections = lines.map<CornerLineProjection>((line) => {
    const probabilities = lineProbabilities(estimate.expectedTotal, line);
    const lineOffers = offers.filter((offer) => Math.abs(offer.line - line) < 0.001);
    const overOffers = lineOffers
      .filter((offer) => offer.side === 'over')
      .map((offer) => evaluateOffer(offer, probabilities.over));
    const underOffers = lineOffers
      .filter((offer) => offer.side === 'under')
      .map((offer) => evaluateOffer(offer, probabilities.under));

    evaluatedOffers.push(...overOffers, ...underOffers);

    return {
      line,
      overProbability: round(probabilities.over),
      underProbability: round(probabilities.under),
      pushProbability: round(probabilities.push),
      fairOverOdd: fairOdd(probabilities.over),
      fairUnderOdd: fairOdd(probabilities.under),
      bestOverOffer: overOffers.sort((a, b) => b.expectedValue - a.expectedValue)[0],
      bestUnderOffer: underOffers.sort((a, b) => b.expectedValue - a.expectedValue)[0],
    };
  });

  const confidence = clamp(0.35 + Math.min(estimate.sampleSize, 20) * 0.025, 0.35, 0.85);

  return {
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    expectedHomeCorners: round(estimate.expectedHome, 2),
    expectedAwayCorners: round(estimate.expectedAway, 2),
    expectedTotalCorners: round(estimate.expectedTotal, 2),
    confidence: round(confidence, 2),
    sampleSize: estimate.sampleSize,
    lines: lineProjections,
    evaluatedOffers: evaluatedOffers.sort((a, b) => b.expectedValue - a.expectedValue),
    generatedAt: new Date().toISOString(),
  };
}
