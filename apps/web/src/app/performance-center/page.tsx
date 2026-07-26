'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BarChart3, CircleDollarSign, Plus, Target, Trash2, TrendingUp, WalletCards } from 'lucide-react';

type Result = 'win' | 'loss' | 'push' | 'open';
type Operation = {
  id: string;
  date: string;
  match: string;
  league: string;
  market: string;
  odds: number;
  stake: number;
  result: Result;
};

const STORAGE_KEY = 'ia-cantos-performance-operations-v1';
const BANKROLL_KEY = 'ia-cantos-performance-bankroll-v1';
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

function readOperations(): Operation[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function profit(operation: Operation) {
  if (operation.result === 'win') return operation.stake * (operation.odds - 1);
  if (operation.result === 'loss') return -operation.stake;
  return 0;
}

export default function PerformanceCenterPage() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [initialBankroll, setInitialBankroll] = useState(1000);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), match: '', league: '', market: 'Total de escanteios', odds: '1.90', stake: '20', result: 'open' as Result });
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    setOperations(readOperations());
    const stored = Number(window.localStorage.getItem(BANKROLL_KEY));
    if (Number.isFinite(stored) && stored > 0) setInitialBankroll(stored);
  }, []);

  useEffect(() => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(operations)); }, [operations]);
  useEffect(() => { window.localStorage.setItem(BANKROLL_KEY, String(initialBankroll)); }, [initialBankroll]);

  function addOperation(event: FormEvent) {
    event.preventDefault();
    const odds = Number(form.odds.replace(',', '.'));
    const stake = Number(form.stake.replace(',', '.'));
    if (!form.match.trim() || !form.league.trim() || !form.market.trim() || odds <= 1 || stake <= 0) return;
    setOperations((current) => [{ id: crypto.randomUUID(), date: form.date, match: form.match.trim(), league: form.league.trim(), market: form.market.trim(), odds, stake, result: form.result }, ...current]);
    setForm((current) => ({ ...current, match: '', league: '', odds: '1.90', stake: '20', result: 'open' }));
  }

  const settled = operations.filter((item) => item.result !== 'open');
  const totalStake = settled.reduce((sum, item) => sum + item.stake, 0);
  const totalProfit = settled.reduce((sum, item) => sum + profit(item), 0);
  const wins = settled.filter((item) => item.result === 'win').length;
  const losses = settled.filter((item) => item.result === 'loss').length;
  const hitRate = wins + losses ? (wins / (wins + losses)) * 100 : 0;
  const roi = totalStake ? (totalProfit / totalStake) * 100 : 0;
  const currentBankroll = initialBankroll + totalProfit;

  const visible = useMemo(() => operations.filter((item) => filter === 'all' || item.result === filter), [operations, filter]);
  const byLeague = useMemo(() => rankBy(operations, (item) => item.league), [operations]);
  const byMarket = useMemo(() => rankBy(operations, (item) => item.market), [operations]);
  const byOdds = useMemo(() => rankBy(operations, (item) => item.odds < 1.7 ? 'Até 1,69' : item.odds < 2 ? '1,70 a 1,99' : item.odds < 2.5 ? '2,00 a 2,49' : '2,50 ou mais'), [operations]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-bold text-primary"><TrendingUp className="h-4 w-4" /> Portfolio & Performance Engine</div>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Centro de Performance</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Registre suas operações e acompanhe lucro, ROI, taxa de acerto, banca e desempenho por liga, mercado e faixa de odds.</p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric icon={WalletCards} label="Banca atual" value={money.format(currentBankroll)} />
        <Metric icon={CircleDollarSign} label="Lucro acumulado" value={`${totalProfit > 0 ? '+' : ''}${money.format(totalProfit)}`} tone={totalProfit} />
        <Metric icon={TrendingUp} label="ROI" value={`${roi > 0 ? '+' : ''}${number.format(roi)}%`} tone={roi} />
        <Metric icon={Target} label="Taxa de acerto" value={`${number.format(hitRate)}%`} />
        <Metric icon={BarChart3} label="Operações liquidadas" value={String(settled.length)} />
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl font-black">Registrar operação</h2><label className="text-sm font-bold">Banca inicial <input type="number" min="1" value={initialBankroll} onChange={(e) => setInitialBankroll(Number(e.target.value) || 0)} className="ml-2 w-32 rounded-lg border bg-background px-3 py-2" /></label></div>
        <form onSubmit={addOperation} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="min-h-11 rounded-xl border bg-background px-3" />
          <input value={form.match} onChange={(e) => setForm({ ...form, match: e.target.value })} placeholder="Jogo" className="min-h-11 rounded-xl border bg-background px-3 xl:col-span-2" />
          <input value={form.league} onChange={(e) => setForm({ ...form, league: e.target.value })} placeholder="Liga" className="min-h-11 rounded-xl border bg-background px-3" />
          <input value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value })} placeholder="Mercado" className="min-h-11 rounded-xl border bg-background px-3" />
          <input inputMode="decimal" value={form.odds} onChange={(e) => setForm({ ...form, odds: e.target.value })} placeholder="Odd" className="min-h-11 rounded-xl border bg-background px-3" />
          <input inputMode="decimal" value={form.stake} onChange={(e) => setForm({ ...form, stake: e.target.value })} placeholder="Stake R$" className="min-h-11 rounded-xl border bg-background px-3" />
          <select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value as Result })} className="min-h-11 rounded-xl border bg-background px-3"><option value="open">Em aberto</option><option value="win">Green</option><option value="loss">Red</option><option value="push">Devolvida</option></select>
          <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground"><Plus className="h-4 w-4" /> Registrar</button>
        </form>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-3">
        <Ranking title="Desempenho por liga" rows={byLeague} />
        <Ranking title="Desempenho por mercado" rows={byMarket} />
        <Ranking title="Desempenho por odds" rows={byOdds} />
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl font-black">Histórico de operações</h2><select value={filter} onChange={(e) => setFilter(e.target.value)} className="min-h-10 rounded-xl border bg-background px-3 font-semibold"><option value="all">Todos</option><option value="open">Em aberto</option><option value="win">Greens</option><option value="loss">Reds</option><option value="push">Devolvidas</option></select></div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm"><thead className="text-left text-muted-foreground"><tr className="border-b"><th className="p-3">Data</th><th className="p-3">Jogo</th><th className="p-3">Liga</th><th className="p-3">Mercado</th><th className="p-3">Odd</th><th className="p-3">Stake</th><th className="p-3">Resultado</th><th className="p-3">P/L</th><th className="p-3"></th></tr></thead>
          <tbody>{visible.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="p-3">{new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')}</td><td className="p-3 font-bold">{item.match}</td><td className="p-3">{item.league}</td><td className="p-3">{item.market}</td><td className="p-3">{number.format(item.odds)}</td><td className="p-3">{money.format(item.stake)}</td><td className="p-3"><ResultBadge result={item.result} onChange={(result) => setOperations((current) => current.map((operation) => operation.id === item.id ? { ...operation, result } : operation))} /></td><td className={`p-3 font-black ${profit(item) > 0 ? 'text-emerald-500' : profit(item) < 0 ? 'text-red-500' : ''}`}>{money.format(profit(item))}</td><td className="p-3"><button aria-label="Excluir operação" onClick={() => setOperations((current) => current.filter((operation) => operation.id !== item.id))} className="rounded-lg border p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table>
        </div>
        {visible.length === 0 && <div className="mt-4 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma operação encontrada.</div>}
      </section>
    </main>
  );
}

function rankBy(items: Operation[], keyOf: (item: Operation) => string) {
  const map = new Map<string, { name: string; settled: number; stake: number; profit: number; wins: number; losses: number }>();
  items.filter((item) => item.result !== 'open').forEach((item) => { const key = keyOf(item) || 'Não informado'; const row = map.get(key) || { name: key, settled: 0, stake: 0, profit: 0, wins: 0, losses: 0 }; row.settled += 1; row.stake += item.stake; row.profit += profit(item); if (item.result === 'win') row.wins += 1; if (item.result === 'loss') row.losses += 1; map.set(key, row); });
  return [...map.values()].map((row) => ({ ...row, roi: row.stake ? row.profit / row.stake * 100 : 0 })).sort((a, b) => b.roi - a.roi).slice(0, 5);
}

function Metric({ icon: Icon, label, value, tone = 0 }: { icon: typeof Target; label: string; value: string; tone?: number }) { return <div className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><div className={`mt-2 text-2xl font-black ${tone > 0 ? 'text-emerald-500' : tone < 0 ? 'text-red-500' : ''}`}>{value}</div></div>; }
function Ranking({ title, rows }: { title: string; rows: ReturnType<typeof rankBy> }) { return <div className="rounded-2xl border bg-card p-4"><h2 className="font-black">{title}</h2><div className="mt-3 space-y-2">{rows.map((row, index) => <div key={row.name} className="rounded-xl bg-muted/40 p-3"><div className="flex items-center justify-between gap-3"><span className="truncate font-bold">#{index + 1} {row.name}</span><span className={`font-black ${row.roi > 0 ? 'text-emerald-500' : row.roi < 0 ? 'text-red-500' : ''}`}>{row.roi > 0 ? '+' : ''}{number.format(row.roi)}%</span></div><div className="mt-1 text-xs text-muted-foreground">{row.settled} operações · {row.wins}G · {row.losses}R · {money.format(row.profit)}</div></div>)}{rows.length === 0 && <p className="text-sm text-muted-foreground">Aguardando operações liquidadas.</p>}</div></div>; }
function ResultBadge({ result, onChange }: { result: Result; onChange: (result: Result) => void }) { return <select aria-label="Resultado da operação" value={result} onChange={(e) => onChange(e.target.value as Result)} className="rounded-lg border bg-background px-2 py-1 text-xs font-bold"><option value="open">Em aberto</option><option value="win">Green</option><option value="loss">Red</option><option value="push">Devolvida</option></select>; }
