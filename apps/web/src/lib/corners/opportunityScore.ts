import type { CornerProjection, EvaluatedOffer, ProjectionFactor } from './statisticalEngine';

export type OpportunityScoreComponent = {
  key: 'confidence' | 'sample' | 'consistency' | 'projection' | 'market' | 'risk';
  label: string;
  score: number;
  maxScore: number;
  explanation: string;
};

export type OpportunityScore = {
  total: number;
  label: 'excellent' | 'good' | 'watch' | 'avoid';
  recommendation: string;
  components: OpportunityScoreComponent[];
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 10) / 10;

function bestOffer(offers: EvaluatedOffer[]) {
  return [...offers].sort((a, b) => b.expectedValue - a.expectedValue || b.edge - a.edge)[0];
}

function positiveFactorShare(factors: ProjectionFactor[]) {
  if (!factors.length) return 0.5;
  const positive = factors.filter((factor) => factor.type === 'positive').length;
  const risk = factors.filter((factor) => factor.type === 'risk').length;
  return clamp((positive - risk + factors.length) / (factors.length * 2), 0, 1);
}

export function calculateOpportunityScore(projection: CornerProjection): OpportunityScore {
  const offer = bestOffer(projection.evaluatedOffers);
  const confidenceScore = clamp(projection.confidence * 25, 0, 25);
  const sampleScore = clamp((projection.sampleSize / 20) * 15, 0, 15);
  const consistencyScore = clamp(15 - Math.max(0, projection.volatility - 1.5) * 3, 0, 15);
  const projectionScore = clamp(positiveFactorShare(projection.factors) * 15, 0, 15);
  const marketScore = offer
    ? clamp((Math.max(0, offer.expectedValue) / 0.18) * 18 + (Math.max(0, offer.edge) / 0.08) * 12, 0, 30)
    : 0;
  const riskPenalty = offer?.riskLevel === 'high' ? 8 : offer?.riskLevel === 'medium' ? 3 : 0;
  const total = clamp(confidenceScore + sampleScore + consistencyScore + projectionScore + marketScore - riskPenalty, 0, 100);
  const label = total >= 85 ? 'excellent' : total >= 70 ? 'good' : total >= 55 ? 'watch' : 'avoid';
  const recommendation = label === 'excellent'
    ? 'Oportunidade excelente: dados, preço e risco estão alinhados.'
    : label === 'good'
      ? 'Boa oportunidade, mas confirme escalações e atualização da odd.'
      : label === 'watch'
        ? 'Vale monitorar; ainda falta força estatística ou preço suficiente.'
        : 'Evitar entrada neste momento.';

  return {
    total: Math.round(total),
    label,
    recommendation,
    components: [
      { key: 'confidence', label: 'Confiança do modelo', score: round(confidenceScore), maxScore: 25, explanation: `${Math.round(projection.confidence * 100)}% de confiança estatística.` },
      { key: 'sample', label: 'Qualidade da amostra', score: round(sampleScore), maxScore: 15, explanation: `${projection.sampleSize} registros válidos analisados.` },
      { key: 'consistency', label: 'Consistência dos resultados', score: round(consistencyScore), maxScore: 15, explanation: `Volatilidade calculada em ${projection.volatility.toFixed(2)}.` },
      { key: 'projection', label: 'Força dos fatores do jogo', score: round(projectionScore), maxScore: 15, explanation: 'Considera ritmo projetado, produção ofensiva e riscos identificados.' },
      { key: 'market', label: 'Valor da odd', score: round(marketScore), maxScore: 30, explanation: offer ? `Melhor EV ${(offer.expectedValue * 100).toFixed(1)}% e vantagem ${(offer.edge * 100).toFixed(1)} p.p.` : 'Nenhuma odd válida para comparação.' },
      { key: 'risk', label: 'Desconto por risco', score: -riskPenalty, maxScore: 0, explanation: riskPenalty ? `Foram descontados ${riskPenalty} pontos pelo risco da melhor oferta.` : 'Nenhum desconto adicional por risco.' },
    ],
  };
}
