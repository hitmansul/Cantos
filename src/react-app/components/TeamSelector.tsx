import { useState, useMemo } from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import { Input } from "@/react-app/components/ui/input";
import { Button } from "@/react-app/components/ui/button";
import { ScrollArea } from "@/react-app/components/ui/scroll-area";
import { Badge } from "@/react-app/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/react-app/components/ui/popover";
import { teamStats, type DetailedTeamStats } from "@/react-app/data/teamCornerStats";

interface TeamSelectorProps {
  selectedTeam: DetailedTeamStats | null;
  onSelect: (team: DetailedTeamStats) => void;
  label?: string;
  placeholder?: string;
}

export function TeamSelector({ 
  selectedTeam, 
  onSelect, 
  label = "Selecione um time",
  placeholder = "Buscar time..."
}: TeamSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [leagueFilter, setLeagueFilter] = useState<"all" | "A" | "B">("all");

  const filteredTeams = useMemo(() => {
    let teams = teamStats;
    
    // Filter by league
    if (leagueFilter === "A") {
      teams = teams.filter(t => t.league.includes("Série A"));
    } else if (leagueFilter === "B") {
      teams = teams.filter(t => t.league.includes("Série B"));
    }
    
    // Filter by search
    if (search) {
      const term = search.toLowerCase();
      teams = teams.filter(t => t.team.toLowerCase().includes(term));
    }
    
    return teams;
  }, [search, leagueFilter]);

  // Group teams by league for display
  const groupedTeams = useMemo(() => {
    const serieA = filteredTeams.filter(t => t.league.includes("Série A"));
    const serieB = filteredTeams.filter(t => t.league.includes("Série B"));
    return { serieA, serieB };
  }, [filteredTeams]);

  const renderTeamButton = (team: DetailedTeamStats) => (
    <button
      key={team.team}
      onClick={() => {
        onSelect(team);
        setOpen(false);
        setSearch("");
      }}
      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
    >
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-sm font-bold">
        {team.team.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{team.team}</p>
        <p className="text-xs text-muted-foreground truncate">
          {team.avgCornersFor} escanteios/jogo
        </p>
      </div>
      {selectedTeam?.team === team.team && (
        <Check className="h-4 w-4 text-primary" />
      )}
    </button>
  );

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-12 text-left font-normal"
          >
            {selectedTeam ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-sm font-bold">
                  {selectedTeam.team.charAt(0)}
                </div>
                <div>
                  <p className="font-medium">{selectedTeam.team}</p>
                  <p className="text-xs text-muted-foreground">{selectedTeam.league}</p>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground">Selecione um time...</span>
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <div className="p-2 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={placeholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {/* League filter buttons */}
            <div className="flex gap-1">
              <Badge 
                variant={leagueFilter === "all" ? "default" : "outline"}
                className="cursor-pointer flex-1 justify-center"
                onClick={() => setLeagueFilter("all")}
              >
                Todos
              </Badge>
              <Badge 
                variant={leagueFilter === "A" ? "default" : "outline"}
                className="cursor-pointer flex-1 justify-center"
                onClick={() => setLeagueFilter("A")}
              >
                Série A
              </Badge>
              <Badge 
                variant={leagueFilter === "B" ? "default" : "outline"}
                className="cursor-pointer flex-1 justify-center"
                onClick={() => setLeagueFilter("B")}
              >
                Série B
              </Badge>
            </div>
          </div>
          <ScrollArea className="h-[300px]">
            <div className="p-2">
              {filteredTeams.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum time encontrado
                </p>
              ) : leagueFilter === "all" ? (
                // Show grouped by league
                <>
                  {groupedTeams.serieA.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <span>🇧🇷</span> Série A
                        <span className="text-[10px] font-normal">({groupedTeams.serieA.length})</span>
                      </div>
                      {groupedTeams.serieA.map(renderTeamButton)}
                    </>
                  )}
                  {groupedTeams.serieB.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 mt-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-t border-border pt-3">
                        <span>🇧🇷</span> Série B
                        <span className="text-[10px] font-normal">({groupedTeams.serieB.length})</span>
                      </div>
                      {groupedTeams.serieB.map(renderTeamButton)}
                    </>
                  )}
                </>
              ) : (
                // Show flat list
                filteredTeams.map(renderTeamButton)
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
