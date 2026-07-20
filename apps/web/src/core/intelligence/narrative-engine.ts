import type { LiveIntelligenceInput, LiveIntelligenceState, TeamIntelligence } from './live-intelligence';

export type IntelligenceNarrative = {
  title: string;
  summary: string;
  reasons: string[];
  caution?: string;
  opportunityLabel: string;
};

const level = (value: number) => {
  if (value >= 85) return 'muito alta';
  if (value >= 70) return 'alta';
  if (value >= 55) return 'moderada';
  return 'baixa';
};

export const intelligenceScoreLabel = (score: number) => {
  if (score >= 85) return 'Excelente oportunidade';
  if (score >= 70) return 'Boa oportunidade';
  if (score >= 55) return 'Cenário em observação';
  return 'Baixa confiança';
};

function dominantTeam(input: LiveIntelligenceInput, state: LiveIntelligenceState) {
  if (state.leadingSide === 'away') {
    return { name: input.awayTeam.name, metrics: state.away };
  }
  if (state.leadingSide === 'home') {
    return { name: input.homeTeam.name, metrics: state.home };
  }
  return null;
}

function metricReasons(name: string, metrics: TeamIntelligence, state: LiveIntelligenceState) {
  const reasons: string[] = [];

  if (metrics.pressure >= 65) {
    reasons.push(`${name} apresenta pressão ofensiva ${level(metrics.pressure)}.`);
  }
  if (metrics.momentum >= 65) {
    reasons.push(`O momento da partida favorece ${name}, com domínio ofensivo consistente.`);
  }
  if (metrics.cornerProbability >= 70) {
    reasons.push(`A probabilidade de novo escanteio para ${name} está elevada.`);
  }
  if (metrics.goalProbability >= 70) {
    reasons.push(`O volume de finalizações e ações perigosas aumentou o sinal de próximo gol.`);
  }
  if (state.remainingTime >= 10) {
    reasons.push(`Ainda há aproximadamente ${Math.round(state.remainingTime)} minutos úteis para o cenário se desenvolver.`);
  }

  return reasons;
}

export function buildIntelligenceNarrative(
  input: LiveIntelligenceInput,
  state: LiveIntelligenceState,
): IntelligenceNarrative {
  const dominant = dominantTeam(input, state);
  const opportunityLabel = intelligenceScoreLabel(state.intelligenceScore);

  if (!dominant) {
    return {
      title: 'Partida equilibrada',
      summary: 'As equipes apresentam níveis semelhantes de pressão e momento neste instante. Ainda não existe domínio suficientemente claro para sustentar uma leitura agressiva.',
      reasons: [
        'A diferença de pressão entre mandante e visitante é pequena.',
        `O índice de inteligência atual é ${Math.round(state.intelligenceScore)} de 100.`,
      ],
      caution: state.dataQuality < 65
        ? 'A quantidade de estatísticas recebidas ainda limita a confiança da análise.'
        : 'Aguarde uma mudança de ritmo ou sequência ofensiva antes de considerar uma oportunidade.',
      opportunityLabel,
    };
  }

  const reasons = metricReasons(dominant.name, dominant.metrics, state);
  if (reasons.length === 0) {
    reasons.push('O cenário apresenta sinais iniciais, mas ainda sem intensidade suficiente para uma conclusão forte.');
  }

  let summary = `${dominant.name} possui a melhor leitura ofensiva da partida neste momento.`;
  if (dominant.metrics.cornerProbability >= dominant.metrics.goalProbability) {
    summary += ' O sinal mais consistente está relacionado à possibilidade de novo escanteio.';
  } else {
    summary += ' O sinal mais consistente está relacionado à possibilidade de próximo gol.';
  }

  const caution = state.remainingTime <= 7
    ? 'A janela restante é curta. Considere a redução do tempo disponível antes de tomar qualquer decisão.'
    : state.dataQuality < 60
      ? 'A confiança está limitada porque a fonte ainda enviou poucas estatísticas detalhadas.'
      : undefined;

  return {
    title: opportunityLabel,
    summary,
    reasons,
    caution,
    opportunityLabel,
  };
}
