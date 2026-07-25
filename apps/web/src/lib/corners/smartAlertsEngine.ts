export type SmartAlertPriority = 'critical' | 'high' | 'medium' | 'low';
export type SmartAlertKind = 'opportunity' | 'upgrade' | 'downgrade' | 'pattern' | 'learning' | 'system';

export type SmartAlertInput = {
  id: string;
  eventId?: number;
  startTime?: string;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  marketName: string;
  selectionLabel: string;
  bestBookmaker?: string;
  bestOdd: number;
  medianOdd?: number;
  edgePct: number;
  confidence: string;
  bookmakersCompared: number;
  discovery?: boolean;
};

export type SmartAlert = {
  id: string;
  kind: SmartAlertKind;
  priority: SmartAlertPriority;
  title: string;
  message: string;
  match: string;
  leagueName: string;
  market: string;
  score: number;
  grade: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D';
  createdAt: string;
  source: SmartAlertInput;
};

const confidenceScore: Record<string, number> = {
  high: 25,
  alta: 25,
  medium: 16,
  media: 16,
  média: 16,
  moderada: 16,
  low: 8,
  baixa: 8,
  fraca: 8,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function calculateSmartAlertScore(alert: SmartAlertInput) {
  const edge = clamp(alert.edgePct / 20, 0, 1) * 50;
  const confidence = confidenceScore[alert.confidence.toLowerCase()] ?? 3;
  const liquidity = clamp(alert.bookmakersCompared / 6, 0, 1) * 15;
  const validation = alert.discovery ? 0 : 10;
  return Math.round(clamp(edge + confidence + liquidity + validation, 0, 100));
}

export function scoreToGrade(score: number): SmartAlert['grade'] {
  if (score >= 90) return 'S+';
  if (score >= 82) return 'S';
  if (score >= 72) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

function priorityFromGrade(grade: SmartAlert['grade']): SmartAlertPriority {
  if (grade === 'S+') return 'critical';
  if (grade === 'S') return 'high';
  if (grade === 'A' || grade === 'B') return 'medium';
  return 'low';
}

function kindFromAlert(alert: SmartAlertInput, score: number): SmartAlertKind {
  if (alert.discovery) return 'system';
  if (score >= 90 && alert.edgePct >= 10) return 'opportunity';
  if (alert.edgePct >= 7) return 'upgrade';
  if (alert.edgePct < 2 || alert.bookmakersCompared < 2) return 'downgrade';
  return 'pattern';
}

export function buildSmartAlert(alert: SmartAlertInput): SmartAlert {
  const score = calculateSmartAlertScore(alert);
  const grade = scoreToGrade(score);
  const kind = kindFromAlert(alert, score);
  const match = `${alert.homeTeam} x ${alert.awayTeam}`;
  const market = `${alert.marketName} — ${alert.selectionLabel}`;

  const titleByKind: Record<SmartAlertKind, string> = {
    opportunity: 'Oportunidade premium detectada',
    upgrade: 'Cenário ganhou força',
    downgrade: 'Cenário exige cautela',
    pattern: 'Convergência de sinais',
    learning: 'Novo aprendizado validado',
    system: 'Mercado aguardando validação',
  };

  const message = kind === 'downgrade'
    ? `Score ${score}, diferença de ${alert.edgePct.toFixed(1)}% e ${alert.bookmakersCompared} casa(s) comparada(s).`
    : `Score ${score} (${grade}), odd ${alert.bestOdd.toFixed(2)} e vantagem de ${alert.edgePct.toFixed(1)}% sobre a referência.`;

  return {
    id: `smart-${alert.id}`,
    kind,
    priority: priorityFromGrade(grade),
    title: titleByKind[kind],
    message,
    match,
    leagueName: alert.leagueName,
    market,
    score,
    grade,
    createdAt: alert.startTime || new Date().toISOString(),
    source: alert,
  };
}

export function buildSmartAlerts(alerts: SmartAlertInput[]) {
  return alerts
    .map(buildSmartAlert)
    .sort((a, b) => b.score - a.score || b.source.edgePct - a.source.edgePct);
}
