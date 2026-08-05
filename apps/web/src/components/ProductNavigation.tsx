'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Beaker,
  Bell,
  Bot,
  Brain,
  BrainCircuit,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Clock3,
  Crosshair,
  FlaskConical,
  GraduationCap,
  History,
  Home,
  Landmark,
  Layers3,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Radio,
  ScanSearch,
  Search,
  SearchCheck,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  TimerReset,
  Trophy,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';
import { ptBR } from '@/i18n/pt-BR';

type NavigationItem = {
  href: string;
  label: string;
  icon: typeof Home;
  description?: string;
};

type NavigationGroup = {
  id: 'inicio' | 'jogos' | 'ia' | 'trading' | 'mais';
  label: string;
  icon: typeof Home;
  items: NavigationItem[];
};

const groups: NavigationGroup[] = [
  {
    id: 'inicio',
    label: 'Início',
    icon: Home,
    items: [
      { href: '/', label: 'Ligas e Jogos', icon: BarChart3, description: 'Visão geral, ligas e partidas' },
      { href: '/daily-briefing', label: 'Resumo Diário', icon: CalendarClock, description: 'Resumo operacional do dia' },
      { href: '/smart-calendar', label: 'Agenda da IA', icon: CalendarDays, description: 'Agenda inteligente de jogos' },
    ],
  },
  {
    id: 'jogos',
    label: 'Jogos',
    icon: Trophy,
    items: [
      { href: '/live', label: 'Ao Vivo', icon: Radio, description: 'Partidas e dados em tempo real' },
      { href: '/live-history', label: 'Histórico e Ritmo', icon: History, description: 'Motor Central, snapshots e leitura IA ao vivo' },
      { href: '/war-room', label: 'Sala de Decisão Ao Vivo', icon: ShieldCheck, description: 'Central operacional ao vivo' },
      { href: '/match-intelligence', label: 'Inteligência da Partida', icon: Brain, description: 'Contexto e leitura completa da partida' },
      { href: '/interval-prediction', label: 'Predição por Intervalo', icon: Clock3, description: 'Projeções por faixa de tempo' },
      { href: '/watchlist', label: 'Favoritos', icon: Star, description: 'Partidas acompanhadas' },
    ],
  },
  {
    id: 'ia',
    label: 'IA',
    icon: Bot,
    items: [
      { href: '/corner-gpt', label: 'CornerGPT', icon: BrainCircuit, description: 'Análise especializada em escanteios' },
      { href: '/ai-assistant', label: 'Assistente da IA', icon: Bot, description: 'Converse com a IA Cantos' },
      { href: '/operational-center', label: 'IA Operacional', icon: Crosshair, description: 'Decisão consolidada e stake' },
      { href: '/explainability', label: 'Explicações da IA', icon: MessageSquareText, description: 'Entenda cada recomendação' },
      { href: '/prediction-lab', label: 'Laboratório de Previsões', icon: Beaker, description: 'Teste cenários e modelos' },
      { href: '/meta-intelligence', label: 'Meta Intelligence', icon: Layers3, description: 'Inteligência sobre os próprios modelos' },
    ],
  },
  {
    id: 'trading',
    label: 'Trading',
    icon: TrendingUp,
    items: [
      { href: '/opportunities', label: ptBR.navigation.opportunities, icon: Sparkles, description: 'Radar de oportunidades' },
      { href: '/notifications', label: 'Alertas', icon: Bell, description: 'Alertas inteligentes' },
      { href: '/performance-center', label: 'Minha Performance', icon: Activity, description: 'Resultados e liquidações' },
      { href: '/portfolio', label: 'Gestão da Banca', icon: Landmark, description: 'Exposição, risco e portfólio' },
      { href: '/bankroll-settings', label: 'Configurações da Banca', icon: WalletCards, description: 'Unidade e limites de risco' },
      { href: '/odds-intelligence', label: 'Inteligência de Cotações', icon: Search, description: 'Leitura das melhores cotações' },
      { href: '/odds-movements', label: 'Movimentos de Odds', icon: ScanSearch, description: 'Mudanças e anomalias do mercado' },
      { href: '/bookmaker-benchmark', label: 'Benchmark de Casas', icon: BarChart3, description: 'Comparação entre casas' },
    ],
  },
  {
    id: 'mais',
    label: 'Mais',
    icon: MoreHorizontal,
    items: [
      { href: '/learning-engine', label: 'IA Aprendiz', icon: GraduationCap, description: 'Aprendizado com os resultados' },
      { href: '/auto-calibration', label: 'Calibração da IA', icon: SlidersHorizontal, description: 'Ajuste automático dos modelos' },
      { href: '/pattern-discovery', label: 'Padrões da IA', icon: SearchCheck, description: 'Descoberta de padrões' },
      { href: '/ai-performance', label: 'Performance da IA', icon: Activity, description: 'Avaliação dos modelos' },
      { href: '/backtest', label: 'Testes Históricos', icon: FlaskConical, description: 'Validação em dados passados' },
      { href: '/market-replay', label: 'Replay de Mercado', icon: History, description: 'Reprodução de cenários anteriores' },
      { href: '/time-machine', label: 'Simulador Temporal', icon: TimerReset, description: 'Simule decisões em outros momentos' },
    ],
  },
];

function itemIsActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function ProductNavigation() {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<NavigationGroup['id'] | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
  }, [pathname]);

  const activeGroup = groups.find((group) => group.items.some((item) => itemIsActive(pathname, item.href)))?.id;

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80" aria-label="Navegação principal">
      <div className="mx-auto w-full max-w-7xl px-3 py-2 sm:px-5 lg:px-8">
        <div className="hidden items-center gap-2 md:flex">
          {groups.map((group) => {
            const Icon = group.icon;
            const active = activeGroup === group.id;
            const open = openGroup === group.id;
            return (
              <div key={group.id} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenGroup(open ? null : group.id)}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors ${active || open ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                  aria-expanded={open}
                >
                  <Icon className="h-4 w-4" />
                  {group.label}
                  <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>

                {open && (
                  <div className="absolute left-0 top-12 z-50 w-[360px] rounded-2xl border bg-popover p-2 shadow-xl">
                    <div className="grid gap-1">
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const itemActive = itemIsActive(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-start gap-3 rounded-xl p-3 transition-colors ${itemActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                          >
                            <div className="mt-0.5 rounded-lg bg-muted p-2"><ItemIcon className="h-4 w-4" /></div>
                            <div className="min-w-0">
                              <div className="font-bold">{item.label}</div>
                              {item.description && <div className="mt-0.5 text-xs text-muted-foreground">{item.description}</div>}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between md:hidden">
          <div className="flex items-center gap-2 font-black"><BrainCircuit className="h-5 w-5 text-primary" /> IA Cantos</div>
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 font-bold"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            Menu
          </button>
        </div>

        {mobileOpen && (
          <div className="mt-3 max-h-[72vh] overflow-y-auto rounded-2xl border bg-card p-2 md:hidden">
            {groups.map((group) => {
              const Icon = group.icon;
              const open = openGroup === group.id;
              return (
                <div key={group.id} className="border-b last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpenGroup(open ? null : group.id)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 font-black"
                  >
                    <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{group.label}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <div className="space-y-1 px-2 pb-3">
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const itemActive = itemIsActive(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${itemActive ? 'bg-primary text-primary-foreground' : 'bg-muted/40'}`}
                          >
                            <ItemIcon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
