'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bot, Loader2, RefreshCw } from 'lucide-react';

type LiveMatch = {
  id: number;
  minute: number | string;
  statusText?: string;
  competition?: string;
  homeTeam: { name: string; score: number };
  awayTeam: { name: string; score: number };
};

type LiveResponse = { matches?: LiveMatch[] };

export function LiveAssistantQuickAccess() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/live', { cache: 'no-store' });
      const payload = await response.json() as LiveResponse;
      setMatches(Array.isArray(payload.matches) ? payload.matches : []);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-black"><Bot className="h-5 w-5 text-primary" /> Analisar jogo com a IA</div>
          <p className="mt-1 text-sm text-muted-foreground">Abra o Assistente já com a partida selecionada, sem digitar o nome da equipe.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold disabled:opacity-60">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar
        </button>
      </div>

      {loading && matches.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Carregando partidas ao vivo…</div>
      ) : matches.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhuma partida ao vivo disponível agora.</div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {matches.slice(0, 12).map((match) => {
            const params = new URLSearchParams({
              liveMatchId: String(match.id),
              home: match.homeTeam.name,
              away: match.awayTeam.name,
              auto: '1',
            });
            return (
              <Link key={`${match.id}-${match.homeTeam.name}-${match.awayTeam.name}`} href={`/ai-assistant?${params.toString()}`} className="rounded-xl border p-3 transition hover:border-primary/50 hover:bg-primary/5">
                <div className="text-xs font-bold uppercase text-primary">{match.statusText || 'Ao vivo'} · {match.minute}'</div>
                <div className="mt-1 font-black">{match.homeTeam.name} x {match.awayTeam.name}</div>
                <div className="text-sm text-muted-foreground">{match.homeTeam.score}–{match.awayTeam.score} · {match.competition || 'Competição não informada'}</div>
                <div className="mt-3 inline-flex items-center gap-2 text-sm font-black text-primary"><Bot className="h-4 w-4" /> Perguntar à IA</div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
