'use client';

import { FormEvent, useMemo, useState } from 'react';
import { BrainCircuit, Calculator, Sparkles, TrendingUp } from 'lucide-react';

type ProjectionOffer = {
  bookmaker: string;
  line: number;
  side: 'over' | 'under';
  odd: number;
  probability: number;
  fairOdd: number | null;
  expectedValue: number;
  edge: number;
  isValueBet: boolean;
};

type Projection = {
  expectedHomeCorners: number;
  expectedAwayCorners: number;
  expectedTotalCorners: number;
  confidence: 'low' | 'medium' | 'high';
  offers: ProjectionOffer[];
};

type ApiResponse = {
  ok: boolean;
  projection?: Projection;
  error?: string;
  disclaimer?: string;
};

function parseSeries(value: string) {
  return value
    .split(',')
    .map((item) => Number(item.trim().replace(',', '.')))
    .filter((item) => Number.isFinite(item) && item >= 0 && item <= 30);
}

function makeSamples(forValues: number[], againstValues: number[], venue: 'home' | 'away') {
  const size = Math.min(forValues.length, againstValues.length);
  return Array.from({ length: size }, (_, index) => ({
    cornersFor: forValues[index],
    cornersAgainst: againstValues[index],
    venue,
    weight: index === 0 ? 1.35 : Math.max(0.75, 1.2 - index * 0.08),
  }));
}

function decimal(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toFixed(digits).replace('.', ',');
}

export default function IACantosPage() {
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [homeFor, setHomeFor] = useState('');
  const [homeAgainst, setHomeAgainst] = useState('');
  const [awayFor, setAwayFor] = useState('');
  const [awayAgainst, setAwayAgainst] = useState('');
  const [line, setLine] = useState('9.5');
  const [odd, setOdd] = useState('1.90');
  const [bookmaker, setBookmaker] = useState('Bet365');
  const [side, setSide] = useState<'over' | 'under'>('over');
  const [projection, setProjection] = useState<Projection | null>(null);
  const [disclaimer, setDisclaimer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const samplesCount = useMemo(
    () => Math.min(parseSeries(homeFor).length, parseSeries(homeAgainst).length, parseSeries(awayFor).length, parseSeries(awayAgainst).length),
    [homeFor, homeAgainst, awayFor, awayAgainst],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setProjection(null);

    const homeSamples = makeSamples(parseSeries(homeFor), parseSeries(homeAgainst), 'home');
    const awaySamples = makeSamples(parseSeries(awayFor), parseSeries(awayAgainst), 'away');

    if (!homeTeam.trim() || !awayTeam.trim()) {
      setError('Informe os dois times.');
      return;
    }
    if (homeSamples.length < 3 || awaySamples.length < 3) {
      setError('Informe pelo menos três jogos de cada equipe, usando valores separados por vírgula.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ai-corners/projection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam: homeTeam.trim(),
          awayTeam: awayTeam.trim(),
          homeSamples,
          awaySamples,
          recentFormWeight: 0.65,
          marketOffers: [{
            bookmaker: bookmaker.trim() || 'Casa informada',
            line: Number(line.replace(',', '.')),
            side,
            odd: Number(odd.replace(',', '.')),
          }],
        }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.ok || !payload.projection) {
        throw new Error(payload.error || 'Não foi possível calcular a projeção.');
      }
      setProjection(payload.projection);
      setDisclaimer(payload.disclaimer || '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha inesperada ao calcular a projeção.');
    } finally {
      setLoading(false);
    }
  }

  const analyzedOffer = projection?.offers[0] ?? null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-7">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-bold text-primary">
          <BrainCircuit className="h-4 w-4" /> IA Cantos
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Análise estatística de escanteios</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Informe os resultados recentes das equipes e uma odd de mercado. A IA estima a linha justa, calcula o valor esperado e sinaliza quando existe vantagem matemática.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-5 rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
        <section className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">Mandante</span>
            <input value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} placeholder="Ex.: Fluminense" className="min-h-11 w-full rounded-xl border bg-background px-4" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">Visitante</span>
            <input value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} placeholder="Ex.: Palmeiras" className="min-h-11 w-full rounded-xl border bg-background px-4" />
          </label>
        </section>

        <section className="grid gap-4 border-t pt-5 lg:grid-cols-2">
          <div className="rounded-2xl border bg-muted/20 p-4">
            <h2 className="font-black">Últimos jogos do mandante</h2>
            <p className="mt-1 text-xs text-muted-foreground">Digite do jogo mais recente para o mais antigo.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input value={homeFor} onChange={(e) => setHomeFor(e.target.value)} placeholder="Escanteios a favor: 7, 5, 8, 6, 9" className="min-h-11 rounded-xl border bg-background px-4" />
              <input value={homeAgainst} onChange={(e) => setHomeAgainst(e.target.value)} placeholder="Escanteios contra: 3, 4, 2, 5, 4" className="min-h-11 rounded-xl border bg-background px-4" />
            </div>
          </div>
          <div className="rounded-2xl border bg-muted/20 p-4">
            <h2 className="font-black">Últimos jogos do visitante</h2>
            <p className="mt-1 text-xs text-muted-foreground">Digite do jogo mais recente para o mais antigo.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input value={awayFor} onChange={(e) => setAwayFor(e.target.value)} placeholder="Escanteios a favor: 5, 6, 4, 7, 5" className="min-h-11 rounded-xl border bg-background px-4" />
              <input value={awayAgainst} onChange={(e) => setAwayAgainst(e.target.value)} placeholder="Escanteios contra: 6, 5, 7, 4, 6" className="min-h-11 rounded-xl border bg-background px-4" />
            </div>
          </div>
        </section>

        <section className="grid gap-3 border-t pt-5 sm:grid-cols-2 lg:grid-cols-5">
          <input value={bookmaker} onChange={(e) => setBookmaker(e.target.value)} placeholder="Casa" className="min-h-11 rounded-xl border bg-background px-4" />
          <select value={side} onChange={(e) => setSide(e.target.value as 'over' | 'under')} className="min-h-11 rounded-xl border bg-background px-4">
            <option value="over">Over</option>
            <option value="under">Under</option>
          </select>
          <input type="number" min="0.5" max="30" step="0.5" value={line} onChange={(e) => setLine(e.target.value)} placeholder="Linha" className="min-h-11 rounded-xl border bg-background px-4" />
          <input type="number" min="1.01" max="100" step="0.01" value={odd} onChange={(e) => setOdd(e.target.value)} placeholder="Odd" className="min-h-11 rounded-xl border bg-background px-4" />
          <button disabled={loading} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50">
            <Calculator className="h-4 w-4" /> {loading ? 'Calculando…' : 'Analisar'}
          </button>
        </section>
        <p className="text-xs text-muted-foreground">Amostras completas identificadas por equipe: {samplesCount}</p>
      </form>

      {error && <div className="mt-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {projection && (
        <section className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <article className="rounded-2xl border bg-card p-5"><p className="text-xs font-bold uppercase text-muted-foreground">Mandante esperado</p><p className="mt-2 text-3xl font-black">{decimal(projection.expectedHomeCorners)}</p></article>
            <article className="rounded-2xl border bg-card p-5"><p className="text-xs font-bold uppercase text-muted-foreground">Visitante esperado</p><p className="mt-2 text-3xl font-black">{decimal(projection.expectedAwayCorners)}</p></article>
            <article className="rounded-2xl border bg-card p-5"><p className="text-xs font-bold uppercase text-muted-foreground">Total esperado</p><p className="mt-2 text-3xl font-black">{decimal(projection.expectedTotalCorners)}</p></article>
          </div>

          {analyzedOffer && (
            <article className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">Resultado da IA</p>
                  <h2 className="mt-2 text-2xl font-black">{analyzedOffer.side === 'over' ? 'Over' : 'Under'} {analyzedOffer.line} — {analyzedOffer.bookmaker}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Confiança do modelo: {projection.confidence === 'high' ? 'alta' : projection.confidence === 'medium' ? 'média' : 'baixa'}</p>
                </div>
                <div className={`rounded-2xl border px-5 py-4 ${analyzedOffer.isValueBet ? 'border-primary/40 bg-primary/10' : 'bg-muted/30'}`}>
                  <p className="text-xs font-bold uppercase text-muted-foreground">Decisão</p>
                  <p className="mt-1 text-xl font-black">{analyzedOffer.isValueBet ? 'Value Bet identificada' : 'Sem valor suficiente'}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">Probabilidade estimada</p><p className="mt-1 text-2xl font-black">{decimal(analyzedOffer.probability * 100, 1)}%</p></div>
                <div><p className="text-xs text-muted-foreground">Odd justa</p><p className="mt-1 text-2xl font-black">{decimal(analyzedOffer.fairOdd)}</p></div>
                <div><p className="text-xs text-muted-foreground">EV</p><p className="mt-1 text-2xl font-black">{decimal(analyzedOffer.expectedValue * 100, 1)}%</p></div>
                <div><p className="text-xs text-muted-foreground">Vantagem</p><p className="mt-1 text-2xl font-black">{decimal(analyzedOffer.edge * 100, 1)} p.p.</p></div>
              </div>
              <div className="mt-6 flex items-start gap-2 rounded-2xl border bg-muted/20 p-4 text-sm leading-relaxed">
                {analyzedOffer.isValueBet ? <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                <p>{analyzedOffer.isValueBet ? 'A probabilidade estimada pela IA é superior à probabilidade implícita da odd, respeitando os limites mínimos de EV e vantagem.' : 'A odd informada não oferece margem estatística suficiente pelos critérios atuais do modelo.'}</p>
              </div>
            </article>
          )}
          {disclaimer && <p className="text-xs leading-relaxed text-muted-foreground">{disclaimer}</p>}
        </section>
      )}
    </main>
  );
}
