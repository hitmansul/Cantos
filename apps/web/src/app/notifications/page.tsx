'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, RefreshCw, Search, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react';
import { buildSmartAlerts, type SmartAlert, type SmartAlertInput, type SmartAlertKind } from '@/lib/corners/smartAlertsEngine';

type Payload = { alerts?: SmartAlertInput[]; lastUpdated?: string; note?: string };
type Filter = 'all' | SmartAlertKind;

const filters: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'opportunity', label: 'Premium' },
  { value: 'upgrade', label: 'Melhorias' },
  { value: 'downgrade', label: 'Riscos' },
  { value: 'pattern', label: 'Padrões' },
  { value: 'system', label: 'Sistema' },
];

function AlertIcon({ kind }: { kind: SmartAlertKind }) {
  if (kind === 'opportunity') return <Sparkles className="h-5 w-5" />;
  if (kind === 'upgrade') return <TrendingUp className="h-5 w-5" />;
  if (kind === 'downgrade') return <ShieldAlert className="h-5 w-5" />;
  if (kind === 'pattern') return <CheckCircle2 className="h-5 w-5" />;
  return <AlertTriangle className="h-5 w-5" />;
}

function tone(alert: SmartAlert) {
  if (alert.priority === 'critical') return 'border-emerald-500/40 bg-emerald-500/10';
  if (alert.priority === 'high') return 'border-primary/40 bg-primary/5';
  if (alert.kind === 'downgrade') return 'border-red-500/40 bg-red-500/10';
  return 'border-border bg-card';
}

export default function NotificationsPage() {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [readIds, setReadIds] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/odds/alerts?scope=all', { cache: 'no-store' });
      const payload = await response.json() as Payload;
      if (!response.ok) throw new Error('Não foi possível carregar os alertas inteligentes.');
      setAlerts(buildSmartAlerts(payload.alerts ?? []));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar notificações.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const visibleAlerts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return alerts.filter((alert) => filter === 'all' || alert.kind === filter)
      .filter((alert) => !normalized || `${alert.match} ${alert.leagueName} ${alert.market}`.toLowerCase().includes(normalized));
  }, [alerts, filter, query]);

  const unread = alerts.filter((alert) => !readIds.includes(alert.id)).length;
  const premium = alerts.filter((alert) => alert.kind === 'opportunity').length;
  const risks = alerts.filter((alert) => alert.kind === 'downgrade').length;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-bold text-primary"><Bell className="h-4 w-4" /> Experience & Automation Engine</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Central de Alertas Inteligentes</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">Prioriza oportunidades, mudanças de cenário e sinais de risco sem exigir acompanhamento manual de todas as partidas.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Alertas ativos" value={String(alerts.length)} />
        <Metric label="Não lidos" value={String(unread)} />
        <Metric label="Premium" value={String(premium)} />
        <Metric label="Riscos" value={String(risks)} />
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} className={`rounded-xl px-3 py-2 text-sm font-bold ${filter === item.value ? 'bg-primary text-primary-foreground' : 'border bg-background'}`}>{item.label}</button>)}
          </div>
          <div className="flex min-h-11 w-full items-center gap-2 rounded-xl border bg-background px-3 lg:max-w-sm"><Search className="h-4 w-4 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar jogo, liga ou mercado" className="w-full bg-transparent outline-none" /></div>
        </div>
      </section>

      {error && <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">{error}</div>}
      {!loading && !error && visibleAlerts.length === 0 && <div className="mt-5 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Nenhum alerta corresponde aos filtros atuais.</div>}

      <section className="mt-5 grid gap-3">
        {visibleAlerts.map((alert) => {
          const isRead = readIds.includes(alert.id);
          return (
            <article key={alert.id} className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${tone(alert)} ${isRead ? 'opacity-65' : ''}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <div className="mt-0.5 rounded-xl border bg-background p-2"><AlertIcon kind={alert.kind} /></div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground"><span>{alert.leagueName}</span><span>•</span><span className="rounded-full border px-2 py-0.5">{alert.grade} · {alert.score}</span></div>
                    <h2 className="mt-1 text-lg font-black">{alert.title}</h2>
                    <p className="mt-1 font-bold">{alert.match}</p>
                    <p className="text-sm text-muted-foreground">{alert.market}</p>
                    <p className="mt-3 text-sm">{alert.message}</p>
                  </div>
                </div>
                <button onClick={() => setReadIds((current) => isRead ? current.filter((id) => id !== alert.id) : [...current, alert.id])} className="shrink-0 rounded-xl border bg-background px-3 py-2 text-sm font-bold">{isRead ? 'Marcar como não lido' : 'Marcar como lido'}</button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border bg-card p-4"><div className="text-sm font-semibold text-muted-foreground">{label}</div><div className="mt-1 text-3xl font-black">{value}</div></div>;
}
