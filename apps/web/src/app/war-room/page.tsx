import { BrainCircuit, Radio, ShieldCheck, Sparkles } from 'lucide-react';
import { LiveWarRoom } from '@/components/LiveWarRoom';
import { Badge } from '@/components/ui/badge';

export default function WarRoomPage() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-3 py-6 sm:px-5 lg:px-8">
      <section className="overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-background to-emerald-500/10 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-red-500/30 bg-red-500/20 text-red-300"><Radio className="mr-1 h-3.5 w-3.5" />AO VIVO</Badge>
              <Badge variant="outline"><BrainCircuit className="mr-1 h-3.5 w-3.5" />Live Intelligence Engine</Badge>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">War Room Live</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
                Central operacional que classifica os jogos ao vivo por pressão, momentum, projeção de escanteios, confiança e decisão da IA.
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[390px]">
            <div className="rounded-xl border bg-background/50 p-3"><Sparkles className="h-5 w-5 text-violet-400" /><p className="mt-2 text-sm font-semibold">Ranking dinâmico</p><p className="text-xs text-muted-foreground">Melhores cenários primeiro</p></div>
            <div className="rounded-xl border bg-background/50 p-3"><ShieldCheck className="h-5 w-5 text-emerald-400" /><p className="mt-2 text-sm font-semibold">Decisão explicável</p><p className="text-xs text-muted-foreground">Entrada, monitoramento ou espera</p></div>
          </div>
        </div>
      </section>
      <LiveWarRoom />
    </main>
  );
}
