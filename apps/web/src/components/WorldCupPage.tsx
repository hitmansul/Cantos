ARQUIVO: apps/web/src/components/WorldCupPage.tsx

Troque a importação atual:

import { ValueAlerts } from '@/components/ValueAlerts';

por:

import { WorldCupOddsAlerts } from '@/components/WorldCupOddsAlerts';

Depois, na aba Odds, troque:

<TabsContent value="odds" className="space-y-4">
  <ValueAlerts scope="world_cup" />
</TabsContent>

por:

<TabsContent value="odds" className="space-y-4">
  <WorldCupOddsAlerts />
</TabsContent>

Motivo:
- ValueAlerts usa /api/odds/alerts?scope=world_cup, que está focado no alerta geral.
- WorldCupOddsAlerts usa /api/odds/world-cup, que é o endpoint específico de odds reais da Copa.
