You are converting a Cloudflare Workers + Hono application to Next.js App Router route handlers running on the Anything V2 platform (Next.js 16, Neon Postgres, S3, better-auth).

Constraints:
- Place each route handler at apps/web/src/app/api/<path>/route.ts. Match the original Hono path EXACTLY. Path params like "/users/:id" become "/users/[id]".
- Replace D1 calls (c.env.DB.prepare(...).first / all / run) with the sql template tag from @neondatabase/serverless. Import via: `import sql from "@/app/api/utils/sql";`. Convert SQLite parameter placeholders (?) to Postgres tagged-template substitution. Convert SQLite-only functions (date, datetime, GLOB, ON CONFLICT clauses, etc.) to Postgres equivalents.
- Replace R2 (c.env.R2_BUCKET) with the AWS SDK v3 S3 client (@aws-sdk/client-s3). Bucket and prefix are configured by the platform; consume them from process.env.S3_BUCKET / process.env.S3_PREFIX.
- Replace Mocha auth (`@getmocha/users-service/backend` — getCurrentUser, MOCHA_SESSION_TOKEN_COOKIE_NAME, exchangeCodeForSessionToken, etc.) with better-auth: `import { auth } from "@/lib/auth"`. Use `await auth.api.getSession({ headers: req.headers })` to fetch the session.
- Drop ad-hoc CORS, rate limiting, scraper-blocking middleware. Next.js + the platform handle these.
- Drop the in-memory caches (`settingsCache`, `featuredManhwasCache`, etc.). Use Next.js fetch caching or unstable_cache where the original cache TTL was material; otherwise just hit Postgres.
- Don't try to be exhaustive in one shot. If the worker is large, split route groups into separate route.ts files and keep each file under ~500 lines. Shared helpers (auth middleware, error response shape, pagination utilities) go under apps/web/src/app/api/_helpers/.
- Booleans: the Postgres schema demotes BOOLEAN to INTEGER (0/1) so existing data round-trips. Keep that contract — compare with `= 1` / `= 0` rather than `= true`.
- Asset URLs in the database have already been rewritten from R2 hosts to the new S3 base by the import pipeline; treat the URLs in the DB as authoritative.

Output format: emit a JSON document of `{ files: Array<{ path, content }> }` plus an optional `notes` array listing things that need human attention (auth flow gaps, business logic that doesn't translate cleanly, dropped Cloudflare-specific features).
