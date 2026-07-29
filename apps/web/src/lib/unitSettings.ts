export const BETTING_UNIT_VALUE_KEY = 'ia-cantos-betting-unit-value-v1';
export const BANKROLL_VALUE_KEY = 'ia-cantos-performance-bankroll-v1';
export const DAILY_RISK_UNITS_KEY = 'ia-cantos-daily-risk-units-v1';
export const ENTRY_RISK_UNITS_KEY = 'ia-cantos-entry-risk-units-v1';

export const DEFAULT_BETTING_UNIT_VALUE = 100;
export const DEFAULT_BANKROLL_VALUE = 1000;
export const DEFAULT_ENTRY_RISK_UNITS = 1;
export const DEFAULT_DAILY_RISK_UNITS = 4;

function readPositiveNumber(key: string, fallback: number) {
  if (typeof window === 'undefined') return fallback;
  const stored = Number(window.localStorage.getItem(key));
  return Number.isFinite(stored) && stored > 0 ? stored : fallback;
}

export function readBettingUnitValue() { return readPositiveNumber(BETTING_UNIT_VALUE_KEY, DEFAULT_BETTING_UNIT_VALUE); }
export function readBankrollValue() { return readPositiveNumber(BANKROLL_VALUE_KEY, DEFAULT_BANKROLL_VALUE); }
export function readMaxEntryUnits() { return readPositiveNumber(ENTRY_RISK_UNITS_KEY, DEFAULT_ENTRY_RISK_UNITS); }
export function readMaxDailyUnits() { return readPositiveNumber(DAILY_RISK_UNITS_KEY, DEFAULT_DAILY_RISK_UNITS); }

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
