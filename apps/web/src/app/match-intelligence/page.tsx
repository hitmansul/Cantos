'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Brain, CalendarDays, MapPin, ShieldCheck, Sparkles, Target, Trophy } from 'lucide-react';

type Indicator = {
  sample_size?: number;
  averages?: Record<string, number>;
  rates?: Record<string, number>;
};

type MatchContext = {
  fixture: {
    fixtureId: string;
    competitionName?: string | null;
    season?: string | null;
    kickoffAt?: string | null;
    venue?: string | null;
    referee?: string | null;
    status?: string | null;
  };
  home: { name: string; logo?: string | null; recent?: Indicator | null; venue?: Indicator | null };
  away: { name: string; logo?: string | null; recent?: Indicator | null; venue?: Indicator | null };
  headToHead: { matches: unknown[] | number; averageGoals?: number; averageCorners?: number; averageCards?: number; bttsRate?: number };
  insights: {
    favorite?: string | null;
    momentum: { home: number; away: number };
    corners: { over95Probability: number };
    goals: { bttsProbability: number };
    confidence: number;
  };
  methodology?: { note?: string };
};

function percentage(value: number | undefined) {
  const safe = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;
  return `${Math.round(safe)}%`;
}

function number(value: unknown, digits = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : '—';
}

function MetricBar({ label, home, away }: { label: string; home: number; away: number }) {
  const total = Math.max(1, home + away);
  return (
    <div className="space-y-2">
      <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
        <span className="font-semibold tabular-nums">{number(home, 0)}</span>
        <span className="min-w-0 truncate text-center text-muted-foreground" title={label}>{label}</span>
        <span className="font-semibold tabular-nums">{number(away, 0)}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-primary transition-all" style={{ width: `${(home / total) * 100}%` }} />
        <div className="bg-accent transition-all" style={{ width: `${(away / total) * 100}%` }} />
      </div>
    </div>
  );
}

function ScoreCard({ icon, title, value, subtitle }: { icon: React.ReactNode; title: string; value: string; subtitle: string }) {
  return (
    <article className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted-foreground" title={title}>{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{value}</p>
        </div>
        <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary">{icon}</div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
    </article>
  );
}

function Team({ name, logo, side }: { name: string; logo?: string | null; side: 'home' | 'away' }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-background sm:h-20 sm:w-20">
        {logo ? <img src={logo} alt="" className="h-full w-full object-contain p-2" /> : <Trophy className="h-8 w-8 text-muted-foreground" />}
      </div>
      <span className="mt-3 max-w-full break-words text-base font-bold leading-tight sm:text-xl" title={name}>{name}</span>
      <span className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{side === 'home' ? 'Mandante' : 'Visitante'}</span>
    </div>
  );
}

export default function MatchIntelligencePage() {
  const [fixtureId, setFixtureId] = useState('');
  const [data, setData] = useState<MatchContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('fixtureId') ?? '';
    if (value) {
      setFixtureId(value);
      void load(value);
    }
  }, []);

  async function load(id: string) {
    const normalized = id.trim();
    if (!normalized) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/analytics/match?fixtureId=${encodeURIComponent(normalized)}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? 'Não foi possível carregar a partida.');
      setData(payload);
      window.history.replaceState(null, '', `/match-intelligence?fixtureId=${encodeURIComponent(normalized)}`);
    } catch (cause) {
      setData(null);
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar a partida.');
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void load(fixtureId);
  }

  const h2hCount = useMemo(() => {
    if (!data) return 0;
    return Array.isArray(data.headToHead.matches) ? data.headToHead.matches.length : Number(data.headToHead.matches ?? 0);
  }, [data]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-5 sm:px-5 sm:py-8 lg:px-8">
      <header className="mb-6 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-primary">
            <Brain className="h-3.5 w-3.5" /> Match Intelligence
          </div>
          <h1 className="break-words text-2xl font-black tracking-tight sm:text-4xl">Dashboard inteligente da partida</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Indicadores históricos, momento, tendências e confiança em uma tela adaptada para celular, tablet e desktop.</p>
        </div>
        <form onSubmit={submit} className="flex w-full min-w-0 flex-col gap-2 sm:flex-row lg:max-w-md">
          <input
            value={fixtureId}
            onChange={(event) => setFixtureId(event.target.value)}
            inputMode="numeric"
            placeholder="Informe o fixtureId"
            className="min-h-11 min-w-0 flex-1 rounded-xl border bg-card px-4 text-base outline-none ring-offset-background focus:ring-2 focus:ring-primary"
          />
          <button disabled={loading || !fixtureId.trim()} className="min-h-11 shrink-0 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? 'Carregando…' : 'Analisar'}
          </button>
        </form>
      </header>

      {error && <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {!data && !loading && !error && (
        <section className="rounded-2xl border border-dashed bg-card/50 p-8 text-center sm:p-12">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold">Digite o identificador de uma partida importada</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">O painel consultará o banco histórico e montará automaticamente a análise da partida.</p>
        </section>
      )}

      {data && (
        <div className="space-y-5 sm:space-y-7">
          <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-b bg-muted/30 px-4 py-3 text-xs text-muted-foreground sm:text-sm">
              <span className="max-w-full truncate font-semibold text-foreground" title={data.fixture.competitionName ?? ''}>{data.fixture.competitionName ?? 'Competição'}</span>
              {data.fixture.kickoffAt && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{new Date(data.fixture.kickoffAt).toLocaleString('pt-BR')}</span>}
              {data.fixture.venue && <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0" /><span className="truncate">{data.fixture.venue}</span></span>}
            </div>
            <div className="flex min-w-0 items-center gap-3 px-3 py-7 sm:gap-8 sm:px-8 sm:py-10">
              <Team name={data.home.name} logo={data.home.logo} side="home" />
              <div className="shrink-0 rounded-full border bg-background px-3 py-2 text-xs font-black sm:px-5 sm:text-sm">VS</div>
              <Team name={data.away.name} logo={data.away.logo} side="away" />
            </div>
            <div className="border-t bg-primary/5 px-4 py-3 text-center text-sm">
              <span className="font-semibold">Melhor momento: </span>{data.insights.favorite ?? 'equilíbrio estatístico'}
            </div>
          </section>

          <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ScoreCard icon={<Target className="h-5 w-5" />} title="Over 9.5 escanteios" value={percentage(data.insights.corners.over95Probability)} subtitle="Tendência combinada dos recortes recentes, casa/fora e confrontos diretos." />
            <ScoreCard icon={<Activity className="h-5 w-5" />} title="Ambas marcam" value={percentage(data.insights.goals.bttsProbability)} subtitle="Frequência histórica de gols para os dois lados nos recortes disponíveis." />
            <ScoreCard icon={<ShieldCheck className="h-5 w-5" />} title="Confiança da análise" value={percentage(data.insights.confidence)} subtitle="Qualidade da amostra utilizada pelo motor, e não garantia de acerto." />
            <ScoreCard icon={<BarChart3 className="h-5 w-5" />} title="Confrontos analisados" value={String(h2hCount)} subtitle="Quantidade de partidas recentes entre as equipes encontrada no banco." />
          </section>

          <section className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
            <article className="min-w-0 rounded-2xl border bg-card p-4 sm:p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold"><Activity className="h-5 w-5 text-primary" /> Momento das equipes</h2>
              <div className="mt-6 space-y-5">
                <MetricBar label="Momentum Score" home={data.insights.momentum.home} away={data.insights.momentum.away} />
                <MetricBar label="Média de escanteios a favor" home={Number(data.home.recent?.averages?.corners_for ?? 0)} away={Number(data.away.recent?.averages?.corners_for ?? 0)} />
                <MetricBar label="Média de gols marcados" home={Number(data.home.recent?.averages?.goals_for ?? 0) * 20} away={Number(data.away.recent?.averages?.goals_for ?? 0) * 20} />
                <MetricBar label="Taxa de vitórias" home={Number(data.home.recent?.rates?.wins ?? 0)} away={Number(data.away.recent?.rates?.wins ?? 0)} />
              </div>
            </article>

            <article className="min-w-0 rounded-2xl border bg-card p-4 sm:p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold"><Trophy className="h-5 w-5 text-primary" /> Confronto direto</h2>
              <dl className="mt-5 grid min-w-0 grid-cols-2 gap-3">
                {[
                  ['Jogos', h2hCount],
                  ['Média de gols', number(data.headToHead.averageGoals)],
                  ['Média de escanteios', number(data.headToHead.averageCorners)],
                  ['Média de cartões', number(data.headToHead.averageCards)],
                  ['Ambas marcam', percentage(data.headToHead.bttsRate)],
                  ['Amostra recente', `${Number(data.home.recent?.sample_size ?? 0)} + ${Number(data.away.recent?.sample_size ?? 0)}`],
                ].map(([label, value]) => (
                  <div key={String(label)} className="min-w-0 rounded-xl bg-muted/50 p-3 sm:p-4">
                    <dt className="break-words text-xs leading-snug text-muted-foreground sm:text-sm">{label}</dt>
                    <dd className="mt-1 break-words text-lg font-bold tabular-nums sm:text-xl">{value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </section>

          <aside className="rounded-2xl border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            <strong className="text-foreground">Metodologia:</strong> {data.methodology?.note ?? 'Indicadores históricos de natureza informativa.'}
          </aside>
        </div>
      )}
    </main>
  );
}
