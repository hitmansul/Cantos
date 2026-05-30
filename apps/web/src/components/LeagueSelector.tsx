'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Globe, Loader2, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { LeagueConfig } from '@/shared/footballDataTypes';
import { useLeagues } from '@/hooks/useCornerStats';

interface LeagueSelectorProps {
  selectedLeague: LeagueConfig | null;
  onSelect: (league: LeagueConfig) => void;
}

export function LeagueSelector({ selectedLeague, onSelect }: LeagueSelectorProps) {
  const { leagues, loading, error, fetchLeagues } = useLeagues();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  // Filter by search
  const filteredLeagues = search.trim()
    ? leagues.filter(
        (l) =>
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          l.country.toLowerCase().includes(search.toLowerCase())
      )
    : leagues;

  // Group leagues by country
  const leaguesByCountry = filteredLeagues.reduce(
    (acc, league) => {
      if (!acc[league.country]) {
        acc[league.country] = [];
      }
      acc[league.country].push(league);
      return acc;
    },
    {} as Record<string, LeagueConfig[]>
  );

  // Country sort: FIFA first, then UEFA, CONMEBOL, Brasil, then alphabetical
  const countries = Object.keys(leaguesByCountry).sort((a, b) => {
    const order = ['FIFA', 'UEFA', 'CONMEBOL', 'Brasil', 'CAF', 'AFC'];
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <DropdownMenu
      open={isOpen}
      onOpenChange={(o) => {
        setIsOpen(o);
        if (!o) setSearch('');
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-auto py-3" disabled={loading}>
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

      <DropdownMenuContent className="w-80 max-h-[520px] overflow-y-auto" align="start">
        {/* Search box */}
        <div className="p-2 sticky top-0 bg-popover z-10 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar liga ou país..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {!loading && (
            <p className="text-xs text-muted-foreground mt-1.5 px-1">
              {filteredLeagues.length} liga{filteredLeagues.length !== 1 ? 's' : ''} disponível
              {filteredLeagues.length !== 1 ? 'is' : ''}
            </p>
          )}
        </div>

        {error ? (
          <div className="p-4 text-sm text-destructive">Erro ao carregar ligas: {error}</div>
        ) : filteredLeagues.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            Nenhuma liga encontrada
          </div>
        ) : (
          countries.map((country) => (
            <div key={country}>
              <DropdownMenuLabel className="flex items-center gap-2">
                <span>{leaguesByCountry[country][0].flag}</span>
                <span>{country}</span>
                <Badge variant="outline" className="text-xs ml-auto">
                  {leaguesByCountry[country].length}
                </Badge>
              </DropdownMenuLabel>
              {leaguesByCountry[country].map((league) => (
                <DropdownMenuItem
                  key={league.id}
                  onClick={() => {
                    onSelect(league);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{league.name}</span>
                    {league.id === 'BR1' && (
                      <Badge variant="secondary" className="text-xs">
                        Local
                      </Badge>
                    )}
                    {league.country === 'FIFA' && (
                      <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        🌍 2026
                      </Badge>
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
