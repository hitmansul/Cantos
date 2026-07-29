export const BETTING_UNIT_VALUE_KEY = 'ia-cantos-betting-unit-value-v1';
export const BANKROLL_VALUE_KEY = 'ia-cantos-performance-bankroll-v1';
export const DAILY_RISK_UNITS_KEY = 'ia-cantos-daily-risk-units-v1';
export const MONTHLY_RISK_UNITS_KEY = 'ia-cantos-monthly-risk-units-v1';
export const ENTRY_RISK_UNITS_KEY = 'ia-cantos-entry-risk-units-v1';
export const DAILY_LIMIT_ENABLED_KEY = 'ia-cantos-daily-limit-enabled-v1';
export const MONTHLY_LIMIT_ENABLED_KEY = 'ia-cantos-monthly-limit-enabled-v1';

export const DEFAULT_BETTING_UNIT_VALUE = 100;
export const DEFAULT_BANKROLL_VALUE = 1000;
export const DEFAULT_ENTRY_RISK_UNITS = 1;
export const DEFAULT_DAILY_RISK_UNITS = 4;
export const DEFAULT_MONTHLY_RISK_UNITS = 40;

function readPositiveNumber(key: string, fallback: number) {
  if (typeof window === 'undefined') return fallback;
  const stored = Number(window.localStorage.getItem(key));
  return Number.isFinite(stored) && stored > 0 ? stored : fallback;
}

function readEnabled(key: string, fallback = true) {
  if (typeof window === 'undefined') return fallback;
  const stored = window.localStorage.getItem(key);
  if (stored === null) return fallback;
  return stored !== 'false';
}

export function readBettingUnitValue() { return readPositiveNumber(BETTING_UNIT_VALUE_KEY, DEFAULT_BETTING_UNIT_VALUE); }
export function readBankrollValue() { return readPositiveNumber(BANKROLL_VALUE_KEY, DEFAULT_BANKROLL_VALUE); }
export function readMaxEntryUnits() { return readPositiveNumber(ENTRY_RISK_UNITS_KEY, DEFAULT_ENTRY_RISK_UNITS); }
export function readDailyLimitEnabled() { return readEnabled(DAILY_LIMIT_ENABLED_KEY, true); }
export function readMonthlyLimitEnabled() { return readEnabled(MONTHLY_LIMIT_ENABLED_KEY, false); }
export function readConfiguredDailyUnits() { return readPositiveNumber(DAILY_RISK_UNITS_KEY, DEFAULT_DAILY_RISK_UNITS); }
export function readConfiguredMonthlyUnits() { return readPositiveNumber(MONTHLY_RISK_UNITS_KEY, DEFAULT_MONTHLY_RISK_UNITS); }
export function readMaxDailyUnits() { return readDailyLimitEnabled() ? readConfiguredDailyUnits() : Number.POSITIVE_INFINITY; }
export function readMaxMonthlyUnits() { return readMonthlyLimitEnabled() ? readConfiguredMonthlyUnits() : Number.POSITIVE_INFINITY; }

export function saveBettingUnitValue(value: number) {
  if (typeof window === 'undefined') return;
  if (Number.isFinite(value) && value > 0) window.localStorage.setItem(BETTING_UNIT_VALUE_KEY, String(value));
}

export function saveLimitSettings(settings: { dailyEnabled: boolean; dailyUnits: number; monthlyEnabled: boolean; monthlyUnits: number }) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DAILY_LIMIT_ENABLED_KEY, String(settings.dailyEnabled));
  window.localStorage.setItem(MONTHLY_LIMIT_ENABLED_KEY, String(settings.monthlyEnabled));
  if (Number.isFinite(settings.dailyUnits) && settings.dailyUnits > 0) window.localStorage.setItem(DAILY_RISK_UNITS_KEY, String(settings.dailyUnits));
  if (Number.isFinite(settings.monthlyUnits) && settings.monthlyUnits > 0) window.localStorage.setItem(MONTHLY_RISK_UNITS_KEY, String(settings.monthlyUnits));
}

export function stakeToUnits(stake: number, unitValue: number) {
  if (!Number.isFinite(stake) || !Number.isFinite(unitValue) || unitValue <= 0) return 0;
  return stake / unitValue;
}

export function unitsToStake(units: number, unitValue: number) {
  if (!Number.isFinite(units)) return Number.POSITIVE_INFINITY;
  if (!Number.isFinite(unitValue) || unitValue <= 0) return 0;
  return units * unitValue;
}

export function formatUnits(units: number) {
  if (!Number.isFinite(units)) return 'Sem limite';
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(units)} U`;
}
