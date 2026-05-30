#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/home/user/project/apps/web/.env"
TIMEOUT_SECS=120
WARN_INTERVAL_SECS=30

echo "[vector-wait] Waiting for ${ENV_FILE}..."

elapsed=0
warned=false
while [ ! -s "$ENV_FILE" ]; do
  sleep 1
  elapsed=$((elapsed + 1))

  if [ "$elapsed" -ge "$TIMEOUT_SECS" ]; then
    echo "[vector-wait] ERROR: ${ENV_FILE} not found after ${TIMEOUT_SECS}s — log shipping will not work. Exiting." >&2
    exit 1
  fi

  if [ $((elapsed % WARN_INTERVAL_SECS)) -eq 0 ]; then
    echo "[vector-wait] WARNING: still waiting for ${ENV_FILE} after ${elapsed}s" >&2
  fi
done

# Load key=value pairs from .env
set -a
source "$ENV_FILE"
set +a

echo "[vector-wait] Secrets loaded after ${elapsed}s. Starting Vector..."
exec /usr/bin/vector --config /etc/vector/vector.toml
