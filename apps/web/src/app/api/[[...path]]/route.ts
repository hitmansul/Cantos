import { NextRequest, NextResponse } from "next/server";

// Catch-all for /api/* paths the migration didn't translate. More-specific
// app/api/<path>/route.ts files take precedence; this only fires for misses.
// We respond with 501 + a structured payload so the frontend can decide how
// to present it (e.g. "this feature hasn't been migrated yet — spend N
// credits to migrate it") rather than the user seeing a generic 404.

function notMigrated(req: NextRequest, params: Promise<{ path?: string[] }>) {
  return params.then((p) => {
    const path = "/api/" + (p.path?.join("/") ?? "");
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

type Ctx = { params: Promise<{ path?: string[] }> };

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
