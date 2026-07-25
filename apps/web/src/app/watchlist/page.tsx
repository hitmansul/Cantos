'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BellRing, Plus, Search, Star, Trash2 } from 'lucide-react';

type WatchKind = 'team' | 'league' | 'market' | 'bookmaker';
type WatchItem = { id: string; kind: WatchKind; value: string; createdAt: string; enabled: boolean };

const STORAGE_KEY = 'ia-cantos-watchlist-v1';
const labels: Record<WatchKind, string> = {
  team: 'Time',
  league: 'Liga',
  market: 'Mercado',
  bookmaker: 'Casa de apostas',
};

function readStoredItems(): WatchItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [kind, setKind] = useState<WatchKind>('team');
  const [value, setValue] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => { setItems(readStoredItems()); }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  function addItem(event: FormEvent) {
    event.preventDefault();
    const normalized = value.trim();
    if (!normalized) return;
    const duplicated = items.some((item) => item.kind === kind && item.value.toLowerCase() === normalized.toLowerCase());
    if (duplicated) return;
    setItems((current) => [{ id: crypto.randomUUID(), kind, value: normalized, enabled: true, createdAt: new Date().toISOString() }, ...current]);
    setValue('');
  }

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => !normalized || `${labels[item.kind]} ${item.value}`.toLowerCase().includes(normalized));
  }, [items, query]);

  const active = items.filter((item) => item.enabled).length;
  const teams = items.filter((item) => item.kind === 'team').length;
  const leagues = items.filter((item) => item.kind === 'league').length;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-bold text-primary"><Star className="h-4 w-4" /> Experience & Automation Engine</div>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Watchlist Inteligente</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Defina os times, ligas, mercados e casas que merecem prioridade. Esses critérios serão usados para destacar alertas e oportunidades relevantes.</p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Itens monitorados" value={String(items.length)} />
        <Metric label="Monitoramento ativo" value={String(active)} />
        <Metric label="Times" value={String(teams)} />
        <Metric label="Ligas" value={String(leagues)} />
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-black">Adicionar monitoramento</h2>
        <form onSubmit={addItem} className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto]">
          <select value={kind} onChange={(event) => setKind(event.target.value as WatchKind)} className="min-h-11 rounded-xl border bg-background px-3 font-semibold">
            {Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <input value={value} onChange={(event) => setValue(event.target.value)} placeholder={`Digite ${labels[kind].toLowerCase()}`} className="min-h-11 rounded-xl border bg-background px-3 outline-none" />
          <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground"><Plus className="h-4 w-4" /> Adicionar</button>
        </form>
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-4">
        <div className="flex min-h-11 items-center gap-2 rounded-xl border bg-background px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar na watchlist" className="w-full bg-transparent outline-none" /></div>
      </section>

      {visibleItems.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed p-10 text-center">
          <BellRing className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-black">Nenhum item monitorado</p>
          <p className="mt-1 text-sm text-muted-foreground">Adicione um time, liga, mercado ou casa para começar.</p>
        </div>
      ) : (
        <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => (
            <article key={item.id} className={`rounded-2xl border bg-card p-4 ${item.enabled ? '' : 'opacity-55'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="rounded-full border px-2 py-1 text-xs font-bold text-muted-foreground">{labels[item.kind]}</span>
                  <h2 className="mt-3 text-lg font-black">{item.value}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Adicionado em {new Date(item.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
                <button aria-label={`Remover ${item.value}`} onClick={() => setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))} className="rounded-xl border p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
              <label className="mt-4 flex items-center justify-between rounded-xl border bg-background p-3 text-sm font-bold">
                Alertas prioritários
                <input type="checkbox" checked={item.enabled} onChange={() => setItems((current) => current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, enabled: !currentItem.enabled } : currentItem))} />
              </label>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border bg-card p-4"><div className="text-sm font-semibold text-muted-foreground">{label}</div><div className="mt-1 text-3xl font-black">{value}</div></div>;
}
