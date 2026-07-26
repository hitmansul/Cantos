'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, Filter, RefreshCw, Search, Star } from 'lucide-react';
import { buildSmartAlerts, type SmartAlert, type SmartAlertInput } from '@/lib/corners/smartAlertsEngine';

type Payload = { alerts?: SmartAlertInput[]; lastUpdated?: string; note?: string };
type WatchItem = { id: string; kind: 'team' | 'league' | 'market' | 'bookmaker'; value: string; enabled: boolean };
type PeriodFilter = 'all' | 'today' | 'next6h' | 'tomorrow';

const WATCHLIST_KEY = 'ia-cantos-watchlist-v1';

function readWatchlist(): WatchItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WATCHLIST_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item?.enabled) : [];
  } catch {
    return [];
  }
}

function parseStart(alert: SmartAlert) {
  const raw = (alert as SmartAlert & { startTime?: string }).startTime;
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function matchesWatchlist(alert: SmartAlert, items: WatchItem[]) {
  const source = `${alert.match} ${alert.leagueName} ${alert.market}`.toLowerCase();
  return items.some((item) => source.includes(item.value.toLowerCase()));
}

function isInPeriod(date: Date | null, period: PeriodFilter) {
  if (period === 'all' || !date) return true;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const startDayAfter = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  if (period === 'today') return date >= startToday && date < startTomorrow;
  if (period === 'tomorrow') return date >= startTomorrow && date < startDayAfter;
  return date >= now && date <= new Date(now.getTime() + 6 * 60 * 60 * 1000);
}

function gradeTone(grade: string) {
  if (grade === 'S+' || grade === 'S') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600';
  if (grade === 'A' || grade === 'B') return 'border-amber-500/40 bg-amber-500/10 text-amber-600';
  return 'border-border bg-muted text-muted-foreground';
}

export default function SmartCalendarPage() {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('today');
  const [query, setQuery] = useState('');
  const [league, setLeague] = useState('all');
  const [onlyWatchlist, setOnlyWatchlist] = useState(false);
  const [minimumScore, setMinimumScore] = useState(0);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/odds/alerts?scope=all', { cache: 'no-store' });
      const payload = await response.json() as Payload;
      if (!response.ok) throw new Error('Não foi possível carregar a agenda inteligente.');
      setAlerts(buildSmartAlerts(payload.alerts ?? []));
      setWatchlist(readWatchlist());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar a agenda.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const leagues = useMemo(() => Array.from(new Set(alerts.map((alert) => alert.leagueName))).filter(Boolean).sort(), [alerts]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return alerts
      .filter((alert) => alert.score >= minimumScore)
      .filter((alert) => league === 'all' || alert.leagueName === league)
      .filter((alert) => !onlyWatchlist || matchesWatchlist(alert, watchlist))
      .filter((alert) => !normalized || `${alert.match} ${alert.leagueName} ${alert.market}`.toLowerCase().includes(normalized))
      .filter((alert) => isInPeriod(parseStart(alert), period))
      .sort((a, b) => {
        const aWatch = matchesWatchlist(a, watchlist) ? 1 : 0;
        const bWatch = matchesWatchlist(b, watchlist) ? 1 : 0;
        if (aWatch !== bWatch) return bWatch - aWatch;
        if (a.score !== b.score) return b.score - a.score;
        const aTime = parseStart(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bTime = parseStart(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
  }, [alerts, league, minimumScore, onlyWatchlist, period, query, watchlist]);

  const grouped = useMemo(() => {
    const groups = new Map<string, SmartAlert[]>();
    visible.forEach((alert) => {
      const date = parseStart(alert);
      const key = date ? date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }) : 'Horário não informado';
      groups.set(key, [...(groups.get(key) ?? []), alert]);
    });
    return Array.from(groups.entries());
  }, [visible]);

  const premium = visible.filter((alert) => alert.grade === 'S+' || alert.grade === 'S').length;
  const watchMatches = visible.filter((alert) => matchesWatchlist(alert, watchlist)).length;
  const nextMatch = visible.find((alert) => {
    const date = parseStart(alert);
    return date && date >= new Date();
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-bold text-primary"><CalendarDays className="h-4 w-4" /> Experience & Automation Engine</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Smart Calendar</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">Agenda priorizada por score, horário e watchlist. Os jogos mais relevantes aparecem primeiro, sem perder a organização cronológica.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Jogos exibidos" value={String(visible.length)} />
        <Metric label="Premium" value={String(premium)} />
        <Metric label="Da Watchlist" value={String(watchMatches)} />
        <Metric label="Próximo jogo" value={nextMatch ? (parseStart(nextMatch)?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) ?? '--:--') : '--:--'} />
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2 font-black"><Filter className="h-4 w-4" /> Filtros da agenda</div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="flex flex-col gap-2 text-sm font-semibold">Período<select value={period} onChange={(event) => setPeriod(event.target.value as PeriodFilter)} className="min-h-11 rounded-xl border bg-background px-3"><option value="today">Hoje</option><option value="next6h">Próximas 6 horas</option><option value="tomorrow">Amanhã</option><option value="all">Todos</option></select></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Liga<select value={league} onChange={(event) => setLeague(event.target.value)} className="min-h-11 rounded-xl border bg-background px-3"><option value="all">Todas</option>{leagues.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Score mínimo: {minimumScore}<input type="range" min="0" max="100" step="5" value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))} /></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Pesquisar<div className="flex min-h-11 items-center gap-2 rounded-xl border bg-background px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Jogo, liga ou mercado" className="w-full bg-transparent outline-none" /></div></label>
          <label className="flex items-center gap-3 self-end rounded-xl border bg-background p-3 text-sm font-semibold"><input type="checkbox" checked={onlyWatchlist} onChange={(event) => setOnlyWatchlist(event.target.checked)} /> Somente Watchlist</label>
        </div>
      </section>

      {error && <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">{error}</div>}
      {!loading && !error && visible.length === 0 && <div className="mt-5 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Nenhum jogo corresponde aos filtros selecionados.</div>}

      <section className="mt-6 space-y-6">
        {grouped.map(([dateLabel, items]) => (
          <div key={dateLabel}>
            <h2 className="mb-3 text-lg font-black capitalize">{dateLabel}</h2>
            <div className="grid gap-3">
              {items.map((alert, index) => {
                const start = parseStart(alert);
                const watched = matchesWatchlist(alert, watchlist);
                return (
                  <article key={alert.id} className={`rounded-2xl border bg-card p-4 shadow-sm ${watched ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
                          <span className="rounded-full bg-muted px-2 py-1">#{index + 1}</span>
                          <span className={`rounded-full border px-2 py-1 ${gradeTone(alert.grade)}`}>{alert.grade} · {alert.score}</span>
                          {watched && <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-primary"><Star className="h-3 w-3" /> Watchlist</span>}
                          <span>{alert.leagueName}</span>
                        </div>
                        <h3 className="mt-2 text-lg font-black">{alert.match}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{alert.market}</p>
                        <p className="mt-2 text-sm">{alert.message}</p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                        <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-background px-4 font-black"><Clock3 className="h-4 w-4" /> {start ? start.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'A confirmar'}</div>
                        <Link href="/opportunities" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 font-bold text-primary-foreground">Ver oportunidade</Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border bg-card p-4"><div className="text-sm font-semibold text-muted-foreground">{label}</div><div className="mt-1 text-3xl font-black">{value}</div></div>;
}
