import Link from 'next/link';
export function ProductNavigation() {
  return <nav aria-label="Navegação principal" className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-4"><Link href="/" className="font-bold">IA Cantos</Link><div className="flex gap-5 text-sm"><Link href="/">Agente ao vivo</Link><Link href="/live-results">Resultados</Link></div></div></nav>;
}
