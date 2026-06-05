"use client";

import { AlertTriangle, BadgeDollarSign, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ValueAlerts() {
  return (
    <div className="space-y-4">
      <Card className="p-5 border-amber-500/30 bg-amber-500/5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Odds reais ainda nao conectadas</h3>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Esta tela nao mostra mais odds estimadas. Para evitar qualquer leitura errada, os alertas de
                valor ficam bloqueados ate conectarmos uma fonte real de odds de escanteios.
              </p>
            </div>
          </div>
          <Badge className="w-fit bg-amber-500/15 text-amber-300 border-amber-500/30">
            Somente odds reais
          </Badge>
        </div>
      </Card>

      <Card className="p-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg bg-muted/30 p-4">
            <div className="flex items-center gap-2 font-semibold">
              <BadgeDollarSign className="w-4 h-4 text-emerald-300" />
              O que precisamos
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Uma API que entregue odds reais de escanteios por jogo, mercado e casa. Para Bet365, normalmente
              isso vem por provedor intermediario, nao por API publica oficial da casa.
            </p>
          </div>

          <div className="rounded-lg bg-muted/30 p-4">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="w-4 h-4 text-blue-300" />
              Como sera exibido
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Quando a fonte real estiver configurada, os alertas vao comparar nossa previsao local com a odd
              real recebida da casa e mostrar somente oportunidades com cotacao confirmada.
            </p>
          </div>

          <div className="rounded-lg bg-muted/30 p-4">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-300" />
              Status atual
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Sem chave real conectada para mercados de escanteios. Bet365, Pinnacle, Betano, KTO e Estrela Bet
              nao serao listadas ate chegarem da fonte real.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
