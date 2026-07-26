export type PerformanceResult = 'win' | 'loss' | 'push' | 'open';

export type PerformanceOperation = {
  id: string;
  date: string;
  match: string;
  league: string;
  market: string;
  odds: number;
  stake: number;
  result: PerformanceResult;
};

export const PERFORMANCE_OPERATIONS_KEY = 'ia-cantos-performance-operations-v1';

export function readPerformanceOperations(): PerformanceOperation[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PERFORMANCE_OPERATIONS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PerformanceOperation =>
      item &&
      typeof item.id === 'string' &&
      typeof item.date === 'string' &&
      typeof item.match === 'string' &&
      typeof item.league === 'string' &&
      typeof item.market === 'string' &&
      Number.isFinite(Number(item.odds)) &&
      Number.isFinite(Number(item.stake)) &&
      ['win', 'loss', 'push', 'open'].includes(item.result)
    ).map((item) => ({ ...item, odds: Number(item.odds), stake: Number(item.stake) }));
  } catch {
    return [];
  }
}

export function isSettledOperation(operation: PerformanceOperation) {
  return operation.result !== 'open';
}

export function operationProfit(operation: PerformanceOperation) {
  if (operation.result === 'win') return operation.stake * (operation.odds - 1);
  if (operation.result === 'loss') return -operation.stake;
  return 0;
}
