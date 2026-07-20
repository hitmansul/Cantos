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

export type ProjectionFactor = {
  type: 'positive' | 'neutral' | 'risk';
  title: string;
  description: string;
  impact: number;
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
  rating: 'avoid' | 'watch' | 'value' | 'strong-value';
  explanation: string;
};

export type CornerProjection = {
  homeTeam: string;
  awayTeam: string;
  expectedHomeCorners: number;
  expectedAwayCorners: number;
  expectedTotalCorners: number;
  confidence: number;
  confidenceLabel: 'low' | 'medium' | 'high';
  sampleSize: number;
  factors: ProjectionFactor[];
  summary: string;
  lines: CornerLineProjection[];
  evaluatedOffers: EvaluatedOffer[];
  generatedAt: string;
};

const DEFAULT_LINES = [7.5, 8.5, 9.5, 10.5, 11.5, 12.5];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, decimals = 4) => Math.round(value * 10 ** decimals) / 10 ** decimals;

function validSamples(samples: CornerSample[]) {
  return samples.filter((sample) => Number.isFinite(sample.cornersFor) && Number.isFinite(sample.cornersAgainst) && sample.cornersFor >= 0 && sample.cornersAgainst >= 0);
}

function weightedMean(samples: CornerSample[], selector: (sample: CornerSample) => number, recentFormWeight: number) {
  if (!samples.length) return 0;
  let weightedTotal = 0;
  let totalWeight = 0;
  const recency = clamp(recentFormWeight, 0, 1);
  samples.forEach((sample, index) => {
    const freshness = samples.length === 1 ? 1 : 1 - index / Math.max(samples.length - 1, 1);
    const recencyMultiplier = 1 - recency * 0.35 + freshness * recency * 0.7;
    const weight = Math.max(0.01, sample.weight ?? 1) * recencyMultiplier;
    weightedTotal += selector(sample) * weight;
    totalWeight += weight;
  });
  return totalWeight ? weightedTotal / totalWeight : 0;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function poissonProbability(k: number, lambda: number) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let factorial = 1;
  for (let i = 2; i <= k; i += 1) factorial *= i;
  return (Math.exp(-lambda) * lambda ** k) / factorial;
}

function lineProbabilities(lambda: number, line: number) {
  const max = Math.max(30, Math.ceil(lambda + 8 * Math.sqrt(Math.max(lambda, 1))));
  const distribution = Array.from({ length: max + 1 }, (_, total) => poissonProbability(total, lambda));
  const normalization = distribution.reduce((sum, probability) => sum + probability, 0) || 1;
  let over = 0; let under = 0; let push = 0;
  distribution.forEach((raw, total) => {
    const probability = raw / normalization;
    if (total > line) over += probability;
    else if (total < line) under += probability;
    else if (Number.isInteger(line)) push += probability;
  });
  return { over, under, push };
}

const fairOdd = (probability: number) => probability > 0 ? round(1 / probability, 2) : null;

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
  const expectedHome = clamp(leagueTeamAverage * (homeFor / leagueTeamAverage) * (awayAgainst / leagueTeamAverage), 1, 10);
  const expectedAway = clamp(leagueTeamAverage * (awayFor / leagueTeamAverage) * (homeAgainst / leagueTeamAverage), 1, 10);
  const totals = [...home, ...away].map((sample) => sample.cornersFor + sample.cornersAgainst);
  return { expectedHome, expectedAway, expectedTotal: expectedHome + expectedAway, sampleSize: home.length + away.length, homeFor, homeAgainst, awayFor, awayAgainst, volatility: standardDeviation(totals) };
}

function buildFactors(input: CornerProjectionInput, estimate: ReturnType<typeof estimateExpectedCorners>): ProjectionFactor[] {
  const factors: ProjectionFactor[] = [];
  const baseline = (input.leagueAverageTotal ?? 10);
  const difference = estimate.expectedTotal - baseline;
  factors.push({
    type: difference >= 1 ? 'positive' : difference <= -1 ? 'risk' : 'neutral',
    title: 'Ritmo projetado',
    description: `A projeção total é ${round(estimate.expectedTotal, 2)}, ${Math.abs(round(difference, 2))} ${difference >= 0 ? 'acima' : 'abaixo'} da referência de ${baseline}.`,
    impact: round(difference / Math.max(baseline, 1), 2),
  });
  factors.push({ type: estimate.homeFor >= 6 ? 'positive' : estimate.homeFor < 4 ? 'risk' : 'neutral', title: `Produção de ${input.homeTeam}`, description: `Média ponderada de ${round(estimate.homeFor, 2)} escanteios a favor e ${round(estimate.homeAgainst, 2)} contra.`, impact: round((estimate.homeFor - 5) / 5, 2) });
  factors.push({ type: estimate.awayFor >= 6 ? 'positive' : estimate.awayFor < 4 ? 'risk' : 'neutral', title: `Produção de ${input.awayTeam}`, description: `Média ponderada de ${round(estimate.awayFor, 2)} escanteios a favor e ${round(estimate.awayAgainst, 2)} contra.`, impact: round((estimate.awayFor - 5) / 5, 2) });
  factors.push({ type: estimate.volatility > 4 ? 'risk' : estimate.volatility < 2.5 ? 'positive' : 'neutral', title: 'Consistência da amostra', description: `Desvio dos totais recentes em ${round(estimate.volatility, 2)}. ${estimate.volatility > 4 ? 'Resultados muito variáveis reduzem a confiança.' : 'A variação está dentro de uma faixa aceitável.'}`, impact: round(-estimate.volatility / 10, 2) });
  factors.push({ type: estimate.sampleSize >= 16 ? 'positive' : estimate.sampleSize < 8 ? 'risk' : 'neutral', title: 'Tamanho da amostra', description: `${estimate.sampleSize} registros válidos foram usados no cálculo.`, impact: round((estimate.sampleSize - 10) / 20, 2) });
  return factors;
}

function evaluateOffer(offer: CornerMarketOffer, probability: number): EvaluatedOffer {
  const odd = Number.isFinite(offer.odd) && offer.odd > 1 ? offer.odd : 0;
  const expectedValue = odd ? probability * odd - 1 : -1;
  const impliedProbability = odd ? 1 / odd : 1;
  const edge = probability - impliedProbability;
  const rating = expectedValue >= 0.12 && edge >= 0.06 ? 'strong-value' : expectedValue >= 0.03 && edge >= 0.02 ? 'value' : expectedValue >= 0 ? 'watch' : 'avoid';
  const fair = fairOdd(probability);
  return {
    ...offer,
    modelProbability: round(probability), fairOdd: fair, expectedValue: round(expectedValue), edge: round(edge),
    isValueBet: rating === 'value' || rating === 'strong-value', rating,
    explanation: `${offer.side === 'over' ? 'Over' : 'Under'} ${offer.line}: modelo estima ${round(probability * 100, 1)}% contra ${round(impliedProbability * 100, 1)}% implícitos. Odd justa ${fair ?? 'indisponível'} e EV ${round(expectedValue * 100, 1)}%.`,
  };
}

export function projectCornerMarket(input: CornerProjectionInput): CornerProjection {
  const estimate = estimateExpectedCorners(input);
  const offers = (input.marketOffers ?? []).filter((offer) => Number.isFinite(offer.line) && Number.isFinite(offer.odd) && offer.odd > 1);
  const lines = Array.from(new Set([...DEFAULT_LINES, ...offers.map((offer) => offer.line)])).sort((a, b) => a - b);
  const evaluatedOffers: EvaluatedOffer[] = [];
  const lineProjections = lines.map<CornerLineProjection>((line) => {
    const probabilities = lineProbabilities(estimate.expectedTotal, line);
    const lineOffers = offers.filter((offer) => Math.abs(offer.line - line) < 0.001);
    const overOffers = lineOffers.filter((offer) => offer.side === 'over').map((offer) => evaluateOffer(offer, probabilities.over));
    const underOffers = lineOffers.filter((offer) => offer.side === 'under').map((offer) => evaluateOffer(offer, probabilities.under));
    evaluatedOffers.push(...overOffers, ...underOffers);
    return { line, overProbability: round(probabilities.over), underProbability: round(probabilities.under), pushProbability: round(probabilities.push), fairOverOdd: fairOdd(probabilities.over), fairUnderOdd: fairOdd(probabilities.under), bestOverOffer: overOffers.sort((a, b) => b.expectedValue - a.expectedValue)[0], bestUnderOffer: underOffers.sort((a, b) => b.expectedValue - a.expectedValue)[0] };
  });
  const baseConfidence = 0.32 + Math.min(estimate.sampleSize, 20) * 0.025 - Math.max(0, estimate.volatility - 2.5) * 0.035;
  const confidence = clamp(baseConfidence, 0.25, 0.9);
  const confidenceLabel = confidence >= 0.72 ? 'high' : confidence >= 0.52 ? 'medium' : 'low';
  const factors = buildFactors(input, estimate);
  return {
    homeTeam: input.homeTeam, awayTeam: input.awayTeam,
    expectedHomeCorners: round(estimate.expectedHome, 2), expectedAwayCorners: round(estimate.expectedAway, 2), expectedTotalCorners: round(estimate.expectedTotal, 2),
    confidence: round(confidence, 2), confidenceLabel, sampleSize: estimate.sampleSize, factors,
    summary: `O modelo projeta ${round(estimate.expectedTotal, 2)} escanteios para ${input.homeTeam} x ${input.awayTeam}, com confiança ${confidenceLabel === 'high' ? 'alta' : confidenceLabel === 'medium' ? 'média' : 'baixa'} (${round(confidence * 100, 0)}%).`,
    lines: lineProjections, evaluatedOffers: evaluatedOffers.sort((a, b) => b.expectedValue - a.expectedValue), generatedAt: new Date().toISOString(),
  };
}
