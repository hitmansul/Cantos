'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, BarChart3, Beaker, Bell, Brain, BrainCircuit, CalendarDays, CalendarClock, FlaskConical, GraduationCap, History, Landmark, MessageSquareText, Radio, Search, SearchCheck, ShieldCheck, SlidersHorizontal, Sparkles, Star, TimerReset } from 'lucide-react';
import { ptBR } from '@/i18n/pt-BR';

const items = [
  { href: '/', label: 'Ligas e Jogos', icon: BarChart3 },
  { href: '/daily-briefing', label: 'Resumo Diário', icon: CalendarClock },
  { href: '/smart-calendar', label: 'Agenda da IA', icon: CalendarDays },
  { href: '/corner-gpt', label: 'CornerGPT', icon: BrainCircuit },
  { href: '/opportunities', label: ptBR.navigation.opportunities, icon: Sparkles },
  { href: '/notifications', label: 'Alertas', icon: Bell },
  { href: '/watchlist', label: 'Favoritos', icon: Star },
  { href: '/performance-center', label: 'Minha Performance', icon: Activity },
  { href: '/portfolio', label: 'Gestão da Banca', icon: Landmark },
  { href: '/learning-engine', label: 'IA Aprendiz', icon: GraduationCap },
  { href: '/auto-calibration', label: 'Calibração da IA', icon: SlidersHorizontal },
  { href: '/pattern-discovery', label: 'Padrões da IA', icon: SearchCheck },
  { href: '/explainability', label: 'Explicações da IA', icon: MessageSquareText },
  { href: '/odds-intelligence', label: 'Inteligência de Cotações', icon: Search },
  { href: '/live', label: 'Ao Vivo', icon: Radio },
  { href: '/war-room', label: 'Sala de Decisão Ao Vivo', icon: ShieldCheck },
  { href: '/time-machine', label: 'Simulador Temporal', icon: TimerReset },
  { href: '/prediction-lab', label: 'Laboratório de Previsões', icon: Beaker },
  { href: '/ai-performance', label: 'Performance da IA', icon: Activity },
  { href: '/backtest', label: 'Testes Históricos', icon: FlaskConical },
  { href: '/market-replay', label: 'Replay de Mercado', icon: History },
  { href: '/match-intelligence', label: 'Inteligência da Partida', icon: Brain },
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
