# Hono → Next.js route conversion handoff

App: mocha-app (unknown)

This directory holds the Cloudflare Worker source the migrator preserved
so a Claude Code session can convert it into Next.js route handlers under
`apps/web/src/app/api/<path>/route.ts`.

To run the conversion locally:

```bash
claude -p "Convert apps/web/legacy/worker.ts into Next.js App Router route handlers." \\
  --append-system-prompt "$(cat apps/web/legacy/CLAUDE_PROMPT.md)" \\
  --permission-mode bypassPermissions \\
  --max-budget-usd 20
```

Until that conversion runs, all `/api/*` routes will 404.
