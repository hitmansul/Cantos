import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LiveFeedProvider, useLiveFeed } from '@/hooks/useLiveFeed';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function Panel({ name }: { name: string }) {
  const feed = useLiveFeed();
  return <section><span data-testid={name}>{feed.matches[0]?.minute ?? 'vazio'}:{feed.error ?? 'ok'}</span>
    <button onClick={() => void feed.refresh()}>Atualizar {name}</button></section>;
}
const response = (minute: number) => new Response(JSON.stringify({ matches: [{ minute }], lastUpdated: '2026-09-21T17:00:00Z' }));
const tree = <LiveFeedProvider><Panel name="assistente" /><Panel name="tempo" /><Panel name="jogos" /></LiveFeedProvider>;

it('loads once and refreshes all three panels with the same response', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response(30)).mockResolvedValueOnce(response(38));
  vi.stubGlobal('fetch', fetcher);
  render(tree);
  expect(await screen.findAllByText('30:ok')).toHaveLength(3);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('shares manual refresh and retains the last reading on a failed update', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response(30)).mockResolvedValueOnce(response(38)).mockRejectedValueOnce(new Error('Fonte indisponível'));
  vi.stubGlobal('fetch', fetcher);
  await act(async () => { render(tree); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.click(screen.getByText('Atualizar assistente')); });
  for (const name of ['assistente', 'tempo', 'jogos']) expect(screen.getByTestId(name).textContent).toBe('38:ok');
  expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async () => { fireEvent.click(screen.getByText('Atualizar jogos')); });
  for (const name of ['assistente', 'tempo', 'jogos']) expect(screen.getByTestId(name).textContent).toBe('38:Fonte indisponível');
});

it('uses one polling timer, skips hidden pages and cancels on unmount', async () => {
  vi.useFakeTimers();
  let visibility = 'visible';
  const spy = vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility as DocumentVisibilityState);
  const fetcher = vi.fn(async () => response(40)); vi.stubGlobal('fetch', fetcher);
  let unmount!: () => void;
  await act(async () => { unmount = render(tree).unmount; });
  await act(async () => { await vi.advanceTimersByTimeAsync(25_000); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  visibility = 'hidden';
  await act(async () => { await vi.advanceTimersByTimeAsync(25_000); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  visibility = 'visible';
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(fetcher).toHaveBeenCalledTimes(3);
  unmount();
  await vi.advanceTimersByTimeAsync(25_000);
  expect(fetcher).toHaveBeenCalledTimes(3);
  spy.mockRestore();
});

it('does not overlap requests and aborts the pending request when leaving', async () => {
  let signal: AbortSignal | undefined;
  const fetcher = vi.fn((_url: string, init: RequestInit) => { signal = init.signal as AbortSignal; return new Promise<Response>(() => {}); });
  vi.stubGlobal('fetch', fetcher);
  const { unmount } = render(tree);
  fireEvent.click(screen.getByText('Atualizar jogos'));
  fireEvent.click(screen.getByText('Atualizar tempo'));
  expect(fetcher).toHaveBeenCalledTimes(1);
  unmount(); expect(signal?.aborted).toBe(true);
});
