'use client';

import { useState, useEffect } from 'react';
import { Trophy, Calendar, MapPin, Users, Radio, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

// Copa do Mundo 2026 — 12 grupos, 48 seleções (Sorteio: 5 de dezembro de 2024)
const WC_GROUPS: Record<string, { country: string; flag: string }[]> = {
  A: [
    { country: 'México', flag: '🇲🇽' },
    { country: 'Argentina', flag: '🇦🇷' },
    { country: 'Polônia', flag: '🇵🇱' },
    { country: 'Eswatini', flag: '🇸🇿' },
  ],
  B: [
    { country: 'Holanda', flag: '🇳🇱' },
    { country: 'Portugal', flag: '🇵🇹' },
    { country: 'Irã', flag: '🇮🇷' },
    { country: 'Equador', flag: '🇪🇨' },
  ],
  C: [
    { country: 'Brasil', flag: '🇧🇷' },
    { country: 'Marrocos', flag: '🇲🇦' },
    { country: 'Haiti', flag: '🇭🇹' },
    { country: 'Escócia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  ],
  D: [
    { country: 'França', flag: '🇫🇷' },
    { country: 'Bélgica', flag: '🇧🇪' },
    { country: 'Suíça', flag: '🇨🇭' },
    { country: 'Tailândia', flag: '🇹🇭' },
  ],
  E: [
    { country: 'Alemanha', flag: '🇩🇪' },
    { country: 'Espanha', flag: '🇪🇸' },
    { country: 'Indonésia', flag: '🇮🇩' },
    { country: 'Paraguai', flag: '🇵🇾' },
  ],
  F: [
    { country: 'Portugal', flag: '🇵🇹' },
    { country: 'Camarões', flag: '🇨🇲' },
    { country: 'Cuba', flag: '🇨🇺' },
    { country: 'Eslováquia', flag: '🇸🇰' },
  ],
  G: [
    { country: 'EUA', flag: '🇺🇸' },
    { country: 'Canadá', flag: '🇨🇦' },
    { country: 'Uruguai', flag: '🇺🇾' },
    { country: 'Panamá', flag: '🇵🇦' },
  ],
  H: [
    { country: 'Colômbia', flag: '🇨🇴' },
    { country: 'Holanda', flag: '🇳🇱' },
    { country: 'Gana', flag: '🇬🇭' },
    { country: 'Azerbaijão', flag: '🇦🇿' },
  ],
  I: [
    { country: 'Japão', flag: '🇯🇵' },
    { country: 'Turquia', flag: '🇹🇷' },
    { country: 'Costa do Marfim', flag: '🇨🇮' },
    { country: 'Rep. Tcheca', flag: '🇨🇿' },
  ],
  J: [
    { country: 'Croácia', flag: '🇭🇷' },
    { country: 'Argélia', flag: '🇩🇿' },
    { country: 'Bolívia', flag: '🇧🇴' },
    { country: 'Austrália', flag: '🇦🇺' },
  ],
  K: [
    { country: 'Coreia do Sul', flag: '🇰🇷' },
    { country: 'Polônia', flag: '🇵🇱' },
    { country: 'El Salvador', flag: '🇸🇻' },
    { country: 'Gabão', flag: '🇬🇦' },
  ],
  L: [
    { country: 'Peru', flag: '🇵🇪' },
    { country: 'Costa Rica', flag: '🇨🇷' },
    { country: 'Romênia', flag: '🇷🇴' },
    { country: 'Angola', flag: '🇦🇴' },
  ],
};

// Jogos do Brasil (Grupo C) — informações confirmadas
const BRAZIL_MATCHES = [
  {
    date: '13/06/2026',
    time: '22:00',
    opponent: 'Marrocos',
    flag: '🇲🇦',
    venue: 'SoFi Stadium, Los Angeles',
    group: 'C',
  },
  {
    date: '18/06/2026',
    time: '19:00',
    opponent: 'Haiti',
    flag: '🇭🇹',
    venue: 'MetLife Stadium, Nova York/NJ',
    group: 'C',
  },
  {
    date: '23/06/2026',
    time: '16:00',
    opponent: 'Escócia',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    venue: 'AT&T Stadium, Dallas',
    group: 'C',
  },
];

// Sedes do torneio
const VENUES = [
  { city: 'Nova York/Nova Jersey', stadium: 'MetLife Stadium', cap: '82.500', flag: '🇺🇸' },
  { city: 'Los Angeles', stadium: 'SoFi Stadium', cap: '70.240', flag: '🇺🇸' },
  { city: 'Dallas', stadium: 'AT&T Stadium', cap: '80.000', flag: '🇺🇸' },
  { city: 'San Francisco', stadium: "Levi's Stadium", cap: '68.500', flag: '🇺🇸' },
  { city: 'Miami', stadium: 'Hard Rock Stadium', cap: '64.767', flag: '🇺🇸' },
  { city: 'Atlanta', stadium: 'Mercedes-Benz Stadium', cap: '71.000', flag: '🇺🇸' },
  { city: 'Seattle', stadium: 'Lumen Field', cap: '68.740', flag: '🇺🇸' },
  { city: 'Kansas City', stadium: 'Arrowhead Stadium', cap: '76.416', flag: '🇺🇸' },
  { city: 'Houston', stadium: 'NRG Stadium', cap: '72.220', flag: '🇺🇸' },
  { city: 'Philadelphia', stadium: 'Lincoln Financial Field', cap: '67.594', flag: '🇺🇸' },
  { city: 'Boston', stadium: 'Gillette Stadium', cap: '65.878', flag: '🇺🇸' },
  { city: 'Guadalajara', stadium: 'Estadio Akron', cap: '49.850', flag: '🇲🇽' },
  { city: 'Monterrey', stadium: 'Estadio BBVA', cap: '51.350', flag: '🇲🇽' },
  { city: 'Cidade do México', stadium: 'Estadio Azteca', cap: '87.523', flag: '🇲🇽' },
  { city: 'Toronto', stadium: 'BMO Field', cap: '30.000', flag: '🇨🇦' },
  { city: 'Vancouver', stadium: 'BC Place', cap: '54.320', flag: '🇨🇦' },
];

// Dias até a Copa começar — fixo (Copa começa 11 Jun 2026, hoje é 20 Mai 2026 = 22 dias)
const WC_DAYS_LEFT = 22;

function formatMatchDate(isoString: string): string {
  const d = isoString.split('T')[0];
  const parts = d.split('-');
  const months = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  const month = months[parseInt(parts[1], 10) - 1];
  return `${parseInt(parts[2], 10)} de ${month} de ${parts[0]}`;
}

function formatMatchTime(isoString: string): string {
  const raw = isoString.includes('T') ? isoString.split('T')[1].replace('Z', '') : '';
  if (!raw) return '--:--';
  const [hStr, mStr] = raw.split(':');
  let h = parseInt(hStr, 10) - 3;
  if (h < 0) h += 24;
  return `${String(h).padStart(2, '0')}:${mStr.slice(0, 2)}`;
}

export function WorldCupPage() {
  const [activeGroup, setActiveGroup] = useState<string>('C');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-900 via-emerald-800 to-teal-900 p-6 border border-emerald-500/30">
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">🏆</span>
                <div>
                  <h2 className="text-2xl font-bold text-white">Copa do Mundo 2026</h2>
                  <p className="text-emerald-300 text-sm">EUA 🇺🇸 | México 🇲🇽 | Canadá 🇨🇦</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mt-3">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  <Calendar className="w-3 h-3 mr-1" />
                  11 Jun – 19 Jul 2026
                </Badge>
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                  <Users className="w-3 h-3 mr-1" />
                  48 Seleções
                </Badge>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                  <MapPin className="w-3 h-3 mr-1" />
                  16 Estádios
                </Badge>
              </div>
            </div>
            <div className="flex flex-col items-center bg-black/30 rounded-xl px-6 py-4 border border-emerald-500/30 min-w-[120px]">
              <span className="text-4xl font-black text-emerald-400">{WC_DAYS_LEFT}</span>
              <span className="text-emerald-300 text-sm text-center">dias para o início</span>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-4 right-4 text-[120px]">⚽</div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="grupos" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="grupos" className="gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Grupos</span>
          </TabsTrigger>
          <TabsTrigger value="brasil" className="gap-2">
            <span>🇧🇷</span>
            <span className="hidden sm:inline">Brasil</span>
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-2">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Agenda</span>
          </TabsTrigger>
          <TabsTrigger value="resultados" className="gap-2">
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">Resultados</span>
          </TabsTrigger>
          <TabsTrigger value="sedes" className="gap-2">
            <MapPin className="w-4 h-4" />
            <span className="hidden sm:inline">Sedes</span>
          </TabsTrigger>
        </TabsList>

        {/* Grupos Tab */}
        <TabsContent value="grupos" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {Object.keys(WC_GROUPS).map((group) => (
              <Button
                key={group}
                size="sm"
                variant={activeGroup === group ? 'default' : 'outline'}
                onClick={() => setActiveGroup(group)}
                className={
                  activeGroup === group ? 'bg-emerald-600 hover:bg-emerald-700 border-0' : ''
                }
              >
                Grupo {group}
                {group === 'C' && <span className="ml-1 text-xs">🇧🇷</span>}
              </Button>
            ))}
          </div>

          {activeGroup && (
            <Card className="overflow-hidden border-emerald-500/20">
              <div className="px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Grupo {activeGroup}
                  {activeGroup === 'C' && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                      🇧🇷 Brasil
                    </Badge>
                  )}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">#</th>
                      <th className="px-4 py-2 text-left">Seleção</th>
                      <th className="px-4 py-2 text-center">J</th>
                      <th className="px-4 py-2 text-center">V</th>
                      <th className="px-4 py-2 text-center">E</th>
                      <th className="px-4 py-2 text-center">D</th>
                      <th className="px-4 py-2 text-center">SG</th>
                      <th className="px-4 py-2 text-center font-bold">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {WC_GROUPS[activeGroup].map((team, idx) => (
                      <tr
                        key={team.country}
                        className={`hover:bg-muted/50 transition-colors ${idx < 2 ? 'border-l-2 border-l-emerald-500' : ''}`}
                      >
                        <td className="px-4 py-3 text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{team.flag}</span>
                            <span className="font-medium">{team.country}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">0</td>
                        <td className="px-4 py-3 text-center text-green-400">0</td>
                        <td className="px-4 py-3 text-center text-yellow-400">0</td>
                        <td className="px-4 py-3 text-center text-red-400">0</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">0</td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-400">0</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
                <span className="inline-flex w-3 h-3 bg-emerald-500 rounded-sm"></span>
                <span>Os 2 primeiros de cada grupo avançam às oitavas</span>
              </div>
            </Card>
          )}

          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Todos os Grupos
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {Object.entries(WC_GROUPS).map(([group, teams]) => (
                <Card
                  key={group}
                  className={`p-3 cursor-pointer hover:border-emerald-500/50 transition-colors ${activeGroup === group ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}
                  onClick={() => setActiveGroup(group)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-muted-foreground uppercase">
                      Grupo {group}
                    </span>
                    {group === 'C' && <span className="text-xs">🇧🇷</span>}
                  </div>
                  <div className="space-y-1">
                    {teams.map((t) => (
                      <div key={t.country} className="flex items-center gap-2 text-sm">
                        <span>{t.flag}</span>
                        <span className="truncate">{t.country}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Brasil Tab */}
        <TabsContent value="brasil" className="space-y-4">
          <Card className="overflow-hidden border-green-500/20 bg-gradient-to-br from-green-500/5 to-emerald-500/5">
            <div className="px-4 py-3 bg-green-500/10 border-b border-green-500/20">
              <h3 className="font-bold flex items-center gap-2">
                <span className="text-2xl">🇧🇷</span>
                Brasil — Grupo C
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {WC_GROUPS.C.map((team, idx) => (
                  <div
                    key={team.country}
                    className={`flex items-center gap-3 p-3 rounded-lg ${team.country === 'Brasil' ? 'bg-green-500/20 border border-green-500/30' : 'bg-muted/30'}`}
                  >
                    <span className="text-2xl">{team.flag}</span>
                    <div>
                      <div className="font-medium text-sm">{team.country}</div>
                      <div className="text-xs text-muted-foreground">Pos. {idx + 1}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Jogos do Brasil — Fase de Grupos
                </h4>
                <div className="space-y-3">
                  {BRAZIL_MATCHES.map((match, i) => (
                    <div
                      key={i}
                      className="bg-muted/40 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">{match.date}</div>
                          <div className="font-bold text-sm text-primary">{match.time} BRT</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">🇧🇷</span>
                          <span className="font-semibold">Brasil</span>
                          <span className="text-muted-foreground mx-2 font-bold">vs</span>
                          <span className="font-semibold">{match.opponent}</span>
                          <span className="text-2xl">{match.flag}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {match.venue}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-500" />
              Próximos Jogos — Copa do Mundo 2026 (ao vivo via API)
            </h4>
            <WorldCupMatches autoLoad />
          </Card>
        </TabsContent>

        {/* Agenda Tab — auto-loaded from 365Scores */}
        <TabsContent value="agenda" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Agenda Completa — Copa do Mundo 2026</h3>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                Auto-atualizado
              </Badge>
            </div>
            <WorldCupMatches autoLoad />
          </Card>
        </TabsContent>

        {/* Resultados Tab */}
        <TabsContent value="resultados" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold">Resultados — Copa do Mundo 2026</h3>
            </div>
            <WorldCupMatches autoLoad showResults />
          </Card>
        </TabsContent>

        {/* Sedes Tab */}
        <TabsContent value="sedes" className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {VENUES.map((v) => (
              <Card key={v.city} className="p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{v.flag}</span>
                  <div>
                    <div className="font-semibold">{v.city}</div>
                    <div className="text-sm text-muted-foreground">{v.stadium}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {v.cap} lugares
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Sub-component: fetches Copa do Mundo upcoming/results from 365Scores API — auto-loads
function WorldCupMatches({
  showResults = false,
  autoLoad = false,
}: {
  showResults?: boolean;
  autoLoad?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [matchGroups, setMatchGroups] = useState<
    Array<{
      dateLabel: string;
      matches: Array<{
        id: number;
        homeTeam: string;
        awayTeam: string;
        timeLabel: string;
        homeScore?: number;
        awayScore?: number;
      }>;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = showResults
        ? '/api/365scores/results/copa_do_mundo'
        : '/api/365scores/upcoming/copa_do_mundo';
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Erro ao buscar dados');
      const data = await res.json();
      const rawMatches: Array<{
        id: number;
        startTime: string;
        homeTeam: { id: number; name: string; score?: number };
        awayTeam: { id: number; name: string; score?: number };
      }> = data.matches || [];

      const byDate: Record<string, (typeof matchGroups)[0]> = {};
      for (const m of rawMatches) {
        const dateLabel = formatMatchDate(m.startTime);
        const timeLabel = formatMatchTime(m.startTime);
        if (!byDate[dateLabel]) byDate[dateLabel] = { dateLabel, matches: [] };
        byDate[dateLabel].matches.push({
          id: m.id,
          homeTeam: m.homeTeam.name,
          awayTeam: m.awayTeam.name,
          timeLabel,
          homeScore: m.homeTeam.score,
          awayScore: m.awayTeam.score,
        });
      }
      setMatchGroups(Object.values(byDate));
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Auto-load when requested
  useEffect(() => {
    if (autoLoad) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, showResults]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        <span className="ml-2 text-muted-foreground">Carregando jogos...</span>
      </div>
    );
  }

  if (!loaded && !autoLoad) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-muted-foreground text-sm">
          {showResults
            ? 'Clique para carregar os resultados'
            : 'Clique para carregar os próximos jogos'}{' '}
          da Copa do Mundo 2026
        </p>
        <Button onClick={load} className="bg-emerald-600 hover:bg-emerald-700">
          <Trophy className="w-4 h-4 mr-2" />
          Carregar Jogos
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6 space-y-3">
        <p className="text-red-400 text-sm">{error}</p>
        <Button variant="outline" onClick={load} size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (loaded && matchGroups.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-muted-foreground text-sm">
          {showResults ? 'Nenhum resultado disponível ainda' : 'Nenhum jogo agendado disponível'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          A Copa do Mundo começa em 11 de junho de 2026
        </p>
        <Button variant="outline" onClick={load} size="sm" className="mt-3">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>
    );
  }

  if (!loaded) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-3 h-3 mr-1" />
          Atualizar
        </Button>
      </div>
      {matchGroups.map((group) => (
        <div key={group.dateLabel} className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border pb-1">
            {group.dateLabel}
          </div>
          <div className="space-y-2">
            {group.matches.map((match) => {
              const hasScore = showResults && match.homeScore !== undefined;
              return (
                <div
                  key={match.id}
                  className="bg-muted/40 rounded-lg px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex-1 text-right pr-3">
                    <span className="font-semibold text-sm">{match.homeTeam}</span>
                  </div>
                  <div className="flex flex-col items-center min-w-[80px]">
                    <span className="text-xs text-muted-foreground">{match.timeLabel}</span>
                    {hasScore ? (
                      <span className="font-bold text-lg">
                        {match.homeScore} – {match.awayScore}
                      </span>
                    ) : (
                      <span className="text-emerald-500 font-bold text-sm">vs</span>
                    )}
                  </div>
                  <div className="flex-1 text-left pl-3">
                    <span className="font-semibold text-sm">{match.awayTeam}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
