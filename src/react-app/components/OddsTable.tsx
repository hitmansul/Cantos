import { Skeleton } from "@/react-app/components/ui/skeleton";
import { ProcessedTotalsOdd, Bookmaker, findBestOdds } from "@/react-app/hooks/useOddsApi";
import { TrendingUp, TrendingDown } from "lucide-react";

interface OddsTableProps {
  odds: ProcessedTotalsOdd[];
  bookmakers: Bookmaker[];
  selectedBookmakers: string[];
  loading: boolean;
}

export function OddsTable({
  odds,
  bookmakers,
  selectedBookmakers,
  loading,
}: OddsTableProps) {
  const selectedBookmakerData = bookmakers.filter((b) =>
    selectedBookmakers.includes(b.key)
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (odds.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Nenhuma odd de over/under disponível para este jogo</p>
        <p className="text-xs mt-1">
          Tente selecionar outro jogo ou aguarde atualizações
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">
              Linha
            </th>
            <th className="text-center py-3 px-2 font-medium text-muted-foreground">
              Tipo
            </th>
            {selectedBookmakerData.map((bookmaker) => (
              <th
                key={bookmaker.key}
                className="text-center py-3 px-2 font-medium text-muted-foreground min-w-[80px]"
              >
                <span className="truncate block max-w-[80px]">
                  {bookmaker.title}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {odds.map((row, index) => {
            const bestOverBookmakers = findBestOdds(row.overOdds);
            const bestUnderBookmakers = findBestOdds(row.underOdds);

            return (
              <>
                {/* Over row */}
                <tr
                  key={`${row.line}-over`}
                  className={`border-b border-border/50 ${
                    index % 2 === 0 ? "bg-muted/30" : ""
                  }`}
                >
                  <td className="py-3 px-2 font-medium" rowSpan={2}>
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-bold text-primary">
                        {row.line.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-emerald-400">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span className="font-medium">Over</span>
                    </div>
                  </td>
                  {selectedBookmakerData.map((bookmaker) => {
                    const odd = row.overOdds[bookmaker.key];
                    const isBest = bestOverBookmakers.includes(bookmaker.key);
                    
                    return (
                      <td
                        key={bookmaker.key}
                        className={`py-3 px-2 text-center font-mono tabular-nums ${
                          isBest && odd
                            ? "text-emerald-400 font-bold bg-emerald-500/10"
                            : ""
                        }`}
                      >
                        {odd !== null && odd !== undefined ? (
                          <span className="font-semibold">
                            {odd.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                
                {/* Under row */}
                <tr
                  key={`${row.line}-under`}
                  className={`border-b border-border ${
                    index % 2 === 0 ? "bg-muted/30" : ""
                  }`}
                >
                  <td className="py-3 px-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-red-400">
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span className="font-medium">Under</span>
                    </div>
                  </td>
                  {selectedBookmakerData.map((bookmaker) => {
                    const odd = row.underOdds[bookmaker.key];
                    const isBest = bestUnderBookmakers.includes(bookmaker.key);
                    
                    return (
                      <td
                        key={bookmaker.key}
                        className={`py-3 px-2 text-center font-mono tabular-nums ${
                          isBest && odd
                            ? "text-emerald-400 font-bold bg-emerald-500/10"
                            : ""
                        }`}
                      >
                        {odd !== null && odd !== undefined ? (
                          <span className="font-semibold">
                            {odd.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
