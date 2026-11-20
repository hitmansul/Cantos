import { describe, it, expect } from 'vitest';
import { inspectMatch, rankMatches, type AgentMatch } from './agent';
import { collecting } from './intelligence';
const now = Date.parse('2026-11-20T12:00:00Z');
const match: AgentMatch = { id: 1, minute: 60, observedAt: new Date(now).toISOString(), statsObservedAt: new Date(now).toISOString(), homeTeam: { name: 'A', score: 0 }, awayTeam: { name: 'B', score: 0 }, assessment: { ...collecting(), ready: true, decision: 'OPORTUNIDADE', score: 80, evaluatedAt: new Date(now).toISOString() } };
describe('agent safety and prioritization', () => {
  it('suppresses good recommendations when collection fails or becomes stale', () => {
    expect(inspectMatch(match, false, now).score).toBeNull();
    expect(inspectMatch(match, true, now + 90_000).decision).toBe('COLETANDO');
    expect(inspectMatch({ ...match, statsObservedAt: undefined }, true, now).score).toBeNull();
  });
  it('does not confuse missing or yellow-card statistics with red cards', () => {
    for (const row of [{ label: 'Yellow cards', home: '2', away: '0' }, { label: 'Red cards', home: '', away: '' }, { label: 'Red cards', home: '-1', away: '0' }]) {
      expect(inspectMatch({ ...match, liveStats: [row] }, true, now).hasRedCard).toBe(false);
    }
  });
  it('alerts without changing corner score and keeps stable identity', () => {
    const red = { ...match, liveStats: [{ label: 'Cartões vermelhos', home: '0', away: '1' }] };
    const result = inspectMatch(red, true, now);
    expect(result.hasRedCard).toBe(true);
    expect(result.score).toBe(80);
    expect(inspectMatch(red, true, now + 1000).alertKey).toBe(result.alertKey);
    expect(inspectMatch(red, false, now).hasRedCard).toBe(false);
    expect(rankMatches([{ ...match, id: 2 }, red], true, now)[0].match.id).toBe(1);
  });
});
