import { Badge } from "@/react-app/components/ui/badge";
import { Button } from "@/react-app/components/ui/button";
import { Skeleton } from "@/react-app/components/ui/skeleton";
import { Bookmaker } from "@/react-app/hooks/useOddsApi";
import { Check, X } from "lucide-react";

interface BookmakerSelectorProps {
  bookmakers: Bookmaker[];
  selected: string[];
  onChange: (selected: string[]) => void;
  loading: boolean;
}

export function BookmakerSelector({
  bookmakers,
  selected,
  onChange,
  loading,
}: BookmakerSelectorProps) {
  const toggleBookmaker = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  const selectAll = () => {
    onChange(bookmakers.map((b) => b.key));
  };

  const clearAll = () => {
    onChange([]);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Casas de Apostas ({selected.length}/{bookmakers.length})
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            disabled={selected.length === bookmakers.length}
            className="h-7 text-xs"
          >
            <Check className="w-3 h-3 mr-1" />
            Todas
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={selected.length === 0}
            className="h-7 text-xs"
          >
            <X className="w-3 h-3 mr-1" />
            Limpar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {bookmakers.map((bookmaker) => {
          const isSelected = selected.includes(bookmaker.key);
          return (
            <Badge
              key={bookmaker.key}
              variant={isSelected ? "default" : "outline"}
              className={`cursor-pointer transition-all duration-200 ${
                isSelected
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "hover:bg-accent hover:text-accent-foreground"
              }`}
              onClick={() => toggleBookmaker(bookmaker.key)}
            >
              {bookmaker.title}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
