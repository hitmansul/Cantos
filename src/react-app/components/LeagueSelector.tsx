import { useEffect, useState } from "react";
import { ChevronDown, Globe, Loader2 } from "lucide-react";

import { Button } from "@/react-app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/react-app/components/ui/dropdown-menu";
import { Badge } from "@/react-app/components/ui/badge";
import type { LeagueConfig } from "@/shared/footballDataTypes";
import { useLeagues } from "@/react-app/hooks/useCornerStats";

interface LeagueSelectorProps {
  selectedLeague: LeagueConfig | null;
  onSelect: (league: LeagueConfig) => void;
}

export function LeagueSelector({ selectedLeague, onSelect }: LeagueSelectorProps) {
  const { leagues, loading, error, fetchLeagues } = useLeagues();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  // Group leagues by country
  const leaguesByCountry = leagues.reduce((acc, league) => {
    if (!acc[league.country]) {
      acc[league.country] = [];
    }
    acc[league.country].push(league);
    return acc;
  }, {} as Record<string, LeagueConfig[]>);

  // Order countries (Brazil first, then alphabetically)
  const countries = Object.keys(leaguesByCountry).sort((a, b) => {
    if (a === "Brasil") return -1;
    if (b === "Brasil") return 1;
    return a.localeCompare(b);
  });

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between h-auto py-3"
          disabled={loading}
        >
          <div className="flex items-center gap-3">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : selectedLeague ? (
              <>
                <span className="text-xl">{selectedLeague.flag}</span>
                <div className="text-left">
                  <p className="font-medium">{selectedLeague.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedLeague.country}</p>
                </div>
              </>
            ) : (
              <>
                <Globe className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground">Selecione uma liga</span>
              </>
            )}
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        className="w-72 max-h-96 overflow-y-auto" 
        align="start"
      >
        {error ? (
          <div className="p-4 text-sm text-destructive">
            Erro ao carregar ligas: {error}
          </div>
        ) : (
          countries.map((country) => (
            <div key={country}>
              <DropdownMenuLabel className="flex items-center gap-2">
                <span>{leaguesByCountry[country][0].flag}</span>
                <span>{country}</span>
              </DropdownMenuLabel>
              {leaguesByCountry[country].map((league) => (
                <DropdownMenuItem
                  key={league.id}
                  onClick={() => {
                    onSelect(league);
                    setIsOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{league.name}</span>
                    {league.id === "BR1" && (
                      <Badge variant="secondary" className="text-xs">Local</Badge>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
