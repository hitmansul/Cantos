export const SOURCE_PRIORITY = {
  worldCup: ['fifa', '365scores', 'api-football'] as const,
  live: ['365scores', 'api-football', 'fifa'] as const,
  odds: ['api-football', '365scores'] as const,
  ai: ['database', 'local-static', 'fifa', '365scores', 'api-football', 'gemini'] as const,
};

export type SourceKey =
  | 'fifa'
  | '365scores'
  | 'api-football'
  | 'local-static'
  | 'database'
  | 'gemini';

export function explainSourcePriority(area: keyof typeof SOURCE_PRIORITY): string {
  return SOURCE_PRIORITY[area].join(' > ');
}
