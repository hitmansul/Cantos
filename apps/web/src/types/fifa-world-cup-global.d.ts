import type { FifaSquadsData } from '@/lib/fifaWorldCup';

declare global {
  var fifaWorldCupSquadsSnapshot: FifaSquadsData | undefined;
}

export {};
