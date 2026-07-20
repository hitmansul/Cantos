import {
  calculateLiveIntelligence,
  type IntelligenceStat,
  type LiveIntelligenceInput,
  type LiveIntelligenceState,
  type TeamSide,
} from './live-intelligence';

export type SimulationScenario = 'goal' | 'red-card' | 'quiet-period';

export type SimulationResult = {
  scenario: SimulationScenario;
  label: string;
  input: LiveIntelligenceInput;
  state: LiveIntelligenceState;
};

const aliases: Record<string, string[]> = {
  attacks: ['dangerous attacks', 'ataques perigosos'],
  shots: ['total shots', 'shots', 'finalizacoes', 'chutes'],
  shotsOnTarget: ['shots on target', 'chutes no gol', 'finalizacoes no alvo'],
  possession: ['possession', 'posse de bola'],
};

const normalize = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function numberFrom(value: string | number) {
  const match = String(value ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function updateStat(
  stats: IntelligenceStat[],
  keys: string[],
  side: TeamSide,
  change: (value: number) => number,
  fallbackLabel: string
) {
  const normalizedKeys = keys.map(normalize);
  const index = stats.findIndex((stat) => {
    const haystack = normalize(`${stat.key ?? ''} ${stat.label}`);
    return normalizedKeys.some((key) => haystack.includes(key));
  });

  const next = [...stats];
  if (index < 0) {
    next.push({ key: fallbackLabel, label: fallbackLabel, home: side === 'home' ? change(0) : 0, away: side === 'away' ? change(0) : 0 });
    return next;
  }

  const current = next[index];
  next[index] = {
    ...current,
    [side]: change(numberFrom(current[side])),
  };
  return next;
}

function scenarioLabel(scenario: SimulationScenario, side: TeamSide) {
  const team = side === 'home' ? 'mandante' : 'visitante';
  if (scenario === 'goal') return `Gol do ${team}`;
  if (scenario === 'red-card') return `Expulsão do ${team}`;
  return 'Cinco minutos sem ações ofensivas';
}

export function simulateLiveScenario(
  original: LiveIntelligenceInput,
  scenario: SimulationScenario,
  side: TeamSide = 'home'
): SimulationResult {
  let liveStats = [...(original.liveStats ?? [])];
  let homeTeam = { ...original.homeTeam };
  let awayTeam = { ...original.awayTeam };
  let minute = original.minute;

  if (scenario === 'goal') {
    if (side === 'home') homeTeam.score += 1;
    else awayTeam.score += 1;
    liveStats = updateStat(liveStats, aliases.shots, side, (value) => value + 1, 'Total shots');
    liveStats = updateStat(liveStats, aliases.shotsOnTarget, side, (value) => value + 1, 'Shots on target');
    liveStats = updateStat(liveStats, aliases.attacks, side, (value) => value + 2, 'Dangerous attacks');
  }

  if (scenario === 'red-card') {
    const opponent: TeamSide = side === 'home' ? 'away' : 'home';
    liveStats = updateStat(liveStats, aliases.attacks, side, (value) => Math.max(0, value * 0.78), 'Dangerous attacks');
    liveStats = updateStat(liveStats, aliases.possession, side, (value) => Math.max(20, value - 12), 'Possession');
    liveStats = updateStat(liveStats, aliases.attacks, opponent, (value) => value + 5, 'Dangerous attacks');
    liveStats = updateStat(liveStats, aliases.possession, opponent, (value) => Math.min(80, value + 12), 'Possession');
  }

  if (scenario === 'quiet-period') {
    const parsed = typeof original.minute === 'number' ? original.minute : Number(String(original.minute).match(/\d+/)?.[0] ?? 0);
    minute = parsed + 5;
    for (const teamSide of ['home', 'away'] as const) {
      liveStats = updateStat(liveStats, aliases.attacks, teamSide, (value) => value * 0.92, 'Dangerous attacks');
      liveStats = updateStat(liveStats, aliases.shots, teamSide, (value) => value * 0.95, 'Total shots');
    }
  }

  const input: LiveIntelligenceInput = { ...original, minute, homeTeam, awayTeam, liveStats };
  return { scenario, label: scenarioLabel(scenario, side), input, state: calculateLiveIntelligence(input) };
}
