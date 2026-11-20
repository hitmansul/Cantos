"use client";
import { useEffect, useRef, useState } from 'react';
import { rankMatches, type AgentMatch } from '@/lib/live/agent';

type Feed = { matches: AgentMatch[]; lastUpdated?: string; collectionConfirmed?: boolean; persistenceConfirmed?: boolean; error?: string; sourceStatus?: Record<string, string> };
const minutes = (value: number | null | undefined) => value == null ? 'Não informado' : `${value.toFixed(1)} min`;
export function CornerAgent() {
  const [feed, setFeed] = useState<Feed>({ matches: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('todos');
  const refresh = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true, busy = false;
    let controller: AbortController | undefined;
    async function load() {
      if (busy || document.hidden) return;
      busy = true; controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 50_000);
      try {
        const response = await fetch('/api/live/central?history=0', { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.matches)) throw new Error('Coleta indisponível. Aguardando recuperação das fontes.');
        if (active) { setFeed(data); setError(data.error ? 'Coleta degradada. Sinais suspensos.' : ''); }
      } catch { if (active) setError('Não foi possível atualizar. Sinais suspensos até uma nova coleta.'); }
      finally { clearTimeout(timeout); busy = false; if (active) { setLoading(false); setNow(Date.now()); } }
    }
    refresh.current = () => { void load(); };
    void load();
    const polling = setInterval(() => void load(), 30_000);
    const clock = setInterval(() => setNow(Date.now()), 5_000);
    const visible = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; controller?.abort(); clearInterval(polling); clearInterval(clock); document.removeEventListener('visibilitychange', visible); };
  }, []);
  const age = now - Date.parse(feed.lastUpdated ?? '');
  const healthy = !error && feed.collectionConfirmed === true && feed.persistenceConfirmed === true && age >= 0 && age < 90_000;
  const ranked = rankMatches(feed.matches, healthy, now);
  const rows = ranked.filter(({ match, agent }) =>
    `${match.homeTeam.name} ${match.awayTeam.name} ${match.competition}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
    (filter === 'todos' || (filter === 'expulsoes' ? agent.hasRedCard : agent.decision === 'OPORTUNIDADE')));
  const stats = ranked.filter(row => row.agent.score !== null).length;
  return <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
    <header className="rounded-2xl border bg-card p-5">
      <p className="text-sm font-semibold text-primary">IA Cantos · Agente de escanteios</p>
      <h1 className="mt-2 text-2xl font-bold">O jogo muda. O agente acompanha.</h1>
      <p className="mt-2 text-sm text-muted-foreground">Observa as fontes, avalia o histórico e destaca sinais de escanteios e expulsões. Avaliação automática por regras; força do sinal não é probabilidade calibrada.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm" role="status">
        <strong>{loading ? 'Conectando…' : healthy ? 'Monitoramento atualizado' : 'Aguardando dados confiáveis'}</strong>
        <span>{feed.matches.length} jogos disponíveis · {stats} com avaliação pronta</span>
        <button className="rounded-lg border px-3 py-2" onClick={() => refresh.current()}>Atualizar</button>
      </div>
      {feed.lastUpdated && <p className="mt-2 text-xs text-muted-foreground">Última coleta: {new Date(feed.lastUpdated).toLocaleTimeString('pt-BR')}</p>}
      {error && <p className="mt-3 text-sm text-amber-500" role="alert">{error}</p>}
      <p className="mt-3 text-xs text-muted-foreground">Cobertura limitada às fontes disponíveis. Alguns jogos não têm estatísticas ou paralisações detalhadas. Bet365: integração de linhas ainda não validada.</p>
    </header>
    <section aria-label="Filtros" className="flex flex-wrap gap-3">
      <input aria-label="Buscar jogo ou campeonato" className="min-w-0 flex-1 rounded-lg border bg-background p-3" placeholder="Buscar time ou campeonato" value={query} onChange={e => setQuery(e.target.value)} />
      <select aria-label="Filtrar sinais" className="rounded-lg border bg-background p-3" value={filter} onChange={e => setFilter(e.target.value)}><option value="todos">Todos os jogos</option><option value="oportunidades">Sinais de escanteios</option><option value="expulsoes">Com expulsão</option></select>
    </section>
    {!loading && rows.length === 0 && <p className="rounded-xl border p-6">{healthy ? 'Nenhum jogo disponível para este filtro.' : 'Sem jogos confirmados nesta coleta. Isso não confirma ausência de partidas ao vivo.'}</p>}
    <section className="grid gap-4 md:grid-cols-2" aria-label="Jogos monitorados">
      {rows.map(({ match, agent }) => <article key={agent.key} className="rounded-2xl border bg-card p-5">
        <p className="text-xs text-muted-foreground">{match.competition ?? 'Competição não informada'} · {String(match.minute)}′</p>
        <h2 className="mt-2 text-lg font-bold">{match.homeTeam.name} × {match.awayTeam.name}</h2>
        <p className="mt-1">{match.homeTeam.score}–{match.awayTeam.score} · Escanteios: {agent.current ? match.corners?.total ?? 'Não informado' : 'Leitura atrasada'}</p>
        {agent.hasRedCard && <p className="mt-3 rounded-lg border border-red-500 p-3 font-semibold text-red-500" role="alert">Expulsão informada · {match.homeTeam.name}: {agent.redCards?.home ?? '?'} · {match.awayTeam.name}: {agent.redCards?.away ?? '?'}</p>}
        <div className="mt-4 rounded-lg border p-3"><strong>{agent.decision === 'OPORTUNIDADE' ? 'Sinal de escanteio' : agent.decision === 'COLETANDO' ? 'Coletando dados' : agent.decision === 'EVITAR' ? 'Sem sinal favorável' : 'Acompanhando'}</strong>
          {agent.score !== null && <span> · Força {agent.score}/100</span>}<p className="mt-2 text-sm text-muted-foreground">{agent.explanation}</p>
        </div>
        <details className="mt-4"><summary className="cursor-pointer font-semibold">Previsão de acréscimos e paradas</summary>
          {!agent.current && <p className="mt-2 text-sm text-amber-500">Dados históricos; aguardando atualização.</p>}
          {(['firstHalf', 'secondHalf'] as const).map((half, index) => {
            const period = match.periodStoppage?.[half] ?? match.stoppage?.periods?.[half];
            return <div key={half} className="mt-3 border-t pt-3 text-sm"><strong>{index + 1}º tempo</strong><p>Previsão estimada: {minutes(period?.predictedAddedMinutes)}</p><p>Tempo parado observado: {minutes(period?.totalStoppedMinutes)}</p><p>Acréscimo oficial: sem confirmação</p>
              {period?.incidents?.length ? <ul className="mt-2 space-y-2">{period.incidents.map((incident, i) => <li key={`${incident.startAt ?? i}-${i}`} className="rounded border p-2">{incident.timeline ?? 'Minuto não informado'} · {incident.reason ?? 'Motivo não informado'} · {minutes(incident.durationMs == null ? null : incident.durationMs / 60000)}{incident.endAt ? '' : ' (registro aberto)'}</li>)}</ul> : <p className="mt-2 text-muted-foreground">Sem registro detalhado das paradas nesta fonte.</p>}
            </div>;
          })}
        </details>
        <p className="mt-3 text-xs text-muted-foreground">Fonte das estatísticas: {match.statsSource ?? 'não disponível'}. Expulsões são contexto, não garantia de escanteio.</p>
      </article>)}
    </section>
  </main>;
}
