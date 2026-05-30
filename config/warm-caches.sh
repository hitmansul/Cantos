#!/usr/bin/env bash
set -euo pipefail

# Warm Next.js and Metro caches by starting the dev servers directly,
# fetching bundles, then shutting them down. The cached files stay on disk
# so subsequent cold starts are fast.

log() { echo "[warm-caches] $*"; }

# Start Next.js dev server in the background
log "starting Next.js..."
cd /home/user/project/apps/web
HOME=/home/user yarn dev &
WEB_PID=$!

# Start Metro/Expo in the background
log "starting Metro..."
cd /home/user/project/apps/mobile
HOME=/home/user \
  EXPO_NO_CACHE=1 \
  EXPO_USE_FAST_RESOLVER=1 \
  EAS_NO_VCS=1 \
  EAS_PROJECT_ROOT=. \
  EXPO_NO_METRO_LAZY=1 \
  yarn run expo start --port 8081 &
MOBILE_PID=$!

cd /home/user

# Wait for Next.js
log "waiting for Next.js on :4000..."
for i in $(seq 1 120); do
  if curl --max-time 2 -s -o /dev/null -w "%{http_code}" http://localhost:4000 2>/dev/null | grep -q "200"; then
    break
  fi
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    log "ERROR: Next.js process exited"
    exit 1
  fi
  sleep 1
done
log "Next.js is up"

# Warm Next.js webpack + SWC caches
log "warming Next.js cache..."
curl --max-time 120 -s -o /dev/null http://localhost:4000/
log "Next.js cache warmed"

# Wait for Metro
log "waiting for Metro on :8081..."
for i in $(seq 1 120); do
  if ss -tuln 2>/dev/null | grep -q :8081; then
    break
  fi
  if ! kill -0 "$MOBILE_PID" 2>/dev/null; then
    log "ERROR: Metro process exited"
    exit 1
  fi
  sleep 1
done
log "Metro is listening"

# Warm Metro caches by fetching the full web and iOS bundles.
# Expo sets unstable_serverRoot to the monorepo root, so bundle paths
# must be relative to /home/user/project/ (not apps/mobile/).
log "warming Metro web bundle..."
WEB_STATUS=$(curl --max-time 120 -s -o /dev/null -w "%{http_code}" \
  "http://localhost:8081/apps/mobile/index.web.tsx.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=src%2Fapp&unstable_transformProfile=hermes-stable")
log "Metro web bundle status: $WEB_STATUS"

log "warming Metro iOS bundle..."
IOS_STATUS=$(curl --max-time 120 -s -o /dev/null -w "%{http_code}" \
  "http://localhost:8081/apps/mobile/index.tsx.bundle?platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=src%2Fapp&unstable_transformProfile=hermes-stable")
log "Metro iOS bundle status: $IOS_STATUS"

# Back up the warmed .next directory (cache + dev compilation state).
# If .next gets nuked at runtime (e.g. by a git clean or repo swap),
# the init script can restore from here.
if [ -d /home/user/project/apps/web/.next ]; then
  cp -r /home/user/project/apps/web/.next /home/user/.next-warm
  log ".next backed up"
else
  log "WARNING: .next does not exist, skipping backup"
fi

# Shut down the dev servers
log "stopping services..."
kill "$WEB_PID" "$MOBILE_PID" 2>/dev/null || true
wait "$WEB_PID" 2>/dev/null || true
wait "$MOBILE_PID" 2>/dev/null || true

# Clean up stray directories that dev servers may create outside the project root
rm -rf /home/user/apps

log "cache warming complete"
