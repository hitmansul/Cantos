'use client';

import { Activity, Clock3, CornerUpRight, Radio, Sparkles } from 'lucide-react';
import { LiveMatches } from '@/components/LiveMatches';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export default function LivePage() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-3 py-6 sm:px-5 lg:px-8">
      <section className="overflow-hidden rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/10 via-background to-emerald-500/10 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-red-500/30 bg-red-500/20 text-red-400">
                <Radio className="mr-1 h-3.5 w-3.5" /> AO VIVO
              </Badge>
              <Badge variant="outline">Live Intelligence</Badge>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Central de jogos ao vivo</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
                Acompanhe placar, escanteios, estatísticas detalhadas e a previsão de acréscimos em uma tela exclusiva, sem sair das estatísticas da liga selecionada.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:min-w-[390px]">
            <Card className="p-3 text-center">
              <Activity className="mx-auto h-5 w-5 text-emerald-400" />
              <p className="mt-1 text-xs font-semibold">Estatísticas</p>
              <p className="text-[11px] text-muted-foreground">Tempo real</p>
            </Card>
            <Card className="p-3 text-center">
              <Clock3 className="mx-auto h-5 w-5 text-amber-400" />
              <p className="mt-1 text-xs font-semibold">Acréscimos</p>
              <p className="text-[11px] text-muted-foreground">Previstos e reais</p>
            </Card>
            <Card className="p-3 text-center">
              <CornerUpRight className="mx-auto h-5 w-5 text-cyan-400" />
              <p className="mt-1 text-xs font-semibold">Escanteios</p>
              <p className="text-[11px] text-muted-foreground">Mandante e visitante</p>
            </Card>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
          <p className="text-muted-foreground">
            O painel atualiza automaticamente e combina as fontes disponíveis para preservar as informações de paralisações e acréscimos de cada tempo.
          </p>
        </div>
      </section>

      <LiveMatches />
    </main>
  );
}
