import { useState, useEffect, useCallback } from "react";

// Types for The Odds API responses
export interface Bookmaker {
  key: string;
  title: string;
}

export interface Fixture {
  id: string;
  sportKey: string;
  sportTitle: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
}

export interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

export interface OddsMarket {
  key: string;
  last_update: string;
  outcomes: OddsOutcome[];
}

export interface BookmakerOdds {
  key: string;
  title: string;
  last_update: string;
  markets: OddsMarket[];
}

export interface EventWithOdds {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: BookmakerOdds[];
}

// Fetch bookmakers list
export function useBookmakers() {
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBookmakers() {
      try {
        const response = await fetch("/api/bookmakers");
        if (!response.ok) throw new Error("Failed to fetch bookmakers");
        const data = await response.json();
        setBookmakers(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchBookmakers();
  }, []);

  return { bookmakers, loading, error };
}

// Fetch fixtures (events)
export interface UseFixturesOptions {
  sportKey?: string;
  mode?: "upcoming" | "all";
  refreshMs?: number;
}

// Fetch fixtures (events)
// Default: upcoming soccer events across supported leagues
export function useFixtures(options: UseFixturesOptions = {}) {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { sportKey, mode = "upcoming", refreshMs = 60_000 } = options;

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sportKey) params.set("sport", sportKey);
      if (mode) params.set("mode", mode);
      params.set("t", String(Date.now()));

      const url = `/api/fixtures?${params.toString()}`;

      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          `${data?.error || "Failed to fetch fixtures"}${data?.message ? `: ${data.message}` : ""}`
        );
      }
      setFixtures(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [sportKey, mode]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Auto-refresh while tab is visible
  useEffect(() => {
    if (!refreshMs || refreshMs <= 0) return;

    let interval: number | undefined;

    const stop = () => {
      if (interval) window.clearInterval(interval);
      interval = undefined;
    };

    const start = () => {
      stop();
      interval = window.setInterval(() => {
        if (document.visibilityState === "visible") refetch();
      }, refreshMs);
    };

    const onVis = () => {
      if (document.visibilityState === "visible") refetch();
    };

    start();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refetch, refreshMs]);

  return { fixtures, loading, error, refetch };
}

// Fetch all odds for dashboard view
export function useAllOdds(selectedBookmakers: string[]) {
  const [events, setEvents] = useState<EventWithOdds[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBookmakers.length > 0) {
        params.set("bookmakers", selectedBookmakers.join(","));
      }
      
      const url = `/api/all-odds${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch odds");
      const data = await response.json();
      setEvents(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [selectedBookmakers]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { events, loading, error, refetch };
}

// Fetch odds for a specific event
export function useEventOdds(eventId: string | null, sportKey: string | null, selectedBookmakers: string[]) {
  const [event, setEvent] = useState<EventWithOdds | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!eventId || !sportKey) {
      setEvent(null);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("sport", sportKey);
      if (selectedBookmakers.length > 0) {
        params.set("bookmakers", selectedBookmakers.join(","));
      }
      
      const url = `/api/event/${eventId}/odds?${params}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch odds");
      const data = await response.json();
      setEvent(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [eventId, sportKey, selectedBookmakers]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { event, loading, error, refetch };
}

// Process totals (corners/goals) odds into table format
export interface ProcessedTotalsOdd {
  marketKey: string;
  line: number;
  overOdds: Record<string, number | null>;
  underOdds: Record<string, number | null>;
}

export function processTotalsOdds(
  event: EventWithOdds | null,
  selectedBookmakers: string[]
): ProcessedTotalsOdd[] {
  if (!event || !event.bookmakers) return [];

  const oddsMap = new Map<number, ProcessedTotalsOdd>();

  for (const bookmaker of event.bookmakers) {
    if (!selectedBookmakers.includes(bookmaker.key)) continue;

    const totalsMarket = bookmaker.markets.find(m => m.key === "totals");
    if (!totalsMarket) continue;

    for (const outcome of totalsMarket.outcomes) {
      const line = outcome.point ?? 0;
      
      if (!oddsMap.has(line)) {
        oddsMap.set(line, {
          marketKey: "totals",
          line,
          overOdds: {},
          underOdds: {},
        });
      }

      const row = oddsMap.get(line)!;
      
      if (outcome.name === "Over") {
        row.overOdds[bookmaker.key] = outcome.price;
      } else if (outcome.name === "Under") {
        row.underOdds[bookmaker.key] = outcome.price;
      }
    }
  }

  // Sort by line
  return Array.from(oddsMap.values()).sort((a, b) => a.line - b.line);
}

// Process head-to-head odds
export interface ProcessedH2HOdd {
  outcome: string;
  odds: Record<string, number | null>;
}

export function processH2HOdds(
  event: EventWithOdds | null,
  selectedBookmakers: string[]
): ProcessedH2HOdd[] {
  if (!event || !event.bookmakers) return [];

  const outcomes = new Map<string, ProcessedH2HOdd>();
  
  // Initialize with home, away, draw
  outcomes.set(event.home_team, { outcome: event.home_team, odds: {} });
  outcomes.set(event.away_team, { outcome: event.away_team, odds: {} });
  outcomes.set("Draw", { outcome: "Draw", odds: {} });

  for (const bookmaker of event.bookmakers) {
    if (!selectedBookmakers.includes(bookmaker.key)) continue;

    const h2hMarket = bookmaker.markets.find(m => m.key === "h2h");
    if (!h2hMarket) continue;

    for (const outcome of h2hMarket.outcomes) {
      const name = outcome.name === "Draw" ? "Draw" : outcome.name;
      if (outcomes.has(name)) {
        outcomes.get(name)!.odds[bookmaker.key] = outcome.price;
      }
    }
  }

  return Array.from(outcomes.values());
}

// Find best odds for highlighting
export function findBestOdds(oddsRecord: Record<string, number | null>): string[] {
  let maxOdds = 0;
  const bestBookmakers: string[] = [];

  for (const [bookmaker, odds] of Object.entries(oddsRecord)) {
    if (odds === null) continue;
    if (odds > maxOdds) {
      maxOdds = odds;
      bestBookmakers.length = 0;
      bestBookmakers.push(bookmaker);
    } else if (odds === maxOdds) {
      bestBookmakers.push(bookmaker);
    }
  }

  return bestBookmakers;
}
