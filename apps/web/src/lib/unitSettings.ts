export const BETTING_UNIT_VALUE_KEY = 'ia-cantos-betting-unit-value-v1';
export const DEFAULT_BETTING_UNIT_VALUE = 100;

export function readBettingUnitValue() {
  if (typeof window === 'undefined') return DEFAULT_BETTING_UNIT_VALUE;
  const stored = Number(window.localStorage.getItem(BETTING_UNIT_VALUE_KEY));
  return Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_BETTING_UNIT_VALUE;
}

export function saveBettingUnitValue(value: number) {
  if (typeof window === 'undefined') return;
  if (Number.isFinite(value) && value > 0) window.localStorage.setItem(BETTING_UNIT_VALUE_KEY, String(value));
}

export function stakeToUnits(stake: number, unitValue: number) {
  if (!Number.isFinite(stake) || !Number.isFinite(unitValue) || unitValue <= 0) return 0;
  return stake / unitValue;
}

export function unitsToStake(units: number, unitValue: number) {
  if (!Number.isFinite(units) || !Number.isFinite(unitValue) || unitValue <= 0) return 0;
  return units * unitValue;
}

export function formatUnits(units: number) {
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(units)} U`;
}
