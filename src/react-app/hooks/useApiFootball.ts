import { useEffect, useMemo, useState } from "react";

export type ApiFootballFixture = {
  id: number;
  league: { id: number; name: string; country?: string; season: number; round?: string };
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  status?: string;
};

export type ApiFootballFixturesResponse = {
  provider: "API-Football";
  league: number;
  seasonRequested?: number;
  seasonUsed: number;
  count: number;
  fixtures: ApiFootballFixture[];
  rawErrors?: unknown;
};

export type UseApiFootballFixturesArgs = {
  league: number;
  season?: number;
  mode?: "upcoming" | "all";
  next?: number;
  refreshMs?: number;
};

export function useApiFootballFixtures({ league, season, mode = "upcoming", next = 50, refreshMs }: UseApiFootballFixturesArgs) {
  const [data, setData] = useState<ApiFootballFixturesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => {
    const u = new URL("/api/apifootball/fixtures", window.location.origin);
    u.searchParams.set("league", String(league));
    if (season) u.searchParams.set("season", String(season));
    u.searchParams.set("mode", mode);
    u.searchParams.set("next", String(next));
    return u.toString();
  }, [league, season, mode, next]);

  const fetchNow = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      const txt = await res.text();
      const json = JSON.parse(txt) as ApiFootballFixturesResponse;
      setData(json);
      if (!res.ok) {
        setError((json as any)?.error || `HTTP ${res.status}`);
      }
    } catch (e: any) {
      setError(e?.message || "Falha ao buscar jogos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNow();
    if (!refreshMs) return;
    const t = setInterval(fetchNow, refreshMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, refreshMs]);

  return { data, loading, error, refetch: fetchNow };
}
