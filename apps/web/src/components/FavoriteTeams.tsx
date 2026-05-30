"use client";

import { useState, useMemo } from "react";
import { Heart, Search, Bell, X, Calendar, Clock, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  upcomingMatches,
  teamStats,
  findTeamByName,
  type DetailedTeamStats,
} from "@/data/teamCornerStats";

const STORAGE_KEY = "cornerstats_favorite_teams";

interface FavoriteTeam {
  name: string;
  addedAt: number;
}

function loadFavorites(): FavoriteTeam[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveFavorites(favorites: FavoriteTeam[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
}

export function useFavoriteTeams() {
  const [favorites, setFavorites] = useState<FavoriteTeam[]>(loadFavorites);

  const addFavorite = (teamName: string) => {
    const newFavorites = [...favorites, { name: teamName, addedAt: Date.now() }];
    setFavorites(newFavorites);
    saveFavorites(newFavorites);
  };

  const removeFavorite = (teamName: string) => {
    const newFavorites = favorites.filter(f => f.name !== teamName);
    setFavorites(newFavorites);
    saveFavorites(newFavorites);
  };

  const isFavorite = (teamName: string) => {
    return favorites.some(f => f.name === teamName);
  };

  const toggleFavorite = (teamName: string) => {
    if (isFavorite(teamName)) {
      removeFavorite(teamName);
    } else {
      addFavorite(teamName);
    }
  };

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
  };
}

interface FavoriteTeamAlertsProps {
  onTeamClick?: (teamName: string) => void;
}

export function FavoriteTeamAlerts({ onTeamClick }: FavoriteTeamAlertsProps) {
  const { favorites, removeFavorite, addFavorite, isFavorite } = useFavoriteTeams();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Get all teams for search
  const allTeamNames = useMemo(() => {
    return teamStats.map(t => t.team).sort();
  }, []);

  // Filter teams based on search
  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return allTeamNames.filter(name => 
      name.toLowerCase().includes(query) && !isFavorite(name)
    ).slice(0, 8);
  }, [searchQuery, allTeamNames, isFavorite]);

  // Get upcoming matches for favorite teams
  const favoriteMatches = useMemo(() => {
    const favoriteNames = new Set(favorites.map(f => f.name));
    return upcomingMatches
      .filter(match => 
        favoriteNames.has(match.homeTeam) || favoriteNames.has(match.awayTeam)
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [favorites]);

  // Get team stats for display
  const getTeamStats = (teamName: string): DetailedTeamStats | null => {
    return findTeamByName(teamName) || null;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return { label: "Hoje", color: "bg-red-500/20 text-red-400 border-red-500/30" };
    if (diffDays === 1) return { label: "Amanhã", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
    if (diffDays <= 7) return { 
      label: date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""), 
      color: "bg-blue-500/20 text-blue-400 border-blue-500/30" 
    };
    return { 
      label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }), 
      color: "bg-muted text-muted-foreground" 
    };
  };

  if (favorites.length === 0 && !showSearch) {
    return (
      <Card className="p-8 text-center border-dashed">
        <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhum time favorito</p>
        <p className="text-sm text-muted-foreground mt-2 mb-4">
          Adicione seus times favoritos para receber alertas quando eles jogarem
        </p>
        <Button onClick={() => setShowSearch(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Adicionar Time
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <Card className="p-4 bg-gradient-to-r from-rose-500/10 to-pink-500/10 border-rose-500/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
              <Heart className="w-5 h-5 text-rose-400 fill-rose-400" />
            </div>
            <div>
              <p className="font-medium">Times Favoritos</p>
              <p className="text-sm text-muted-foreground">
                {favorites.length} time{favorites.length !== 1 ? "s" : ""} • {favoriteMatches.length} jogo{favoriteMatches.length !== 1 ? "s" : ""} próximo{favoriteMatches.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Button 
            variant={showSearch ? "default" : "outline"} 
            size="sm" 
            onClick={() => setShowSearch(!showSearch)}
            className="gap-2"
          >
            {showSearch ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showSearch ? "Fechar" : "Adicionar"}
          </Button>
        </div>
      </Card>

      {/* Search Panel */}
      {showSearch && (
        <Card className="p-4">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar time..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
            {filteredTeams.length > 0 && (
              <div className="grid gap-2">
                {filteredTeams.map((teamName) => {
                  const stats = getTeamStats(teamName);
                  return (
                    <button
                      key={teamName}
                      onClick={() => {
                        addFavorite(teamName);
                        setSearchQuery("");
                      }}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
                    >
                      <div>
                        <p className="font-medium">{teamName}</p>
                        {stats && (
                          <p className="text-xs text-muted-foreground">
                            Média: {stats.avgCornersFor.toFixed(1)} a favor • {stats.avgCornersAgainst.toFixed(1)} contra
                          </p>
                        )}
                      </div>
                      <Plus className="w-5 h-5 text-primary" />
                    </button>
                  );
                })}
              </div>
            )}
            {searchQuery && filteredTeams.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum time encontrado para "{searchQuery}"
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Favorite Teams List */}
      {favorites.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {favorites.map((fav) => {
            const hasUpcoming = favoriteMatches.some(
              m => m.homeTeam === fav.name || m.awayTeam === fav.name
            );
            return (
              <Badge
                key={fav.name}
                variant="outline"
                className={`px-3 py-1.5 gap-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors ${
                  hasUpcoming ? "border-rose-500/50 bg-rose-500/10" : ""
                }`}
                onClick={() => onTeamClick?.(fav.name)}
              >
                <Heart className="w-3 h-3 fill-rose-400 text-rose-400" />
                {fav.name}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFavorite(fav.name);
                  }}
                  className="ml-1 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Upcoming Matches for Favorites */}
      {favoriteMatches.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Bell className="w-5 h-5 text-rose-400" />
            Próximos Jogos dos Favoritos
          </h3>
          <div className="grid gap-3">
            {favoriteMatches.map((match, index) => {
              const dateInfo = formatDate(match.date);
              const homeStats = getTeamStats(match.homeTeam);
              const awayStats = getTeamStats(match.awayTeam);
              const isHomeFavorite = isFavorite(match.homeTeam);
              const isAwayFavorite = isFavorite(match.awayTeam);
              const expectedCorners = (homeStats?.avgCornersFor || 4.5) + (awayStats?.avgCornersFor || 4.5);

              return (
                <Card 
                  key={`${match.homeTeam}-${match.awayTeam}-${index}`}
                  className="overflow-hidden border-rose-500/20 hover:border-rose-500/40 transition-colors cursor-pointer"
                  onClick={() => onTeamClick?.(isHomeFavorite ? match.homeTeam : match.awayTeam)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className="text-xs">
                        {match.competition}
                      </Badge>
                      <Badge className={dateInfo.color}>
                        {dateInfo.label}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 text-center">
                        <div className={`flex items-center justify-center gap-2 ${isHomeFavorite ? "text-rose-400" : ""}`}>
                          {isHomeFavorite && <Heart className="w-4 h-4 fill-rose-400" />}
                          <p className={`font-semibold ${isHomeFavorite ? "text-rose-400" : ""}`}>
                            {match.homeTeam}
                          </p>
                        </div>
                        {homeStats && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {homeStats.avgCornersHome.toFixed(1)} em casa
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-center px-4">
                        <span className="text-xs text-muted-foreground">vs</span>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {new Date(match.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 text-center">
                        <div className={`flex items-center justify-center gap-2 ${isAwayFavorite ? "text-rose-400" : ""}`}>
                          <p className={`font-semibold ${isAwayFavorite ? "text-rose-400" : ""}`}>
                            {match.awayTeam}
                          </p>
                          {isAwayFavorite && <Heart className="w-4 h-4 fill-rose-400" />}
                        </div>
                        {awayStats && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {awayStats.avgCornersAway.toFixed(1)} fora
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Corner Prediction */}
                    <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Previsão:</span>
                        <Badge variant="secondary" className="font-mono">
                          {expectedCorners.toFixed(1)} escanteios
                        </Badge>
                      </div>
                      {expectedCorners > 10 && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          Alto
                        </Badge>
                      )}
                      {expectedCorners < 8 && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                          Baixo
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* No Upcoming Matches */}
      {favorites.length > 0 && favoriteMatches.length === 0 && (
        <Card className="p-6 text-center border-dashed">
          <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="font-medium">Nenhum jogo agendado</p>
          <p className="text-sm text-muted-foreground mt-1">
            Seus times favoritos não têm jogos nas próximas rodadas
          </p>
        </Card>
      )}
    </div>
  );
}

// Heart button to add/remove favorites (can be used in other components)
interface FavoriteButtonProps {
  teamName: string;
  size?: "sm" | "md" | "lg";
}

export function FavoriteButton({ teamName, size = "md" }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavoriteTeams();
  const favorite = isFavorite(teamName);

  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite(teamName);
      }}
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center transition-all ${
        favorite 
          ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30" 
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-rose-400"
      }`}
      title={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
    >
      <Heart className={`${iconSizes[size]} ${favorite ? "fill-current" : ""}`} />
    </button>
  );
}
