export type TeamSide = 'home' | 'away';

export type IntelligenceStat = {
  key?: string;
  label: string;
  home: string | number;
  away: string | number;
};

export type LiveIntelligenceInput = {
  minute: number | string;
  statusText?: string;
  homeTeam: { name: string; score: number };
  awayTeam: { name: string; score: number };
  corners?: { home: number; away: number; total?: number };
  liveStats?: IntelligenceStat[];
  predictedAddedMinutes?: number | null;
};

export type ScoreFactor = {
  key: string;
  label: string;
  value: number;
  weight: number;
  contribution: number;
  explanation: string;
};

export type TeamIntelligence = {
  pressure: number;
  momentum: number;
  cornerProbability: number;
  goalProbability: number;
};

export type LiveIntelligenceState = {
  minute: number;
  remainingTime: number;
  remainingTimeConfidence: number;
  home: TeamIntelligence;
  away: TeamIntelligence;
  intelligenceScore: number;
  leadingSide: TeamSide | 'balanced';
  factors: ScoreFactor[];
  insights: string[];
  dataQuality: number;
};

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));

const normalizedLabel = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const numeric = (value: unknown) => {
  const match = String(value ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
};

const minuteNumber = (minute: number | string) => {
  if (typeof minute === 'number') return minute;
  const base = String(minute).match(/\d{1,3}/)?.[0];
  return base ? Number(base) : 0;
};

function findStat(stats: IntelligenceStat[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizedLabel);
  return stats.find((stat) => {
    const label = normalizedLabel(`${stat.key ?? ''} ${stat.label}`);
    return normalizedAliases.some((alias) => label.includes(alias));
  });
}

function pair(stats: IntelligenceStat[], aliases: string[]) {
  const stat = findStat(stats, aliases);
  return { home: numeric(stat?.home), away: numeric(stat?.away), found: Boolean(stat) };
}

function relativeScore(value: number, opponent: number, baseline = 1) {
  const total = value + opponent;
  if (total <= 0) return 50;
  return clamp(50 + ((value - opponent) / Math.max(total, baseline)) * 50);
}

function teamMetrics(input: LiveIntelligenceInput, side: TeamSide) {
  const stats = input.liveStats ?? [];
  const opponent: TeamSide = side === 'home' ? 'away' : 'home';
  const attacks = pair(stats, ['dangerous attacks', 'ataques perigosos']);
  const shots = pair(stats, ['total shots', 'shots', 'finalizacoes', 'chutes']);
  const shotsOnTarget = pair(stats, ['shots on target', 'chutes no gol', 'finalizacoes no alvo']);
  const possession = pair(stats, ['possession', 'posse de bola']);
  const crosses = pair(stats, ['crosses', 'cruzamentos']);
  const corners = {
    home: input.corners?.home ?? pair(stats, ['corners', 'escanteios']).home,
    away: input.corners?.away ?? pair(stats, ['corners', 'escanteios']).away,
  };

  const own = {
    attacks: attacks[side],
    shots: shots[side],
    shotsOnTarget: shotsOnTarget[side],
    possession: possession[side],
    crosses: crosses[side],
    corners: corners[side],
  };
  const other = {
    attacks: attacks[opponent],
    shots: shots[opponent],
    shotsOnTarget: shotsOnTarget[opponent],
    possession: possession[opponent],
    crosses: crosses[opponent],
    corners: corners[opponent],
  };

  const pressure = clamp(
    relativeScore(own.attacks, other.attacks) * 0.3 +
      relativeScore(own.shots, other.shots) * 0.2 +
      relativeScore(own.shotsOnTarget, other.shotsOnTarget) * 0.18 +
      relativeScore(own.corners, other.corners) * 0.17 +
      relativeScore(own.possession, other.possession) * 0.1 +
      relativeScore(own.crosses, other.crosses) * 0.05
  );

  const attackingVolume = own.attacks * 0.9 + own.shots * 3 + own.shotsOnTarget * 5 + own.corners * 4;
  const opponentVolume = other.attacks * 0.9 + other.shots * 3 + other.shotsOnTarget * 5 + other.corners * 4;
  const momentum = clamp(relativeScore(attackingVolume, opponentVolume) * 0.7 + pressure * 0.3);

  const minute = Math.max(1, minuteNumber(input.minute));
  const cornerRate = (own.corners / minute) * 90;
  const cornerProbability = clamp(
    18 + pressure * 0.42 + momentum * 0.18 + Math.min(20, cornerRate * 2.4) + Math.min(10, own.crosses * 0.35)
  );
  const goalProbability = clamp(
    10 + pressure * 0.3 + momentum * 0.2 + Math.min(24, own.shotsOnTarget * 6) + Math.min(12, own.shots * 1.2)
  );

  return { pressure, momentum, cornerProbability, goalProbability };
}

export function calculateLiveIntelligence(input: LiveIntelligenceInput): LiveIntelligenceState {
  const minute = minuteNumber(input.minute);
  const predictedAdded = Math.max(0, input.predictedAddedMinutes ?? (minute >= 80 ? 5 : 3));
  const regulationEnd = minute <= 45 ? 45 : 90;
  const remainingTime = Math.max(0, regulationEnd + predictedAdded - minute);
  const statsCount = input.liveStats?.length ?? 0;
  const dataQuality = clamp(35 + Math.min(45, statsCount * 5) + (input.corners ? 15 : 0) + (minute > 0 ? 5 : 0));

  const home = teamMetrics(input, 'home');
  const away = teamMetrics(input, 'away');
  const pressureGap = Math.abs(home.pressure - away.pressure);
  const leadingSide: LiveIntelligenceState['leadingSide'] =
    pressureGap < 8 ? 'balanced' : home.pressure > away.pressure ? 'home' : 'away';

  const dominant = leadingSide === 'away' ? away : home;
  const timeScore = clamp((remainingTime / 25) * 100);
  const factors: ScoreFactor[] = [
    {
      key: 'pressure',
      label: 'Pressão ofensiva',
      value: dominant.pressure,
      weight: 0.32,
      contribution: dominant.pressure * 0.32,
      explanation: 'Combina ataques perigosos, finalizações, posse, cruzamentos e escanteios.',
    },
    {
      key: 'momentum',
      label: 'Momentum',
      value: dominant.momentum,
      weight: 0.23,
      contribution: dominant.momentum * 0.23,
      explanation: 'Mede o domínio ofensivo relativo observado nos dados atuais da partida.',
    },
    {
      key: 'cornerProbability',
      label: 'Probabilidade de escanteio',
      value: dominant.cornerProbability,
      weight: 0.2,
      contribution: dominant.cornerProbability * 0.2,
      explanation: 'Considera pressão, ritmo de escanteios e volume de cruzamentos.',
    },
    {
      key: 'goalProbability',
      label: 'Probabilidade de gol',
      value: dominant.goalProbability,
      weight: 0.15,
      contribution: dominant.goalProbability * 0.15,
      explanation: 'Considera pressão, finalizações e chutes no alvo.',
    },
    {
      key: 'remainingTime',
      label: 'Tempo útil restante',
      value: timeScore,
      weight: 0.1,
      contribution: timeScore * 0.1,
      explanation: 'Valoriza sinais que ainda possuem tempo suficiente para se materializar.',
    },
  ];

  const intelligenceScore = clamp(factors.reduce((total, factor) => total + factor.contribution, 0));
  const dominantName = leadingSide === 'away' ? input.awayTeam.name : input.homeTeam.name;
  const insights: string[] = [];

  if (leadingSide === 'balanced') {
    insights.push('A partida apresenta equilíbrio de pressão entre as equipes neste momento.');
  } else {
    insights.push(`${dominantName} apresenta a maior pressão ofensiva do jogo neste momento.`);
  }
  if (dominant.cornerProbability >= 70) {
    insights.push(`O contexto atual indica probabilidade elevada de novo escanteio para ${dominantName}.`);
  }
  if (dominant.goalProbability >= 70) {
    insights.push(`O volume ofensivo atual elevou o sinal de próximo gol para ${dominantName}.`);
  }
  if (remainingTime <= 7) {
    insights.push('A janela restante é curta; sinais ofensivos precisam ser avaliados com maior cautela.');
  }
  if (dataQuality < 60) {
    insights.push('A confiança está limitada porque a fonte ainda enviou poucas estatísticas detalhadas.');
  }

  return {
    minute,
    remainingTime,
    remainingTimeConfidence: clamp(dataQuality * 0.75 + (input.predictedAddedMinutes != null ? 20 : 0)),
    home,
    away,
    intelligenceScore,
    leadingSide,
    factors,
    insights,
    dataQuality,
  };
}
