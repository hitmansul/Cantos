'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Activity, BellRing, BrainCircuit, CalendarClock, Clock3, Radio, RefreshCw, Sparkles, Trophy, Wallet } from 'lucide-react';
import { buildSmartAlerts, type SmartAlert, type SmartAlertInput } from '@/lib/corners/smartAlertsEngine';

type AlertsPayload = { alerts?: SmartAlertInput[]; lastUpdated?: string };
type Operation = { stake: number; odd: number; result: 'pending' | 'win' | 'loss' | 'push' };

const PERFORMANCE_KEY = 'ia-cantos-performance-v1';

function readOperations(): Operation[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PERFORMANCE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function resultProfit(operation: Operation) {
  if (operation.result === 'win') return operation.stake * (operation.odd - 1);
  if (operation.result === 'loss') return -operation.stake;
  return 0;
}

export function HomeCommandCenter() {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/odds/alerts?scope=all', { cache: 'no-store' });
      const payload = await response.json() as AlertsPayload;
      if (response.ok) {
        setAlerts(buildSmartAlerts(payload.alerts ?? []));
        setLastUpdated(payload.lastUpdated ?? new Date().toISOString());
      }
      setOperations(readOperations());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const summary = useMemo(() => {
    const ordered = [...alerts].sort((a, b) => b.score - a.score);
    const premium = ordered.filter((alert) => alert.grade === 'S+' || alert.grade === 'S' || alert.kind === 'opportunity');
    const settled = operations.filter((operation) => operation.result !== 'pending');
    const profit = settled.reduce((total, operation) => total + resultProfit(operation), 0);
    const stake = settled.reduce((total, operation) => total + operation.stake, 0);
    const wins = settled.filter((operation) => operation.result === 'win').length;
    return {
      ordered,
      premium,
      profit,
      roi: stake > 0 ? (profit / stake) * 100 : 0,
      hitRate: settled.length ? (wins / settled.length) * 100 : 0,
    };
  }, [alerts, operations]);

  return (
    <section className="space-y-4 rounded-3xl border bg-card/70 p-4 shadow-sm backdrop-blur sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-primary"><BrainCircuit className="h-4 w-4" /> Centro de Comando</div>
          <h2 className="mt-1 text-2xl font-black">Visão inteligente do dia</h2>
          <p className="mt-1 text-sm text-muted-foreground">Oportunidades, agenda, mercado ao vivo e desempenho reunidos na tela inicial.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Sparkles} label="Oportunidades premium" value={String(summary.premium.length)} />
        <Metric icon={Activity} label="Jogos monitorados" value={String(summary.ordered.length)} />
        <Metric icon={Wallet} label="Resultado acumulado" value={summary.profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
        <Metric icon={Trophy} label="ROI pessoal" value={`${summary.roi.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-black"><Sparkles className="h-5 w-5 text-primary" /> Melhores oportunidades de hoje</div>
            <Link href="/opportunities" className="text-sm font-bold text-primary">Ver todas</Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {summary.ordered.slice(0, 4).map((alert) => (
              <Link key={alert.id} href="/opportunities" className="rounded-xl border p-3 transition hover:border-primary/50 hover:bg-primary/5">
                <div className="flex items-center justify-between gap-2 text-xs"><span className="rounded-full border px-2 py-0.5 font-black">{alert.grade} · {alert.score}</span><span className="truncate text-muted-foreground">{alert.leagueName}</span></div>
                <div className="mt-2 font-black">{alert.match}</div>
                <div className="mt-1 text-sm text-muted-foreground">{alert.market}</div>
              </Link>
            ))}
            {!loading && summary.ordered.length === 0 && <div className="md:col-span-2 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Nenhuma oportunidade disponível neste momento.</div>}
          </div>
        </article>

        <article className="rounded-2xl border bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-black"><CalendarClock className="h-5 w-5 text-primary" /> Agenda prioritária</div>
            <Link href="/smart-calendar" className="text-sm font-bold text-primary">Abrir agenda</Link>
          </div>
          <div className="mt-4 space-y-2">
            {summary.ordered.slice(0, 5).map((alert, index) => <div key={`${alert.id}-agenda`} className="flex items-center gap-3 rounded-xl border p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-black text-primary">{index + 1}</span><div className="min-w-0"><div className="truncate text-sm font-bold">{alert.match}</div><div className="truncate text-xs text-muted-foreground">{alert.leagueName} · Nota {alert.score}</div></div></div>)}
            {!loading && summary.ordered.length === 0 && <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">A agenda será preenchida quando houver jogos monitorados.</div>}
          </div>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <QuickLink href="/live" icon={Radio} title="Mercado ao vivo" description="Escanteios, linha atual, pressão, tempo parado, acréscimos estimados e acréscimos oficiais do árbitro." />
        <QuickLink href="/notifications" icon={BellRing} title="Alertas inteligentes" description="Mudanças de odds, tendência, risco e oportunidades de valor." />
        <QuickLink href="/performance-center" icon={Wallet} title="Minha performance" description={`Taxa de acerto atual: ${summary.hitRate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {lastUpdated ? `Atualizado em ${new Date(lastUpdated).toLocaleString('pt-BR')}` : 'Aguardando atualização'}</span><span>O tempo parado e os acréscimos oficiais serão exibidos somente quando a fonte ao vivo fornecer esses eventos.</span></div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return <div className="rounded-2xl border bg-background p-4"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div>;
}

function QuickLink({ href, icon: Icon, title, description }: { href: string; icon: typeof Trophy; title: string; description: string }) {
  return <Link href={href} className="rounded-2xl border bg-background p-4 transition hover:border-primary/50 hover:bg-primary/5"><div className="flex items-center gap-2 font-black"><Icon className="h-5 w-5 text-primary" />{title}</div><p className="mt-2 text-sm text-muted-foreground">{description}</p></Link>;
}
