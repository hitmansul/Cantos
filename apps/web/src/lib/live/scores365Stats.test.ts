// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { collectScores365Stats, MAX_SCORES365_STATS } from './scores365Stats';
import { NextRequest } from 'next/server';

afterEach(() => vi.unstubAllGlobals());
const match = (id: number, competition = 'Liga') => ({ id, sourceIds: { scores365: id }, competition,
  homeTeam: { id: id * 10 }, awayTeam: { id: id * 10 + 1 } });
const response = (id: number) => new Response(JSON.stringify({ games: [{ id }], statistics: [
  { id: 8, name: 'Escanteios', competitorId: id * 10, value: '0' },
  { id: 8, name: 'Escanteios', competitorId: id * 10 + 1, value: '2' },
] }));

it('requests each event separately and retains real zero corners on both fixtures', async () => {
  const fetcher = vi.fn(async (url: string) => {
    const ids = new URL(url).searchParams.get('games')!;
    expect(ids).not.toContain(',');
    return response(Number(ids));
  });
  vi.stubGlobal('fetch', fetcher);
  const results = await collectScores365Stats([match(1), match(2)], {});
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect([...results.keys()]).toEqual([1, 2]);
  expect(results.get(2)?.statistics.map(s => s.competitorId)).toEqual([20, 21]);
  expect(results.get(2)?.statistics[0].value).toBe('0');
});

it('bounds requests, deduplicates event IDs and prioritizes followed games and Brasileirão', async () => {
  const fetcher = vi.fn(async (url: string) => response(Number(new URL(url).searchParams.get('games'))));
  vi.stubGlobal('fetch', fetcher);
  const matches = Array.from({ length: 25 }, (_, i) => match(i + 1));
  matches[23].competition = 'Brasileirão - Série A';
  const results = await collectScores365Stats([...matches, match(25)], {}, [25]);
  expect(fetcher).toHaveBeenCalledTimes(MAX_SCORES365_STATS);
  expect(results.has(25)).toBe(true);
  expect(results.has(24)).toBe(true);
  expect(results.has(23)).toBe(false);
});

it('isolates errors and absent statistics without manufacturing zero counters', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('timeout'))
    .mockResolvedValueOnce(new Response(JSON.stringify({ statistics: [] })))
    .mockResolvedValueOnce(response(3)));
  const results = await collectScores365Stats([match(1), match(2), match(3)], {});
  expect([...results.keys()]).toEqual([3]);
});

it('rejects a response for another fixture even if the same team participates', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response(1)));
  const second = { ...match(2), homeTeam: { id: 10 } };
  expect((await collectScores365Stats([second], {})).size).toBe(0);
});

it('does not treat another provider ID as a 365Scores event', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await collectScores365Stats([{ id: 1, homeTeam: { id: 10 }, awayTeam: { id: 11 } }], {});
  expect(fetcher).not.toHaveBeenCalled();
});

it('delivers corners for both games through the live route and respects a changed priority', async () => {
  vi.resetModules();
  const fetcher = vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.pathname === '/web/games/') return new Response(JSON.stringify({ games: [1, 2].map(id => ({
      id, sportId: 1, statusGroup: 3, gameTime: 67, competitionDisplayName: 'Brasileirão - Série A',
      homeCompetitor: { id: id * 10, name: `Casa ${id}` }, awayCompetitor: { id: id * 10 + 1, name: `Fora ${id}` },
    })) }));
    if (url.pathname === '/web/game/stats/') return response(Number(url.searchParams.get('games')));
    return new Response('{}', { status: 503 });
  });
  vi.stubGlobal('fetch', fetcher);
  const { GET } = await import('@/app/api/365scores/live/route');
  const result = await (await GET(new NextRequest('https://test.invalid/api/365scores/live?priority=2'))).json();
  expect(result.matches).toHaveLength(2);
  expect(result.matches.map((m: { corners: unknown }) => m.corners)).toEqual([
    { home: 0, away: 2, total: 2 }, { home: 0, away: 2, total: 2 },
  ]);
  const before = fetcher.mock.calls.length;
  await GET(new NextRequest('https://test.invalid/api/365scores/live?priority=2'));
  expect(fetcher.mock.calls.length).toBe(before);
  await GET(new NextRequest('https://test.invalid/api/365scores/live?priority=1'));
  expect(fetcher.mock.calls.length).toBeGreaterThan(before);
});

it('forwards canonical pending events and followed 365 IDs to statistics selection', async () => {
  const fetcher = vi.fn(async (_input: string | URL) => new Response(JSON.stringify({ matches: [] })));
  vi.stubGlobal('fetch', fetcher);
  const { GET } = await import('@/app/api/live/corners-fast/route');
  await GET(new NextRequest('https://test.invalid/api/live/corners-fast?follow=4632667&required=scores365:123,apiFootball:456'));
  const url = new URL(String(fetcher.mock.calls[0][0]));
  expect(url.searchParams.get('priority')).toBe('123,4632667');
});
