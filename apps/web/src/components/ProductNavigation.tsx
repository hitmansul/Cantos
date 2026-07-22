'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, BarChart3, Beaker, Brain, BrainCircuit, FlaskConical, History, Radio, Search, Sparkles } from 'lucide-react';
import { ptBR } from '@/i18n/pt-BR';

const items = [
  { href: '/', label: ptBR.navigation.statistics, icon: BarChart3 },
  { href: '/corner-gpt', label: 'CornerGPT', icon: BrainCircuit },
  { href: '/opportunities', label: ptBR.navigation.opportunities, icon: Sparkles },
  { href: '/odds-intelligence', label: ptBR.navigation.odds, icon: Search },
  { href: '/live', label: ptBR.navigation.live, icon: Radio },
  { href: '/prediction-lab', label: ptBR.navigation.predictionLab, icon: Beaker },
  { href: '/ai-performance', label: 'Performance da IA', icon: Activity },
  { href: '/backtest', label: 'Backtest', icon: FlaskConical },
  { href: '/market-replay', label: ptBR.navigation.marketReplay, icon: History },
  { href: '/match-intelligence', label: ptBR.navigation.matchIntelligence, icon: Brain },
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
