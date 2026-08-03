'use client';

import { useEffect } from 'react';

export default function LiveHistoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('live-history runtime error', error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
        <h1 className="text-2xl font-black text-red-300">Não foi possível abrir o histórico ao vivo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A tela encontrou um dado incompatível durante a montagem. Tente novamente após a atualização.
        </p>
        <button
          onClick={reset}
          className="mt-5 rounded-xl border border-border bg-background px-4 py-3 font-semibold"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
