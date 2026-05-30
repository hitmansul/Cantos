"use client";

import { useState } from "react";
import { Filter, Home, Plane, TrendingUp, TrendingDown, RotateCcw, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import type { DetailedTeamStats } from "@/data/teamCornerStats";
import type { TeamCornerStats } from "@/shared/footballDataTypes";

export interface TeamFilters {
  minAvgCorners: number;
  maxAvgCorners: number;
  minHomeCorners: number;
  minAwayCorners: number;
  homeAwayDiff: "any" | "home_better" | "away_better";
  formTrend: "any" | "rising" | "falling" | "stable";
  minOver95Pct: number;
  // Half-time filters
  minFirstHalf: number;
  minSecondHalf: number;
  halfPreference: "any" | "first_better" | "second_better";
}

const DEFAULT_FILTERS: TeamFilters = {
  minAvgCorners: 0,
  maxAvgCorners: 15,
  minHomeCorners: 0,
  minAwayCorners: 0,
  homeAwayDiff: "any",
  formTrend: "any",
  minOver95Pct: 0,
  minFirstHalf: 0,
  minSecondHalf: 0,
  halfPreference: "any",
};

interface TeamFiltersProps {
  filters: TeamFilters;
  onFiltersChange: (filters: TeamFilters) => void;
  teams: DetailedTeamStats[];
}

export function applyFilters(teams: DetailedTeamStats[], filters: TeamFilters): DetailedTeamStats[] {
  return teams.filter(team => {
    // Average corners filter
    if (team.avgCornersFor < filters.minAvgCorners || team.avgCornersFor > filters.maxAvgCorners) {
      return false;
    }
    
    // Home corners minimum
    if (team.avgCornersHome < filters.minHomeCorners) {
      return false;
    }
    
    // Away corners minimum
    if (team.avgCornersAway < filters.minAwayCorners) {
      return false;
    }
    
    // Home/Away difference
    if (filters.homeAwayDiff === "home_better" && team.avgCornersHome <= team.avgCornersAway) {
      return false;
    }
    if (filters.homeAwayDiff === "away_better" && team.avgCornersAway <= team.avgCornersHome) {
      return false;
    }
    
    // Form trend (comparing last 2 games vs previous 2)
    if (filters.formTrend !== "any" && team.last5Games.length >= 4) {
      const recent = (team.last5Games[0] + team.last5Games[1]) / 2;
      const previous = (team.last5Games[2] + team.last5Games[3]) / 2;
      const diff = recent - previous;
      
      if (filters.formTrend === "rising" && diff <= 0.5) return false;
      if (filters.formTrend === "falling" && diff >= -0.5) return false;
      if (filters.formTrend === "stable" && Math.abs(diff) > 1) return false;
    }
    
    // Over 9.5 percentage
    if (team.over95Pct < filters.minOver95Pct) {
      return false;
    }
    
    // First half minimum
    if (team.avgCornersFirstHalf < filters.minFirstHalf) {
      return false;
    }
    
    // Second half minimum
    if (team.avgCornersSecondHalf < filters.minSecondHalf) {
      return false;
    }
    
    // Half preference
    if (filters.halfPreference === "first_better" && team.avgCornersFirstHalf <= team.avgCornersSecondHalf) {
      return false;
    }
    if (filters.halfPreference === "second_better" && team.avgCornersSecondHalf <= team.avgCornersFirstHalf) {
      return false;
    }
    
    return true;
  });
}

export function TeamFiltersPanel({ filters, onFiltersChange, teams }: TeamFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const filteredCount = applyFilters(teams, filters).length;
  const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  
  const resetFilters = () => onFiltersChange(DEFAULT_FILTERS);
  
  return (
    <Card className="p-4">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-primary" />
          <span className="font-medium">Filtros Avançados</span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="bg-primary/20 text-primary">
              {filteredCount} de {teams.length} times
            </Badge>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
      
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border space-y-5">
          {/* Average Corners Range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">
                Média de escanteios a favor
              </label>
              <Badge variant="outline">
                {filters.minAvgCorners} - {filters.maxAvgCorners}
              </Badge>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <span className="text-xs text-muted-foreground">Mínimo</span>
                <Slider
                  value={[filters.minAvgCorners]}
                  onValueChange={([val]) => onFiltersChange({ ...filters, minAvgCorners: val })}
                  min={0}
                  max={10}
                  step={0.5}
                />
              </div>
              <div className="flex-1 space-y-1">
                <span className="text-xs text-muted-foreground">Máximo</span>
                <Slider
                  value={[filters.maxAvgCorners]}
                  onValueChange={([val]) => onFiltersChange({ ...filters, maxAvgCorners: val })}
                  min={0}
                  max={15}
                  step={0.5}
                />
              </div>
            </div>
          </div>
          
          {/* Home/Away Minimum */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-emerald-400" />
                <label className="text-sm font-medium text-muted-foreground">
                  Min. em casa
                </label>
                <Badge variant="outline" className="ml-auto">{filters.minHomeCorners}</Badge>
              </div>
              <Slider
                value={[filters.minHomeCorners]}
                onValueChange={([val]) => onFiltersChange({ ...filters, minHomeCorners: val })}
                min={0}
                max={8}
                step={0.5}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-amber-400" />
                <label className="text-sm font-medium text-muted-foreground">
                  Min. fora
                </label>
                <Badge variant="outline" className="ml-auto">{filters.minAwayCorners}</Badge>
              </div>
              <Slider
                value={[filters.minAwayCorners]}
                onValueChange={([val]) => onFiltersChange({ ...filters, minAwayCorners: val })}
                min={0}
                max={8}
                step={0.5}
              />
            </div>
          </div>
          
          {/* Home vs Away Performance */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Desempenho casa vs fora
            </label>
            <div className="flex gap-2">
              <Button
                variant={filters.homeAwayDiff === "any" ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ ...filters, homeAwayDiff: "any" })}
                className="flex-1"
              >
                Todos
              </Button>
              <Button
                variant={filters.homeAwayDiff === "home_better" ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ ...filters, homeAwayDiff: "home_better" })}
                className="flex-1 gap-1"
              >
                <Home className="w-3 h-3" />
                Melhor em casa
              </Button>
              <Button
                variant={filters.homeAwayDiff === "away_better" ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ ...filters, homeAwayDiff: "away_better" })}
                className="flex-1 gap-1"
              >
                <Plane className="w-3 h-3" />
                Melhor fora
              </Button>
            </div>
          </div>
          
          {/* Form Trend */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Tendência de forma
            </label>
            <div className="flex gap-2">
              <Button
                variant={filters.formTrend === "any" ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ ...filters, formTrend: "any" })}
                className="flex-1"
              >
                Todos
              </Button>
              <Button
                variant={filters.formTrend === "rising" ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ ...filters, formTrend: "rising" })}
                className="flex-1 gap-1"
              >
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                Subindo
              </Button>
              <Button
                variant={filters.formTrend === "falling" ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ ...filters, formTrend: "falling" })}
                className="flex-1 gap-1"
              >
                <TrendingDown className="w-3 h-3 text-red-400" />
                Caindo
              </Button>
            </div>
          </div>
          
          {/* Over 9.5 Percentage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">
                % jogos com Over 9.5
              </label>
              <Badge variant="outline">{filters.minOver95Pct}%+</Badge>
            </div>
            <Slider
              value={[filters.minOver95Pct]}
              onValueChange={([val]) => onFiltersChange({ ...filters, minOver95Pct: val })}
              min={0}
              max={100}
              step={5}
            />
          </div>
          
          {/* Half-time Filters */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <label className="text-sm font-medium text-muted-foreground">
                  Min. 1º tempo
                </label>
                <Badge variant="outline" className="ml-auto">{filters.minFirstHalf}</Badge>
              </div>
              <Slider
                value={[filters.minFirstHalf]}
                onValueChange={([val]) => onFiltersChange({ ...filters, minFirstHalf: val })}
                min={0}
                max={5}
                step={0.5}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <label className="text-sm font-medium text-muted-foreground">
                  Min. 2º tempo
                </label>
                <Badge variant="outline" className="ml-auto">{filters.minSecondHalf}</Badge>
              </div>
              <Slider
                value={[filters.minSecondHalf]}
                onValueChange={([val]) => onFiltersChange({ ...filters, minSecondHalf: val })}
                min={0}
                max={5}
                step={0.5}
              />
            </div>
          </div>
          
          {/* Half Preference */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Desempenho por tempo
            </label>
            <div className="flex gap-2">
              <Button
                variant={filters.halfPreference === "any" ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ ...filters, halfPreference: "any" })}
                className="flex-1"
              >
                Todos
              </Button>
              <Button
                variant={filters.halfPreference === "first_better" ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ ...filters, halfPreference: "first_better" })}
                className="flex-1 gap-1"
              >
                <Clock className="w-3 h-3 text-blue-400" />
                Mais no 1º
              </Button>
              <Button
                variant={filters.halfPreference === "second_better" ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ ...filters, halfPreference: "second_better" })}
                className="flex-1 gap-1"
              >
                <Clock className="w-3 h-3 text-purple-400" />
                Mais no 2º
              </Button>
            </div>
          </div>
          
          {/* Reset Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="w-full gap-2 text-muted-foreground"
            >
              <RotateCcw className="w-4 h-4" />
              Limpar filtros
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export { DEFAULT_FILTERS };

// International Filters (simplified for TeamCornerStats type)
export interface IntlTeamFilters {
  minAvgCorners: number;
  maxAvgCorners: number;
  minHomeCorners: number;
  minAwayCorners: number;
  homeAwayDiff: "any" | "home_better" | "away_better";
}

export const DEFAULT_INTL_FILTERS: IntlTeamFilters = {
  minAvgCorners: 0,
  maxAvgCorners: 15,
  minHomeCorners: 0,
  minAwayCorners: 0,
  homeAwayDiff: "any",
};

export function applyIntlFilters(teams: TeamCornerStats[], filters: IntlTeamFilters): TeamCornerStats[] {
  return teams.filter(team => {
    // Average corners filter
    if (team.avgCornersFor < filters.minAvgCorners || team.avgCornersFor > filters.maxAvgCorners) {
      return false;
    }
    
    // Home corners minimum
    if (team.avgCornersHome < filters.minHomeCorners) {
      return false;
    }
    
    // Away corners minimum
    if (team.avgCornersAway < filters.minAwayCorners) {
      return false;
    }
    
    // Home/Away difference
    if (filters.homeAwayDiff === "home_better" && team.avgCornersHome <= team.avgCornersAway) {
      return false;
    }
    if (filters.homeAwayDiff === "away_better" && team.avgCornersAway <= team.avgCornersHome) {
      return false;
    }
    
    return true;
  });
}

interface IntlTeamFiltersProps {
  filters: IntlTeamFilters;
  onFiltersChange: (filters: IntlTeamFilters) => void;
  teams: TeamCornerStats[];
}

export function IntlTeamFiltersPanel({ filters, onFiltersChange, teams }: IntlTeamFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const filteredCount = applyIntlFilters(teams, filters).length;
  const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_INTL_FILTERS);
  
  const resetFilters = () => onFiltersChange(DEFAULT_INTL_FILTERS);
  
  return (
    <Card className="p-4">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-primary" />
          <span className="font-medium">Filtros Avançados</span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="bg-primary/20 text-primary">
              {filteredCount} de {teams.length} times
            </Badge>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
      
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border space-y-5">
          {/* Average Corners Range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">
                Média de escanteios a favor
              </label>
              <Badge variant="outline">
                {filters.minAvgCorners} - {filters.maxAvgCorners}
              </Badge>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <span className="text-xs text-muted-foreground">Mínimo</span>
                <Slider
                  value={[filters.minAvgCorners]}
                  onValueChange={([val]) => onFiltersChange({ ...filters, minAvgCorners: val })}
                  min={0}
                  max={10}
                  step={0.5}
                />
              </div>
              <div className="flex-1 space-y-1">
                <span className="text-xs text-muted-foreground">Máximo</span>
                <Slider
                  value={[filters.maxAvgCorners]}
                  onValueChange={([val]) => onFiltersChange({ ...filters, maxAvgCorners: val })}
                  min={0}
                  max={15}
                  step={0.5}
                />
              </div>
            </div>
          </div>
          
          {/* Home/Away Minimum */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-emerald-400" />
                <label className="text-sm font-medium text-muted-foreground">
                  Min. em casa
                </label>
                <Badge variant="outline" className="ml-auto">{filters.minHomeCorners}</Badge>
              </div>
              <Slider
                value={[filters.minHomeCorners]}
                onValueChange={([val]) => onFiltersChange({ ...filters, minHomeCorners: val })}
                min={0}
                max={8}
                step={0.5}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-amber-400" />
                <label className="text-sm font-medium text-muted-foreground">
                  Min. fora
                </label>
                <Badge variant="outline" className="ml-auto">{filters.minAwayCorners}</Badge>
              </div>
              <Slider
                value={[filters.minAwayCorners]}
                onValueChange={([val]) => onFiltersChange({ ...filters, minAwayCorners: val })}
                min={0}
                max={8}
                step={0.5}
              />
            </div>
          </div>
          
          {/* Home vs Away Performance */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Desempenho casa vs fora
            </label>
            <div className="flex gap-2">
              <Button
                variant={filters.homeAwayDiff === "any" ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ ...filters, homeAwayDiff: "any" })}
                className="flex-1"
              >
                Todos
              </Button>
              <Button
                variant={filters.homeAwayDiff === "home_better" ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ ...filters, homeAwayDiff: "home_better" })}
                className="flex-1 gap-1"
              >
                <Home className="w-3 h-3" />
                Melhor em casa
              </Button>
              <Button
                variant={filters.homeAwayDiff === "away_better" ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ ...filters, homeAwayDiff: "away_better" })}
                className="flex-1 gap-1"
              >
                <Plane className="w-3 h-3" />
                Melhor fora
              </Button>
            </div>
          </div>
          
          {/* Reset Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="w-full gap-2 text-muted-foreground"
            >
              <RotateCcw className="w-4 h-4" />
              Limpar filtros
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
