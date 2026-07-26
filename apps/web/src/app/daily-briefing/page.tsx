'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BellRing, CalendarClock, RefreshCw, Sparkles, Star, Target, Trophy } from 'lucide-react';
import { buildSmartAlerts, type SmartAlert, type SmartAlertInput } from '@/lib/corners/smartAlertsEngine';

type Payload = { alerts?: SmartAlertInput[]; lastUpdated?: string; note?: string };
type WatchItem = { id: string; kind: 'team' | 'league' | 'market' | 'bookmaker'; value: string; enabled: boolean };

const WATCHLIST_KEY = 'ia-cantos-watchlist-v1';

function readWatchlist(): WatchItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = window.localStorage.getItem(WATCHLIST_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.enabled) : [];
  } catch {
    return [];
  }
}

function matchesWatchlist(alert: SmartAlert, items: WatchItem[]) {
  const text = `${alert.match} ${alert.leagueName} ${alert.market}`.toLowerCase();
  return items.some((item) => text.includes(item.value.toLowerCase()));
}

export default function DailyBriefingPage() {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/odds/alerts?scope=all', { cache: 'no-store' });
      const payload = await response.json() as Payload;
      if (!response.ok) throw new Error('Não foi possível montar o briefing do dia.');
      setAlerts(buildSmartAlerts(payload.alerts ?? []));
      setLastUpdated(payload.lastUpdated ?? new Date().toISOString());
      setWatchlist(readWatchlist());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar o briefing diário.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const summary = useMemo(() => {
    const ordered = [...alerts].sort((a, b) => b.score - a.score);
    const premium = ordered.filter((alert) => alert.kind === 'opportunity' || alert.grade === 'S+' || alert.grade === 'S');
    const watchlistAlerts = ordered.filter((alert) => matchesWatchlist(alert, watchlist));
    const leagueCount = new Map<string, number>();
    ordered.forEach((alert) => leagueCount.set(alert.leagueName, (leagueCount.get(alert.leagueName) ?? 0) + 1));
    const leadingLeague = [...leagueCount.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      ordered,
      premium,
      watchlistAlerts,
      best: ordered[0],
      averageScore: ordered.length ? Math.round(ordered.reduce((total, alert) => total + alert.score, 0) / ordered.length) : 0,
      leadingLeague,
    };
  }, [alerts, watchlist]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-bold text-primary"><CalendarClock className="h-4 w-4" /> Experience & Automation Engine</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Daily Briefing</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">Resumo executivo das melhores oportunidades, alertas premium e itens da sua watchlist.</p>
          {lastUpdated && <p className="mt-2 text-xs text-muted-foreground">Atualizado em {new Date(lastUpdated).toLocaleString('pt-BR')}</p>}
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </header>

      {error && <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">{error}</div>}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Jogos monitorados" value={String(summary.ordered.length)} icon={<Target className="h-5 w-5" />} />
        <Metric label="Oportunidades premium" value={String(summary.premium.length)} icon={<Sparkles className="h-5 w-5" />} />
        <Metric label="Score médio" value={String(summary.averageScore)} icon={<Trophy className="h-5 w-5" />} />
        <Metric label="Alertas da watchlist" value={String(summary.watchlistAlerts.length)} icon={<Star className="h-5 w-5" />} />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-black text-primary"><Sparkles className="h-4 w-4" /> Melhor oportunidade do momento</div>
          {summary.best ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full border px-2 py-1 font-black">{summary.best.grade} · {summary.best.score}</span><span>{summary.best.leagueName}</span></div>
              <h2 className="mt-3 text-2xl font-black">{summary.best.match}</h2>
              <p className="mt-1 font-semibold text-muted-foreground">{summary.best.market}</p>
              <p className="mt-4">{summary.best.message}</p>
              <Link href="/notifications" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 font-bold text-primary-foreground">Abrir na Central de Alertas</Link>
            </div>
          ) : <p className="mt-4 text-muted-foreground">Nenhuma oportunidade disponível neste momento.</p>}
        </article>

        <article className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-black"><Trophy className="h-4 w-4" /> Leitura rápida do dia</div>
          <div className="mt-4 space-y-3 text-sm">
            <BriefRow label="Liga com mais sinais" value={summary.leadingLeague ? `${summary.leadingLeague[0]} (${summary.leadingLeague[1]})` : 'Sem dados'} />
            <BriefRow label="Itens ativos na watchlist" value={String(watchlist.length)} />
            <BriefRow label="Sinais premium" value={String(summary.premium.length)} />
            <BriefRow label="Riscos detectados" value={String(summary.ordered.filter((alert) => alert.kind === 'downgrade').length)} />
          </div>
        </article>
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Top oportunidades</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ordenadas pelo score do motor de alertas.</p>
          </div>
          <Link href="/opportunities" className="text-sm font-bold text-primary">Ver scanner completo</Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summary.ordered.slice(0, 6).map((alert) => <OpportunityCard key={alert.id} alert={alert} highlighted={matchesWatchlist(alert, watchlist)} />)}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2"><BellRing className="h-5 w-5" /><h2 className="text-xl font-black">Destaques da Watchlist</h2></div>
        {summary.watchlistAlerts.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Nenhum alerta atual corresponde aos itens ativos da watchlist.</div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{summary.watchlistAlerts.slice(0, 6).map((alert) => <OpportunityCard key={alert.id} alert={alert} highlighted />)}</div>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="rounded-2xl border bg-card p-4"><div className="flex items-center justify-between text-muted-foreground"><span className="text-sm font-semibold">{label}</span>{icon}</div><div className="mt-2 text-3xl font-black">{value}</div></div>;
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-xl border bg-background p-3"><span className="text-muted-foreground">{label}</span><span className="text-right font-black">{value}</span></div>;
}

function OpportunityCard({ alert, highlighted }: { alert: SmartAlert; highlighted: boolean }) {
  return <article className={`rounded-xl border p-4 ${highlighted ? 'border-primary/50 bg-primary/5' : 'bg-background'}`}><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full border px-2 py-0.5 font-black">{alert.grade} · {alert.score}</span>{highlighted && <span className="rounded-full bg-primary px-2 py-0.5 font-bold text-primary-foreground">Watchlist</span>}</div><h3 className="mt-3 font-black">{alert.match}</h3><p className="mt-1 text-sm text-muted-foreground">{alert.leagueName}</p><p className="mt-2 text-sm font-semibold">{alert.market}</p></article>;
}
