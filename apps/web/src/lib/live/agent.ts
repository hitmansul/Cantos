import { type Assessment, nullable } from './intelligence';

export type Incident = { reason?: string; timeline?: string; durationMs?: number; startAt?: string; endAt?: string };
export type Period = { totalStoppedMinutes?: number | null; predictedAddedMinutes?: number | null; incidents?: Incident[] };
export type AgentMatch = {
  id: number; eventKey?: string; minute: string | number; observedAt?: string; statsObservedAt?: string;
  competition?: string; homeTeam: { name: string; score: number }; awayTeam: { name: string; score: number };
  corners?: { total?: number }; statsSource?: string; assessment?: Assessment;
  liveStats?: { key?: string; label?: string; home?: string | number; away?: string | number }[];
  stoppage?: { periods?: { firstHalf?: Period; secondHalf?: Period } };
  periodStoppage?: { firstHalf?: Period; secondHalf?: Period };
};
const fresh = (value: string | undefined, now: number) => {
  const time = Date.parse(value ?? '');
  return Number.isFinite(time) && time <= now && now - time < 90_000;
};
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
export function inspectMatch(match: AgentMatch, healthy: boolean, now = Date.now()) {
  const current = healthy && fresh(match.observedAt, now);
  const statisticsCurrent = current && fresh(match.statsObservedAt, now);
  const red = match.liveStats?.find(row => [row.key, row.label].some(value =>
    ['red cards', 'red card', 'cartoes vermelhos', 'cartao vermelho'].includes(normalize(value ?? ''))));
  const homeRed = nullable(red?.home), awayRed = nullable(red?.away);
  const validCount = (value: number | null) => value !== null && Number.isInteger(value) && value >= 0 && value <= 11;
  const redCards = statisticsCurrent && (validCount(homeRed) || validCount(awayRed))
    ? { home: validCount(homeRed) ? homeRed : null, away: validCount(awayRed) ? awayRed : null } : null;
  const hasRedCard = Boolean(redCards && ((redCards.home ?? 0) > 0 || (redCards.away ?? 0) > 0));
  const assessment = match.assessment;
  const ready = statisticsCurrent && assessment?.ready === true && fresh(assessment.evaluatedAt, now);
  return {
    key: match.eventKey ?? String(match.id), current, redCards, hasRedCard,
    decision: ready ? assessment.decision : 'COLETANDO',
    score: ready ? assessment.score : null,
    explanation: !current ? 'Coleta indisponível ou atrasada. Sinais suspensos.'
      : !statisticsCurrent ? 'Aguardando estatísticas recentes da fonte.' : assessment?.explanation ?? 'Aguardando histórico suficiente.',
    alertKey: hasRedCard ? `${match.eventKey ?? match.id}:red:${homeRed}:${awayRed}` : null,
  };
}
export function rankMatches<T extends AgentMatch>(matches: T[], healthy: boolean, now = Date.now()) {
  return matches.map(match => ({ match, agent: inspectMatch(match, healthy, now) })).sort((a, b) =>
    Number(b.agent.hasRedCard) - Number(a.agent.hasRedCard) ||
    Number(b.agent.decision === 'OPORTUNIDADE') - Number(a.agent.decision === 'OPORTUNIDADE') ||
    (b.agent.score ?? -1) - (a.agent.score ?? -1));
}
