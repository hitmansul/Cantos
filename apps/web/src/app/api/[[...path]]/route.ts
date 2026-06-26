import { NextRequest, NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";

const WORLD_CUP_2026_KEY = "world_cup_2026";

type Ctx = { params: Promise<{ path?: string[] }> };

type MissingStatsRow = {
  id: number | string;
  fixture_key: string;
  home_team_name: string;
  away_team_name: string;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
  kickoff_at: string | null;
  referee: string | null;
  total_stats: number;
  fifa_stats: number;
  other_stats: number;
};

function normalized(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isFinishedStatus(status: unknown) {
  const text = normalized(status);
  return ["fim", "final", "finished", "ft", "encerrado"].some((term) => text.includes(term));
}

async function fifaMissingStatsAudit() {
  const rows = (await sql`
    SELECT
      m.id,
      m.fixture_key,
      m.home_team_name,
      m.away_team_name,
      m.home_score,
      m.away_score,
      m.status,
      m.kickoff_at,
      m.referee,
      COUNT(ms.id)::int AS total_stats,
      COUNT(ms.id) FILTER (WHERE ms.source_key = 'fifa')::int AS fifa_stats,
      COUNT(ms.id) FILTER (WHERE ms.source_key <> 'fifa')::int AS other_stats
    FROM world_cup_matches m
    LEFT JOIN world_cup_match_statistics ms ON ms.match_id = m.id
    WHERE m.competition_key = ${WORLD_CUP_2026_KEY}
    GROUP BY m.id
    ORDER BY m.kickoff_at DESC NULLS LAST, m.id DESC
    LIMIT 200
  `) as MissingStatsRow[];

  const completed = rows.filter((row) => isFinishedStatus(row.status) || row.home_score !== null || row.away_score !== null);
  const missingFifa = completed.filter((row) => row.fifa_stats === 0);
  const missingAllStats = completed.filter((row) => row.total_stats === 0);

  return NextResponse.json({
    success: true,
    competition: WORLD_CUP_2026_KEY,
    summary: {
      completedMatches: completed.length,
      withFifaStats: completed.filter((row) => row.fifa_stats > 0).length,
      missingFifaStats: missingFifa.length,
      missingAllStats: missingAllStats.length,
    },
    priority: "FIFA first. This audit shows finished matches that still need FIFA PMSR/PDF import into world_cup_match_statistics.",
    missingFifa,
    missingAllStats,
    lastUpdated: new Date().toISOString(),
  });
}

function notMigrated(req: NextRequest, params: Promise<{ path?: string[] }>) {
  return params.then(async (p) => {
    const path = "/api/" + (p.path?.join("/") ?? "");

    if (req.method === "GET" && path === "/api/world-cup/fifa-missing-stats") {
      try {
        return await fifaMissingStatsAudit();
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao auditar estatísticas FIFA.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "route_not_migrated",
        message:
          "This API route has not yet been migrated from the original Mocha worker.",
        method: req.method,
        path,
      },
      { status: 501 }
    );
  });
}

export async function GET(req: NextRequest, ctx: Ctx) {
  return notMigrated(req, ctx.params);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return notMigrated(req, ctx.params);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return notMigrated(req, ctx.params);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return notMigrated(req, ctx.params);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return notMigrated(req, ctx.params);
}
export async function OPTIONS(req: NextRequest, ctx: Ctx) {
  return notMigrated(req, ctx.params);
}
