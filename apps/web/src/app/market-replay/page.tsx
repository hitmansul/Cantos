'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { History, Play, Search } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type EventItem = { id: number; homeTeam: string; awayTeam: string; competition: string | null; kickoffAt: string | null };
type MarketItem = { id: number; eventId: number; marketName: string; selectionLabel: string; line: number | null };
type Point = { marketId: number; bookmakerKey: string; bookmaker: string; odd: number; capturedAt: string };
type Payload = { configured: boolean; events: EventItem[]; markets: MarketItem[]; timeline: Point[]; error?: string };

export default function MarketReplayPage() {
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [data, setData] = useState<Payload | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialHome = params.get('home') ?? '';
    const initialAway = params.get('away') ?? '';
    setHome(initialHome);
    setAway(initialAway);
    if (initialHome || initialAway) void load(initialHome, initialAway);
  }, []);

  async function load(homeValue = home, awayValue = away) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (homeValue.trim()) params.set('home', homeValue.trim());
      if (awayValue.trim()) params.set('away', awayValue.trim());
      const response = await fetch(`/api/odds/replay?${params.toString()}`, { cache: 'no-store' });
      const payload: Payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Não foi possível carregar o replay.');
      setData(payload);
      setSelectedMarket(payload.markets[0]?.id ?? 0);
      window.history.replaceState(null, '', `/market-replay?${params.toString()}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar o replay.');
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void load();
  }

  const selected = data?.markets.find((market) => market.id === selectedMarket) ?? null;
  const filteredTimeline = useMemo(() => (data?.timeline ?? []).filter((point) => point.marketId === selectedMarket), [data, selectedMarket]);
  const bookmakers = useMemo(() => [...new Set(filteredTimeline.map((point) => point.bookmaker))], [filteredTimeline]);
  const chartData = useMemo(() => {
    const map = new Map<string, Record<string, string | number>>();
    for (const point of filteredTimeline) {
      const key = new Date(point.capturedAt).toISOString();
      const row = map.get(key) ?? { capturedAt: key };
      row[point.bookmaker] = point.odd;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => String(a.capturedAt).localeCompare(String(b.capturedAt)));
  }, [filteredTimeline]);

  const opening = useMemo(() => {
    const result = new Map<string, Point>();
    for (const point of filteredTimeline) if (!result.has(point.bookmaker)) result.set(point.bookmaker, point);
    return [...result.values()];
  }, [filteredTimeline]);

  const closing = useMemo(() => {
    const result = new Map<string, Point>();
    for (const point of filteredTimeline) result.set(point.bookmaker, point);
    return [...result.values()];
  }, [filteredTimeline]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-bold text-primary"><History className="h-4 w-4" /> Market Replay</div>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Volte no tempo e reveja o mercado</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Reconstrua a evolução das odds por casa, compare abertura e fechamento e audite o que o sistema teria visto antes da partida.</p>
      </header>

      <form onSubmit={submit} className="mt-6 grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]">
        <input value={home} onChange={(event) => setHome(event.target.value)} placeholder="Mandante" className="min-h-11 rounded-xl border bg-background px-4" />
        <input value={away} onChange={(event) => setAway(event.target.value)} placeholder="Visitante" className="min-h-11 rounded-xl border bg-background px-4" />
        <button disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50"><Search className="h-4 w-4" /> {loading ? 'Buscando…' : 'Buscar replay'}</button>
      </form>

      {error && <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">{error}</div>}
      {data && !data.configured && <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">O banco histórico ainda não está configurado neste ambiente.</div>}

      {data?.events?.[0] && (
        <section className="mt-5 rounded-2xl border bg-card p-5">
          <div className="text-sm text-muted-foreground">{data.events[0].competition ?? 'Competição'} • {data.events[0].kickoffAt ? new Date(data.events[0].kickoffAt).toLocaleString('pt-BR') : 'Data não informada'}</div>
          <h2 className="mt-1 text-2xl font-black">{data.events[0].homeTeam} x {data.events[0].awayTeam}</h2>
        </section>
      )}

      {(data?.markets.length ?? 0) > 0 && (
        <section className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-2xl border bg-card p-4">
            <h2 className="font-black">Mercados disponíveis</h2>
            <div className="mt-3 grid gap-2">
              {data!.markets.map((market) => (
                <button key={market.id} onClick={() => setSelectedMarket(market.id)} className={`rounded-xl border p-3 text-left text-sm ${selectedMarket === market.id ? 'border-primary bg-primary/10' : 'hover:bg-muted'}`}>
                  <div className="font-bold">{market.marketName}</div>
                  <div className="mt-1 text-muted-foreground">{market.selectionLabel}{market.line !== null ? ` • linha ${market.line}` : ''}</div>
                </button>
              ))}
            </div>
          </aside>

          <div className="space-y-5">
            <article className="rounded-2xl border bg-card p-4 sm:p-5">
              <div className="flex items-center gap-2"><Play className="h-5 w-5 text-primary" /><h2 className="font-black">Evolução das odds</h2></div>
              <p className="mt-1 text-sm text-muted-foreground">{selected?.marketName} — {selected?.selectionLabel}</p>
              <div className="mt-5 h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="capturedAt" tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')} minTickGap={24} />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip labelFormatter={(value) => new Date(String(value)).toLocaleString('pt-BR')} />
                    <Legend />
                    {bookmakers.map((bookmaker) => <Line key={bookmaker} type="monotone" dataKey={bookmaker} connectNulls dot={false} strokeWidth={2} />)}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="rounded-2xl border bg-card p-4 sm:p-5">
              <h2 className="font-black">Abertura x fechamento</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Casa</th><th className="p-3">Abertura</th><th className="p-3">Fechamento</th><th className="p-3">Movimento</th><th className="p-3">Capturas</th></tr></thead>
                  <tbody>{bookmakers.map((bookmaker) => {
                    const first = opening.find((point) => point.bookmaker === bookmaker);
                    const last = closing.find((point) => point.bookmaker === bookmaker);
                    const movement = first && last ? ((last.odd / first.odd) - 1) * 100 : 0;
                    const count = filteredTimeline.filter((point) => point.bookmaker === bookmaker).length;
                    return <tr key={bookmaker} className="border-b last:border-0"><td className="p-3 font-bold">{bookmaker}</td><td className="p-3">{first?.odd.toFixed(2) ?? '—'}</td><td className="p-3">{last?.odd.toFixed(2) ?? '—'}</td><td className="p-3 font-semibold">{movement > 0 ? '+' : ''}{movement.toFixed(1)}%</td><td className="p-3">{count}</td></tr>;
                  })}</tbody>
                </table>
              </div>
            </article>
          </div>
        </section>
      )}

      {data && data.configured && data.markets.length === 0 && <div className="mt-5 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Ainda não há histórico de odds armazenado para essa busca.</div>}
    </main>
  );
}
