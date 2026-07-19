'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Brain, History, Search, Sparkles } from 'lucide-react';

const items = [
  { href: '/', label: 'Estatísticas', icon: BarChart3 },
  { href: '/opportunities', label: 'Oportunidades', icon: Sparkles },
  { href: '/odds-intelligence', label: 'Odds', icon: Search },
  { href: '/market-replay', label: 'Market Replay', icon: History },
  { href: '/match-intelligence', label: 'Match Intelligence', icon: Brain },
];

export function ProductNavigation() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80" aria-label="Navegação principal">
      <div className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-3 py-2 sm:px-5 lg:px-8">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
