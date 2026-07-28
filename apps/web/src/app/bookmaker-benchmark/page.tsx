'use client';

import { FormEvent, useMemo, useState } from 'react';
import { BarChart3, Building2, CheckCircle2, Crown, Database, Search, ShieldCheck, TrendingUp } from 'lucide-react';

type Offer = { bookmaker: string; odd: number };
type Market = { id: string; category: string; marketName: string; selectionLabel: string; lineValue: number | null; offers: Offer[] };
type OddsResponse = {
  configured: boolean;
  found: boolean;
  fixture?: { leagueName: string; homeTeam: string; awayTeam: string };
  markets: Market[];
  lastUpdated: string;
};

type BenchmarkRow = {
  bookmaker: string;
  appearances: number;
  bestCount: number;
  totalGapPct: number;
  totalOdd: number;
  markets: Set<string>;
  matches: Set<string>;
};

type QueryResult = {
  match: string;
  league: string;
  markets: number;
  offers: number;
};

function parseMatches(raw: string) {
  return raw
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+x\s+|\s+vs\.?\s+/i).map((x) => x.trim()).filter(Boolean);
      return parts.length >= 2 ? { home: parts[0], away: parts.slice(1).join(' x ') } : null;
    })
    .filter((item): item is { home: string; away: string } => Boolean(item));
}

function pct(value: number) { return `${value.toFixed(1).replace('.', ',')}%`; }
function number(value: number) { return value.toFixed(2).replace('.', ','); }

export default function BookmakerBenchmarkPage() {
  const [input, setInput] = useState('');
  const [competition, setCompetition] = useState('');
  const [date, setDate] = useState('');
  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [results, setResults] = useState<QueryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ranking = useMemo(() => rows.map((row) => {
    const bestRate = row.appearances ? (row.bestCount / row.appearances) * 100 : 0;
    const avgGap = row.appearances ? row.totalGapPct / row.appearances : 0;
    const avgOdd = row.appearances ? row.totalOdd / row.appearances : 0;
    const coverage = results.length ? (row.matches.size / results.length) * 100 : 0;
    const score = Math.max(0, Math.min(100, bestRate * 0.5 + coverage * 0.3 + Math.max(0, 100 - avgGap * 12) * 0.2));
    return { ...row, bestRate, avgGap, avgOdd, coverage, score };
  }).sort((a, b) => b.score - a.score), [rows, results]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const matches = parseMatches(input);
    if (!matches.length) {
      setError('Informe ao menos uma partida no formato Time A x Time B.');
      return;
    }

    setLoading(true);
    setError('');
    setRows([]);
    setResults([]);

    try {
      const aggregate = new Map<string, BenchmarkRow>();
      const queried: QueryResult[] = [];

      for (const match of matches) {
        const query = new URLSearchParams({ home: match.home, away: match.away });
        if (competition.trim()) query.set('competition', competition.trim());
        if (date) query.set('date', date);
        const response = await fetch(`/api/odds/match?${query.toString()}`, { cache: 'no-store' });
        const payload = (await response.json()) as OddsResponse;
        if (!response.ok) continue;
        if (!payload.configured) throw new Error('A API de odds ainda não está configurada no ambiente.');
        if (!payload.found || !payload.fixture) continue;

        let offerCount = 0;
        for (const market of payload.markets) {
          if (!market.offers.length) continue;
          const bestOdd = Math.max(...market.offers.map((offer) => Number(offer.odd) || 0));
          const marketKey = `${market.marketName}|${market.selectionLabel}|${market.lineValue ?? ''}`;
          const matchKey = `${payload.fixture.homeTeam} x ${payload.fixture.awayTeam}`;

          for (const offer of market.offers) {
            const odd = Number(offer.odd) || 0;
            if (!odd) continue;
            offerCount += 1;
            const gapPct = bestOdd > 0 ? ((bestOdd - odd) / bestOdd) * 100 : 0;
            const current = aggregate.get(offer.bookmaker) || {
              bookmaker: offer.bookmaker,
              appearances: 0,
              bestCount: 0,
              totalGapPct: 0,
              totalOdd: 0,
              markets: new Set<string>(),
              matches: new Set<string>(),
            };
            current.appearances += 1;
            current.bestCount += Math.abs(odd - bestOdd) < 0.0001 ? 1 : 0;
            current.totalGapPct += gapPct;
            current.totalOdd += odd;
            current.markets.add(marketKey);
            current.matches.add(matchKey);
            aggregate.set(offer.bookmaker, current);
          }
        }

        queried.push({
          match: `${payload.fixture.homeTeam} x ${payload.fixture.awayTeam}`,
          league: payload.fixture.leagueName,
          markets: payload.markets.length,
          offers: offerCount,
        });
      }

      setRows(Array.from(aggregate.values()));
      setResults(queried);
      if (!queried.length) setError('Nenhuma das partidas foi localizada com odds disponíveis.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao construir o benchmark.');
    } finally {
      setLoading(false);
    }
  }

  const leader = ranking[0];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Building2 className="h-4 w-4" /> Benchmark de Casas</div>
        <h1 className="text-3xl font-bold tracking-tight">Onde o mercado entrega mais valor</h1>
        <p className="max-w-3xl text-muted-foreground">Compare várias partidas de uma vez e descubra quais casas aparecem com maior frequência na melhor cotação, menor distância do topo e maior cobertura de mercados.</p>
      </header>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Partidas para analisar</span>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={5} placeholder={'Fluminense x Bahia\nPalmeiras x Fortaleza\nBotafogo x Cruzeiro'} className="w-full rounded-xl border bg-background px-4 py-3" />
          <span className="mt-1 block text-xs text-muted-foreground">Uma partida por linha. Também aceita “vs”.</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="Competição (opcional)" className="min-h-11 rounded-xl border bg-background px-4" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="min-h-11 rounded-xl border bg-background px-4" />
          <button disabled={loading || !input.trim()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50"><Search className="h-4 w-4" /> {loading ? 'Analisando…' : 'Gerar benchmark'}</button>
        </div>
      </form>

      {error && <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">{error}</div>}

      {ranking.length > 0 && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <Metric icon={Crown} label="Líder do benchmark" value={leader.bookmaker} detail={`Score ${leader.score.toFixed(0)}/100`} />
            <Metric icon={TrendingUp} label="Melhor odd" value={pct(leader.bestRate)} detail="das aparições analisadas" />
            <Metric icon={ShieldCheck} label="Cobertura" value={pct(leader.coverage)} detail="das partidas encontradas" />
            <Metric icon={Database} label="Amostra" value={`${results.length}`} detail={`${ranking.reduce((s, x) => s + x.appearances, 0)} ofertas comparadas`} />
          </section>

          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="border-b p-5"><h2 className="text-xl font-semibold">Ranking automático das casas</h2><p className="text-sm text-muted-foreground">Score pondera frequência de melhor cotação, cobertura e distância média para a melhor odd.</p></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Casa</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Melhor odd</th><th className="px-4 py-3">Gap médio</th><th className="px-4 py-3">Odd média</th><th className="px-4 py-3">Cobertura</th><th className="px-4 py-3">Mercados</th></tr></thead>
                <tbody className="divide-y">
                  {ranking.map((row, index) => <tr key={row.bookmaker}><td className="px-4 py-3 font-bold">{index + 1}</td><td className="px-4 py-3 font-semibold">{row.bookmaker}</td><td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2 py-1 font-bold text-primary">{row.score.toFixed(0)}</span></td><td className="px-4 py-3">{pct(row.bestRate)}</td><td className="px-4 py-3">{pct(row.avgGap)}</td><td className="px-4 py-3">{number(row.avgOdd)}</td><td className="px-4 py-3">{pct(row.coverage)}</td><td className="px-4 py-3">{row.markets.size}</td></tr>)}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card p-5"><div className="mb-3 flex items-center gap-2"><BarChart3 className="h-5 w-5" /><h2 className="text-lg font-semibold">Leitura operacional</h2></div><p className="text-sm leading-6 text-muted-foreground">{leader.bookmaker} lidera nesta amostra porque combinou {pct(leader.bestRate)} de aparições como melhor cotação, cobertura de {pct(leader.coverage)} e distância média de {pct(leader.avgGap)} para o melhor preço. O resultado representa apenas as partidas e mercados efetivamente retornados pela API nesta consulta.</p></div>
            <div className="rounded-2xl border bg-card p-5"><div className="mb-3 flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /><h2 className="text-lg font-semibold">Partidas processadas</h2></div><div className="space-y-2">{results.map((item) => <div key={item.match} className="rounded-xl bg-muted/50 p-3"><div className="font-semibold">{item.match}</div><div className="text-xs text-muted-foreground">{item.league} · {item.markets} mercados · {item.offers} ofertas</div></div>)}</div></div>
          </section>
        </>
      )}
    </main>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Crown; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border bg-card p-4 shadow-sm"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{label}</div><div className="mt-2 truncate text-2xl font-bold" title={value}>{value}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></div>;
}
