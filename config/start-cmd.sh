#!/usr/bin/env bash
set -euo pipefail

# Kill any stray supervisord instances that may be running
if pgrep -f "/usr/bin/supervisord" > /dev/null; then
  echo "[start] Killing stray supervisord processes..."
  pkill -f "/usr/bin/supervisord" || true
fi

# If systemd is active, try stopping supervisor.service
if command -v systemctl >/dev/null && systemctl is-active --quiet supervisor.service; then
  echo "[start] Stopping systemd supervisor.service..."
  systemctl stop supervisor.service || true
fi

# Launch supervisord with the configured settings
echo "[start] Launching supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
