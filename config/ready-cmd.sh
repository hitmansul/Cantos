#!/usr/bin/env bash
set -euo pipefail

log() { echo "[ready-cmd] $*"; }

# Stop the healthcheck while we warm caches — its polling triggers
# Metro re-bundles and Next.js requests that interfere with the build.
supervisorctl stop healthcheck 2>/dev/null || true

# E2B retries this script in a loop until it exits 0.
# During template build this warms all caches (webpack, SWC, Metro) so the
# snapshot includes them on disk. The build pays the cost once; every sandbox
# launched from the snapshot benefits.

# Next.js dev server is up
log "checking Next.js..."
curl --max-time 5 -s -o /dev/null -w "%{http_code}" http://localhost:4000 | grep -q "200"
log "Next.js is up"

# Warm the Next.js webpack + SWC caches by loading an actual page. This
# triggers a full compilation and writes .next/cache/webpack/ to disk.
log "warming Next.js cache..."
curl --max-time 120 -s -o /dev/null http://localhost:4000/
log "Next.js cache warmed"

# Metro/Expo is listening
log "checking Metro port..."
ss -tuln | grep -q :8081
log "Metro is listening"

# Warm Metro caches by fetching the full web and iOS bundles.
# Expo sets unstable_serverRoot to the monorepo root, so bundle paths
# must be relative to /home/user/project/ (not apps/mobile/).
log "warming Metro web bundle..."
WEB_STATUS=$(curl --max-time 120 -s -o /dev/null -w "%{http_code}" "http://localhost:8081/apps/mobile/index.web.tsx.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=src%2Fapp&unstable_transformProfile=hermes-stable")
log "Metro web bundle status: $WEB_STATUS"
echo "$WEB_STATUS" | grep -q "200"

log "warming Metro iOS bundle..."
IOS_STATUS=$(curl --max-time 120 -s -o /dev/null -w "%{http_code}" "http://localhost:8081/apps/mobile/index.tsx.bundle?platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=src%2Fapp&unstable_transformProfile=hermes-stable")
log "Metro iOS bundle status: $IOS_STATUS"
echo "$IOS_STATUS" | grep -q "200"

# Back up the warmed .next/cache to a sidecar location. If the cache gets
# nuked at runtime (e.g. by a git clean or a repo with a different .gitignore),
# the init script can restore it from here.
log "backing up .next/cache..."
if [ ! -d /home/user/.next-cache-warm ]; then
  if [ -d /home/user/project/apps/web/.next/cache ]; then
    cp -r /home/user/project/apps/web/.next/cache /home/user/.next-cache-warm
    log ".next/cache backed up"
  else
    log "WARNING: .next/cache does not exist, skipping backup"
  fi
else
  log ".next-cache-warm already exists, skipping"
fi

# Re-enable the healthcheck for sandbox launches. It was stopped above to
# avoid interfering with cache warming. Supervisord will autostart it when
# the sandbox boots from the snapshot.
supervisorctl start healthcheck 2>/dev/null || true

log "ready"
