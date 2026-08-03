'use client';

import { useEffect } from 'react';

const LIVE_CARD_SELECTOR = '[role="button"][tabindex="0"]';

function isLiveMatchCard(element: HTMLElement) {
  const text = element.innerText || '';
  return text.includes('AO VIVO') && (text.includes('Escanteios') || text.includes('Previsão de Acréscimo'));
}

export function LiveMatchScrollStabilizer() {
  useEffect(() => {
    let clickedCard: HTMLElement | null = null;
    let clickedTop = 0;
    let adjustmentToken = 0;

    const captureCard = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const candidate = target.closest<HTMLElement>(LIVE_CARD_SELECTOR);
      if (!candidate || !isLiveMatchCard(candidate)) return;

      clickedCard = candidate;
      clickedTop = candidate.getBoundingClientRect().top;
      adjustmentToken += 1;
      const token = adjustmentToken;

      const stabilize = () => {
        if (token !== adjustmentToken || !clickedCard || !document.contains(clickedCard)) return;

        const currentTop = clickedCard.getBoundingClientRect().top;
        const difference = currentTop - clickedTop;

        if (Math.abs(difference) > 1) {
          window.scrollBy({ top: difference, behavior: 'auto' });
        }
      };

      // A troca fecha o painel anterior e abre o novo em renderizações sucessivas.
      // Reposicionamos após cada etapa para manter o card clicado no mesmo ponto da tela.
      window.requestAnimationFrame(() => {
        stabilize();
        window.requestAnimationFrame(() => {
          stabilize();
          window.setTimeout(stabilize, 80);
          window.setTimeout(stabilize, 220);
          window.setTimeout(stabilize, 500);
        });
      });
    };

    document.addEventListener('pointerdown', captureCard, true);
    return () => {
      adjustmentToken += 1;
      document.removeEventListener('pointerdown', captureCard, true);
    };
  }, []);

  return null;
}
