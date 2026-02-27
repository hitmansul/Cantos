import { useState, useMemo, useEffect } from "react";
import { CornerUpRight, Calendar, TrendingUp, BarChart3, Info, ArrowLeft, Globe, Loader2, RefreshCw, Radio, Target, Zap, Trophy } from "lucide-react";
import { Card } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/react-app/components/ui/tabs";
import { Slider } from "@/react-app/components/ui/slider";
import { Button } from "@/react-app/components/ui/button";
import { TeamSelector } from "@/react-app/components/TeamSelector";
import { TeamStatsCard } from "@/react-app/components/TeamStatsCard";
import { HeadToHeadCard } from "@/react-app/components/HeadToHeadCard";
import { NextMatchCard } from "@/react-app/components/NextMatchCard";
import { LeagueSelector } from "@/react-app/components/LeagueSelector";
import { LeagueStatsTable } from "@/react-app/components/LeagueStatsTable";
import { InternationalTeamStatsCard } from "@/react-app/components/InternationalTeamStatsCard";
import { InternationalH2HCard } from "@/react-app/components/InternationalH2HCard";
import { LiveCornerStats } from "@/react-app/components/LiveCornerStats";
import { MatchPrediction } from "@/react-app/components/MatchPrediction";
import { ValueAlerts } from "@/react-app/components/ValueAlerts";
import { SofascoreFixtures } from "@/react-app/components/SofascoreFixtures";
import { useApiFootballFixtures } from "@/react-app/hooks/useApiFootball";
import { useLeagueStats, useH2H } from "@/react-app/hooks/useCornerStats";
import type { LeagueConfig, TeamCornerStats } from "@/shared/footballDataTypes";
import {
  type DetailedTeamStats,
  getHeadToHead,
  getNextMatchForTeam,
  findTeamByName,
} from "@/react-app/data/teamCornerStats";

type ViewMode = "brazilian" | "international" | "realtime";

export default function HomePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("brazilian");
  const [selectedTeam, setSelectedTeam] = useState<DetailedTeamStats | null>(null);
  const [compareTeam, setCompareTeam] = useState<DetailedTeamStats | null>(null);
  const [lastNGames, setLastNGames] = useState(5);
  
  // International league state
  const [selectedLeague, setSelectedLeague] = useState<LeagueConfig | null>(null);
  const [selectedIntlTeam, setSelectedIntlTeam] = useState<TeamCornerStats | null>(null);
  const [compareIntlTeam, setCompareIntlTeam] = useState<TeamCornerStats | null>(null);
  const [intlTab, setIntlTab] = useState<"stats" | "h2h">("stats");
  const { stats: leagueStats, loading: leagueLoading, error: leagueError, fetchStats } = useLeagueStats();
  const { h2h: intlH2H, loading: h2hLoading, fetchH2H, clearH2H } = useH2H();

  // Dynamic upcoming fixtures (Odds API) for Brazilian leagues
  // Próximos jogos (sem depender do The Odds API): API-Football
  // 71 = Brasileirão Série A | 72 = Brasileirão Série B (IDs da API-Football)
  const fixturesA = useApiFootballFixtures({ league: 71, mode: "upcoming", next: 50, refreshMs: 60_000 });
  const fixturesB = useApiFootballFixtures({ league: 72, mode: "upcoming", next: 50, refreshMs: 60_000 });

  const upcomingBrazilFixtures = useMemo(() => {
    const a = (fixturesA.data?.fixtures || []).map((f) => ({
      id: String(f.id),
      sportKey: "soccer_brazil_campeonato",
      sportTitle: f.league?.name || "Brasileirão Série A",
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
      commenceTime: f.commenceTime,
    }));
    const b = (fixturesB.data?.fixtures || []).map((f) => ({
      id: String(f.id),
      sportKey: "soccer_brazil_serie_b",
      sportTitle: f.league?.name || "Brasileirão Série B",
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
      commenceTime: f.commenceTime,
    }));
    const combined = [...a, ...b];
    return combined
      .filter((f) => !!f?.commenceTime)
      .sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime())
      .slice(0, 20);
  }, [fixturesA.data, fixturesB.data]);

  // Fetch league stats when league changes
  useEffect(() => {
    if (selectedLeague && selectedLeague.id !== "BR1") {
      fetchStats(selectedLeague.id);
      // Clear H2H when changing leagues
      clearH2H();
    }
  }, [selectedLeague, fetchStats, clearH2H]);

  // Fetch H2H when both international teams are selected
  useEffect(() => {
    if (selectedLeague && selectedIntlTeam && compareIntlTeam) {
      fetchH2H(selectedLeague.id, selectedIntlTeam.team, compareIntlTeam.team);
    } else {
      clearH2H();
    }
  }, [selectedLeague, selectedIntlTeam, compareIntlTeam, fetchH2H, clearH2H]);

  // Get H2H data if both teams selected
  const h2hData = useMemo(() => {
    if (!selectedTeam || !compareTeam) return null;
    return getHeadToHead(selectedTeam.team, compareTeam.team);
  }, [selectedTeam, compareTeam]);

  // Get next match for selected team
  const nextMatch = useMemo(() => {
    if (!selectedTeam) return null;
    return getNextMatchForTeam(selectedTeam.team);
  }, [selectedTeam]);

  // Handle match selection from upcoming matches
  const handleMatchSelect = (homeTeam: string, awayTeam: string) => {
    const home = findTeamByName(homeTeam);
    const away = findTeamByName(awayTeam);
    if (home) setSelectedTeam(home);
    if (away) setCompareTeam(away);
  };

  // Clear selection and go back to home
  const handleGoBack = () => {
    setSelectedTeam(null);
    setCompareTeam(null);
  };

  // Handle international team selection
  const handleInternationalTeamSelect = (team: TeamCornerStats) => {
    if (!selectedIntlTeam) {
      setSelectedIntlTeam(team);
    } else if (selectedIntlTeam.team === team.team) {
      // Clicking same team deselects it
      setSelectedIntlTeam(null);
      setCompareIntlTeam(null);
    } else {
      setCompareIntlTeam(team);
    }
  };

  // Clear international team selection
  const handleIntlGoBack = () => {
    setSelectedIntlTeam(null);
    setCompareIntlTeam(null);
    setIntlTab("stats");
    clearH2H();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <CornerUpRight className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">CornerStats</h1>
                <p className="text-xs text-muted-foreground">
                  Estatísticas de escanteios mundiais
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              <BarChart3 className="w-3 h-3 mr-1" />
              Temporada 2025/26
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* View Mode Selector */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={viewMode === "brazilian" ? "default" : "outline"}
            onClick={() => setViewMode("brazilian")}
            className="flex-1 sm:flex-none"
          >
            <span className="mr-2">🇧🇷</span>
            Brasileirão
          </Button>
          <Button
            variant={viewMode === "international" ? "default" : "outline"}
            onClick={() => setViewMode("international")}
            className="flex-1 sm:flex-none"
          >
            <Globe className="w-4 h-4 mr-2" />
            Ligas Internacionais
          </Button>
          <Button
            variant={viewMode === "realtime" ? "default" : "outline"}
            onClick={() => setViewMode("realtime")}
            className="flex-1 sm:flex-none bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white border-0"
          >
            <Radio className="w-4 h-4 mr-2" />
            Tempo Real
          </Button>
        </div>

        {viewMode === "realtime" ? (
          /* Real-time Mode - Sofascore + Corner-Stats.com */
          <div className="space-y-6">
            <Tabs defaultValue="sofascore" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sofascore" className="gap-2">
                  <Trophy className="w-4 h-4" />
                  <span>Jogos do Sofascore</span>
                </TabsTrigger>
                <TabsTrigger value="cornerstats" className="gap-2">
                  <BarChart3 className="w-4 h-4" />
                  <span>Corner-Stats.com</span>
                </TabsTrigger>
              </TabsList>

              {/* Sofascore Tab - Real fixtures */}
              <TabsContent value="sofascore" className="space-y-4">
                <div className="grid lg:grid-cols-2 gap-6">
                  <Card className="p-4">
                    <SofascoreFixtures league="brasileirao_a" />
                  </Card>
                  <Card className="p-4">
                    <SofascoreFixtures league="brasileirao_b" />
                  </Card>
                </div>

                {/* Data Source Info */}
                <Card className="p-4 bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-blue-500/20">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div>
                      <p className="font-medium">Dados via Sofascore (RapidAPI)</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Jogos e resultados em tempo real do Brasileirão Série A e B.
                        Os dados são atualizados automaticamente a cada vez que você acessa esta página.
                      </p>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Corner-Stats.com Tab */}
              <TabsContent value="cornerstats" className="space-y-4">
                <LiveCornerStats />
                
                {/* Data Source Info */}
                <Card className="p-4 bg-gradient-to-r from-green-500/5 to-emerald-500/5 border-green-500/20">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-green-400 mt-0.5" />
                    <div>
                      <p className="font-medium">Dados em tempo real</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Estatísticas extraídas diretamente do{" "}
                        <a 
                          href="https://www.corner-stats.com" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-green-400 hover:underline"
                        >
                          Corner-Stats.com
                        </a>
                        . Clique em "Buscar Dados" para obter estatísticas atualizadas do Brasileirão e outras competições brasileiras.
                      </p>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : viewMode === "brazilian" ? (
          <>
            {/* Brazilian Mode - Team Selectors */}
            <Card className="p-5">
              <div className="grid md:grid-cols-2 gap-4">
                <TeamSelector
                  selectedTeam={selectedTeam}
                  onSelect={setSelectedTeam}
                  label="Time principal"
                  placeholder="Buscar time..."
                />
                <TeamSelector
                  selectedTeam={compareTeam}
                  onSelect={setCompareTeam}
                  label="Comparar com (oponente)"
                  placeholder="Selecione para ver H2H..."
                />
              </div>
              
              {/* Last N Games Filter */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Média dos últimos jogos
                  </label>
                  <Badge variant="outline">{lastNGames} jogos</Badge>
                </div>
                <Slider
                  value={[lastNGames]}
                  onValueChange={([val]) => setLastNGames(val)}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />
              </div>
            </Card>

            {/* Main Content */}
            {selectedTeam ? (
              <div className="space-y-4">
                {/* Back Button */}
                <Button 
                  variant="ghost" 
                  onClick={handleGoBack}
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para próximos jogos
                </Button>

                <Tabs defaultValue="stats" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="stats" className="gap-2">
                      <BarChart3 className="w-4 h-4" />
                      <span className="hidden sm:inline">Estatísticas</span>
                    </TabsTrigger>
                    <TabsTrigger value="h2h" className="gap-2" disabled={!compareTeam}>
                      <TrendingUp className="w-4 h-4" />
                      <span className="hidden sm:inline">Confronto</span>
                    </TabsTrigger>
                    <TabsTrigger value="next" className="gap-2">
                      <Calendar className="w-4 h-4" />
                      <span className="hidden sm:inline">Próximos</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Stats Tab */}
                  <TabsContent value="stats" className="space-y-4">
                    <div className={compareTeam ? "grid lg:grid-cols-2 gap-4" : ""}>
                      <TeamStatsCard team={selectedTeam} lastNGames={lastNGames} />
                      {compareTeam && (
                        <TeamStatsCard team={compareTeam} lastNGames={lastNGames} />
                      )}
                    </div>
                  </TabsContent>

                  {/* H2H Tab */}
                  <TabsContent value="h2h">
                    {h2hData ? (
                      <HeadToHeadCard h2h={h2hData} />
                    ) : compareTeam ? (
                      <Card className="p-8 text-center">
                        <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">Sem dados de confronto direto</p>
                        <p className="text-sm text-muted-foreground">
                          Não encontramos histórico entre {selectedTeam.team} e {compareTeam.team}
                        </p>
                      </Card>
                    ) : (
                      <Card className="p-8 text-center">
                        <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">Selecione um oponente</p>
                        <p className="text-sm text-muted-foreground">
                          Escolha um segundo time para ver o confronto direto
                        </p>
                      </Card>
                    )}
                  </TabsContent>

                  {/* Next Matches Tab */}
                  <TabsContent value="next" className="space-y-4">
                    {nextMatch ? (
                      <div className="space-y-6">
                        <h3 className="text-lg font-medium flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-primary" />
                          Próximo jogo de {selectedTeam.team}
                        </h3>
                        <NextMatchCard 
                          match={nextMatch} 
                          onSelectMatch={handleMatchSelect}
                        />
                        
                        {/* Detailed Prediction */}
                        <div className="pt-4 border-t border-border">
                          <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                            <Target className="w-5 h-5 text-primary" />
                            Análise Detalhada
                          </h3>
                          <MatchPrediction match={nextMatch} />
                        </div>
                      </div>
                    ) : (
                      <Card className="p-8 text-center">
                        <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">Sem jogos agendados</p>
                        <p className="text-sm text-muted-foreground">
                          Não há jogos previstos para {selectedTeam.team}
                        </p>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              /* Empty State - Tabs for Upcoming Matches and Value Alerts */
              <Tabs defaultValue="upcoming" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upcoming" className="gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Próximos Jogos</span>
                  </TabsTrigger>
                  <TabsTrigger value="value" className="gap-2">
                    <Zap className="w-4 h-4" />
                    <span>Alertas de Valor</span>
                  </TabsTrigger>
                </TabsList>

                {/* Upcoming Matches Tab */}
                <TabsContent value="upcoming" className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                      Atualiza automaticamente a cada 60s (aba visível)
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        fixturesA.refetch();
                        fixturesB.refetch();
                      }}
                      className="gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Atualizar
                    </Button>
                  </div>

                  {/* Upcoming Matches Grid */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(fixturesA.loading || fixturesB.loading) && (
                      <Card className="p-6 sm:col-span-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Carregando jogos...
                        </div>
                      </Card>
                    )}

                    {(!fixturesA.loading && !fixturesB.loading) && (fixturesA.error || fixturesB.error) && (
                      <Card className="p-6 sm:col-span-2 border-red-500/30 bg-red-500/5">
                        <p className="font-medium text-red-400">Erro ao carregar jogos</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {fixturesA.error || fixturesB.error}
                        </p>
                      </Card>
                    )}

                    {(!fixturesA.loading && !fixturesB.loading) && !fixturesA.error && !fixturesB.error && upcomingBrazilFixtures.length === 0 && (
                      <Card className="p-6 sm:col-span-2">
                        <p className="font-medium">Nenhum jogo futuro encontrado</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Verifique se sua chave APIFOOTBALL_KEY está preenchida no arquivo .dev.vars
                        </p>
                      </Card>
                    )}

                    {upcomingBrazilFixtures.map((match, idx) => (
                      <Card 
                        key={idx}
                        className="p-4 hover:bg-accent/50 transition-colors cursor-pointer border-l-4 border-l-primary/50"
                        onClick={() => handleMatchSelect(match.homeTeam, match.awayTeam)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge
                            variant={match.sportKey === "soccer_brazil_campeonato" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {match.sportKey === "soccer_brazil_campeonato" ? "Série A" : "Série B"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(match.commenceTime).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{match.homeTeam}</p>
                            <p className="text-muted-foreground text-sm">{match.awayTeam}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Horário</p>
                            <p className="font-bold text-primary">
                              {new Date(match.commenceTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Info Card */}
                  <Card className="p-4 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">Como usar</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Selecione um time acima para ver estatísticas detalhadas de escanteios: 
                        média geral, média em casa/fora, média por situação (ganhando/perdendo/empatando), 
                        últimos jogos e confronto direto.
                      </p>
                    </div>
                    </div>
                  </Card>
                </TabsContent>

                {/* Value Alerts Tab */}
                <TabsContent value="value" className="space-y-4">
                  <ValueAlerts />
                </TabsContent>
              </Tabs>
            )}
          </>
        ) : (
          /* International Mode */
          <div className="space-y-6">
            {/* League Selector */}
            <Card className="p-5">
              <div className="space-y-4">
                <label className="text-sm font-medium text-muted-foreground">
                  Selecione uma liga
                </label>
                <LeagueSelector 
                  selectedLeague={selectedLeague}
                  onSelect={setSelectedLeague}
                />
              </div>
            </Card>

            {/* League Stats */}
            {selectedLeague && selectedLeague.id !== "BR1" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{selectedLeague.flag}</span>
                    <div>
                      <h2 className="text-lg font-medium">{selectedLeague.name}</h2>
                      <p className="text-sm text-muted-foreground">{selectedLeague.country}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {leagueStats && (
                      <Badge variant="outline">
                        {leagueStats.matchesAnalyzed} jogos analisados
                      </Badge>
                    )}
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => fetchStats(selectedLeague.id)}
                      disabled={leagueLoading}
                    >
                      <RefreshCw className={`w-4 h-4 ${leagueLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>

                {leagueLoading ? (
                  <Card className="p-12 text-center">
                    <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                    <p className="text-lg font-medium">Carregando estatísticas...</p>
                    <p className="text-sm text-muted-foreground">
                      Buscando dados do Football-Data.co.uk
                    </p>
                  </Card>
                ) : leagueError ? (
                  <Card className="p-8 text-center">
                    <Info className="w-12 h-12 text-destructive mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Erro ao carregar dados</p>
                    <p className="text-sm text-muted-foreground">{leagueError}</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => fetchStats(selectedLeague.id)}
                    >
                      Tentar novamente
                    </Button>
                  </Card>
                ) : leagueStats ? (
                  <>
                    {/* Team Detail View */}
                    {selectedIntlTeam && (
                      <div className="space-y-4">
                        <Button 
                          variant="ghost" 
                          onClick={handleIntlGoBack}
                          className="gap-2 text-muted-foreground hover:text-foreground"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Voltar para lista de times
                        </Button>
                        
                        {/* Team Selection Info */}
                        <Card className="p-4 bg-muted/30">
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Time selecionado:</span>
                              <Badge variant="default">{selectedIntlTeam.team}</Badge>
                            </div>
                            {compareIntlTeam ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Comparando com:</span>
                                <Badge variant="secondary">{compareIntlTeam.team}</Badge>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setCompareIntlTeam(null)}
                                  className="h-6 px-2"
                                >
                                  ×
                                </Button>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground italic">
                                Clique em outro time na tabela para comparar e ver H2H
                              </span>
                            )}
                          </div>
                        </Card>

                        {/* Tabs for Stats and H2H */}
                        <Tabs value={intlTab} onValueChange={(v) => setIntlTab(v as "stats" | "h2h")} className="space-y-4">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="stats" className="gap-2">
                              <BarChart3 className="w-4 h-4" />
                              <span>Estatísticas</span>
                            </TabsTrigger>
                            <TabsTrigger value="h2h" className="gap-2" disabled={!compareIntlTeam}>
                              <TrendingUp className="w-4 h-4" />
                              <span>Confronto Direto</span>
                            </TabsTrigger>
                          </TabsList>

                          {/* Stats Tab */}
                          <TabsContent value="stats" className="space-y-4">
                            <div className={compareIntlTeam ? "grid lg:grid-cols-2 gap-4" : ""}>
                              <InternationalTeamStatsCard team={selectedIntlTeam} />
                              {compareIntlTeam && (
                                <InternationalTeamStatsCard team={compareIntlTeam} />
                              )}
                            </div>
                          </TabsContent>

                          {/* H2H Tab */}
                          <TabsContent value="h2h">
                            {h2hLoading ? (
                              <Card className="p-12 text-center">
                                <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                                <p className="text-lg font-medium">Carregando confronto direto...</p>
                                <p className="text-sm text-muted-foreground">
                                  Buscando histórico entre {selectedIntlTeam.team} e {compareIntlTeam?.team}
                                </p>
                              </Card>
                            ) : intlH2H ? (
                              <InternationalH2HCard h2h={intlH2H} />
                            ) : compareIntlTeam ? (
                              <Card className="p-8 text-center">
                                <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">Sem dados de confronto direto</p>
                                <p className="text-sm text-muted-foreground">
                                  Não encontramos histórico entre {selectedIntlTeam.team} e {compareIntlTeam.team} nesta temporada
                                </p>
                              </Card>
                            ) : (
                              <Card className="p-8 text-center">
                                <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">Selecione um oponente</p>
                                <p className="text-sm text-muted-foreground">
                                  Escolha um segundo time para ver o confronto direto
                                </p>
                              </Card>
                            )}
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}
                    
                    {/* League Table */}
                    <div className={selectedIntlTeam ? "mt-6 pt-6 border-t border-border" : ""}>
                      {selectedIntlTeam && (
                        <h3 className="text-lg font-medium mb-4">Todos os times da liga</h3>
                      )}
                      <LeagueStatsTable 
                        teams={leagueStats.teams}
                        onSelectTeam={handleInternationalTeamSelect}
                        selectedTeam={selectedIntlTeam?.team}
                        compareTeam={compareIntlTeam?.team}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            ) : selectedLeague?.id === "BR1" ? (
              <Card className="p-8 text-center">
                <span className="text-5xl mb-4 block">🇧🇷</span>
                <p className="text-lg font-medium">Brasileirão Série A</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Use a aba "Brasileirão" para ver estatísticas detalhadas dos times brasileiros
                </p>
                <Button 
                  className="mt-4"
                  onClick={() => setViewMode("brazilian")}
                >
                  Ir para Brasileirão
                </Button>
              </Card>
            ) : (
              <Card className="p-8 text-center">
                <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Selecione uma liga</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Escolha uma liga europeia para ver estatísticas detalhadas de escanteios
                </p>
              </Card>
            )}

            {/* Data Source Info */}
            <Card className="p-4 bg-gradient-to-r from-blue-500/5 to-emerald-500/5 border-blue-500/20">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <p className="font-medium">Fonte dos dados</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Dados de ligas europeias fornecidos por{" "}
                    <a 
                      href="https://www.football-data.co.uk" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      Football-Data.co.uk
                    </a>
                    . Atualizados semanalmente.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
