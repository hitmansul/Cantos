export type PmsrStat = {
  metricKey: string;
  metricName: string;
  home: number | null;
  away: number | null;
  period: string;
  parser?: string;
  rawLine?: string;
};

const LIMITS: Record<string, { min: number; max: number; integer?: boolean }> = {
  possession: { min: 0, max: 100 },
  shots: { min: 0, max: 80, integer: true },
  shots_on_target: { min: 0, max: 50, integer: true },
  corners: { min: 0, max: 30, integer: true },
  yellow_cards: { min: 0, max: 15, integer: true },
  red_cards: { min: 0, max: 5, integer: true },
  fouls: { min: 0, max: 60, integer: true },
  offsides: { min: 0, max: 20, integer: true },
  passes: { min: 0, max: 1500, integer: true },
  pass_accuracy: { min: 0, max: 100 },
  goalkeeper_saves: { min: 0, max: 30, integer: true },
  expected_goals: { min: 0, max: 10 },
  crosses: { min: 0, max: 80, integer: true },
  tackles: { min: 0, max: 80, integer: true },
  interceptions: { min: 0, max: 80, integer: true },
  recoveries: { min: 0, max: 120, integer: true },
  clearances: { min: 0, max: 100, integer: true },
};

function validNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validatePmsrStat(stat: PmsrStat) {
  if (!validNumber(stat.home) || !validNumber(stat.away)) return 'valor ausente';
  const limit = LIMITS[stat.metricKey];
  if (!limit) return 'métrica não homologada';
  const values = [Number(stat.home), Number(stat.away)];
  if (values.some((value) => value < limit.min || value > limit.max)) return 'fora do limite plausível';
  if (limit.integer && values.some((value) => !Number.isInteger(value))) return 'deveria ser número inteiro';
  if (stat.metricKey === 'possession') {
    const total = values[0] + values[1];
    if (total < 95 || total > 105) return 'posse não soma aproximadamente 100%';
    if (values.some((value) => value < 15)) return 'posse individual improvável';
  }
  if (stat.metricKey === 'expected_goals' && values.some((value) => value >= 6)) return 'xG acima do limite seguro';
  return null;
}

export function sanitizePmsrStats(stats: PmsrStat[]) {
  const accepted: PmsrStat[] = [];
  const rejected: Array<PmsrStat & { rejectedReason: string }> = [];
  const seen = new Set<string>();
  for (const stat of stats) {
    const reason = validatePmsrStat(stat);
    const key = `${stat.period || 'match'}:${stat.metricKey}`;
    if (reason) {
      rejected.push({ ...stat, rejectedReason: reason });
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    accepted.push({ ...stat, period: stat.period || 'match' });
  }
  return { accepted, rejected };
}
