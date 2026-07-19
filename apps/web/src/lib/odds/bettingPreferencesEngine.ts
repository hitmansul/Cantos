export type OddsOfferInput = {
  bookmaker: string;
  odd: number;
};

export type BettingPreferences = {
  favoriteBookmakers?: string[];
  ignoredBookmakers?: string[];
  minimumAbsoluteDifference?: number;
  minimumRelativeDifferencePercent?: number;
  mode?: 'maximum-value' | 'preferred-first' | 'balanced';
};

export type RankedOddsOffer = OddsOfferInput & {
  rank: number;
  preferenceRank: number | null;
  isBestOdd: boolean;
  isFavorite: boolean;
  absoluteDifferenceFromBest: number;
  relativeDifferenceFromBestPercent: number;
};

export type BettingPreferenceDecision = {
  rankedOffers: RankedOddsOffer[];
  bestOffer: RankedOddsOffer | null;
  preferredOffer: RankedOddsOffer | null;
  recommendedOffer: RankedOddsOffer | null;
  nextBestOffers: RankedOddsOffer[];
  shouldSwitchBookmaker: boolean;
  recommendationCode:
    | 'NO_OFFERS'
    | 'BEST_IS_PREFERRED'
    | 'PREFERRED_CLOSE_ENOUGH'
    | 'SWITCH_FOR_VALUE'
    | 'MAXIMUM_VALUE';
  recommendation: string;
};

function normalize(value: string): string {
  return value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function validOffers(offers: OddsOfferInput[], ignoredBookmakers: string[]): OddsOfferInput[] {
  const ignored = new Set(ignoredBookmakers.map(normalize));
  const unique = new Map<string, OddsOfferInput>();

  for (const offer of offers) {
    const odd = Number(offer.odd);
    const key = normalize(offer.bookmaker);
    if (!key || !Number.isFinite(odd) || odd <= 1 || ignored.has(key)) continue;

    const current = unique.get(key);
    if (!current || odd > current.odd) {
      unique.set(key, { bookmaker: offer.bookmaker.trim(), odd: round(odd) });
    }
  }

  return [...unique.values()].sort((a, b) => b.odd - a.odd || a.bookmaker.localeCompare(b.bookmaker, 'pt-BR'));
}

export function rankOddsOffers(
  offers: OddsOfferInput[],
  preferences: BettingPreferences = {}
): BettingPreferenceDecision {
  const favoriteBookmakers = preferences.favoriteBookmakers ?? [];
  const mode = preferences.mode ?? 'balanced';
  const minimumAbsoluteDifference = Math.max(0, Number(preferences.minimumAbsoluteDifference ?? 0.03));
  const minimumRelativeDifferencePercent = Math.max(
    0,
    Number(preferences.minimumRelativeDifferencePercent ?? 2)
  );

  const sorted = validOffers(offers, preferences.ignoredBookmakers ?? []);
  const best = sorted[0] ?? null;
  const favoriteOrder = new Map(favoriteBookmakers.map((bookmaker, index) => [normalize(bookmaker), index + 1]));

  const rankedOffers: RankedOddsOffer[] = sorted.map((offer, index) => {
    const preferenceRank = favoriteOrder.get(normalize(offer.bookmaker)) ?? null;
    const absoluteDifferenceFromBest = best ? round(best.odd - offer.odd) : 0;
    const relativeDifferenceFromBestPercent = best
      ? round(((best.odd - offer.odd) / offer.odd) * 100)
      : 0;

    return {
      ...offer,
      rank: index + 1,
      preferenceRank,
      isBestOdd: index === 0,
      isFavorite: preferenceRank !== null,
      absoluteDifferenceFromBest,
      relativeDifferenceFromBestPercent,
    };
  });

  if (!best) {
    return {
      rankedOffers: [],
      bestOffer: null,
      preferredOffer: null,
      recommendedOffer: null,
      nextBestOffers: [],
      shouldSwitchBookmaker: false,
      recommendationCode: 'NO_OFFERS',
      recommendation: 'Nenhuma odd válida foi encontrada para este mercado.',
    };
  }

  const bestOffer = rankedOffers[0];
  const preferredOffer = rankedOffers
    .filter((offer) => offer.preferenceRank !== null)
    .sort((a, b) => (a.preferenceRank ?? 999) - (b.preferenceRank ?? 999))[0] ?? null;

  if (mode === 'maximum-value' || !preferredOffer) {
    return {
      rankedOffers,
      bestOffer,
      preferredOffer,
      recommendedOffer: bestOffer,
      nextBestOffers: rankedOffers.slice(1, 4),
      shouldSwitchBookmaker: Boolean(preferredOffer && normalize(preferredOffer.bookmaker) !== normalize(bestOffer.bookmaker)),
      recommendationCode: 'MAXIMUM_VALUE',
      recommendation: `${bestOffer.bookmaker} oferece a maior odd disponível (${bestOffer.odd.toFixed(2)}).`,
    };
  }

  if (normalize(bestOffer.bookmaker) === normalize(preferredOffer.bookmaker)) {
    return {
      rankedOffers,
      bestOffer,
      preferredOffer,
      recommendedOffer: bestOffer,
      nextBestOffers: rankedOffers.slice(1, 4),
      shouldSwitchBookmaker: false,
      recommendationCode: 'BEST_IS_PREFERRED',
      recommendation: `${bestOffer.bookmaker} é sua casa preferida e também oferece a melhor odd (${bestOffer.odd.toFixed(2)}).`,
    };
  }

  const absoluteGain = round(bestOffer.odd - preferredOffer.odd);
  const relativeGain = round((absoluteGain / preferredOffer.odd) * 100);
  const differenceIsRelevant =
    absoluteGain >= minimumAbsoluteDifference || relativeGain >= minimumRelativeDifferencePercent;

  if (mode === 'preferred-first' || !differenceIsRelevant) {
    return {
      rankedOffers,
      bestOffer,
      preferredOffer,
      recommendedOffer: preferredOffer,
      nextBestOffers: rankedOffers.filter((offer) => offer.bookmaker !== preferredOffer.bookmaker).slice(0, 3),
      shouldSwitchBookmaker: false,
      recommendationCode: 'PREFERRED_CLOSE_ENOUGH',
      recommendation: `${preferredOffer.bookmaker} paga ${preferredOffer.odd.toFixed(2)}. A diferença para ${bestOffer.bookmaker} é de apenas ${absoluteGain.toFixed(2)} (${relativeGain.toFixed(1)}%), abaixo do limite configurado para trocar de casa.`,
    };
  }

  return {
    rankedOffers,
    bestOffer,
    preferredOffer,
    recommendedOffer: bestOffer,
    nextBestOffers: rankedOffers.slice(1, 4),
    shouldSwitchBookmaker: true,
    recommendationCode: 'SWITCH_FOR_VALUE',
    recommendation: `${bestOffer.bookmaker} paga ${bestOffer.odd.toFixed(2)}, contra ${preferredOffer.odd.toFixed(2)} na sua casa preferida. A vantagem de ${absoluteGain.toFixed(2)} (${relativeGain.toFixed(1)}%) justifica verificar a melhor oferta.`,
  };
}
