#!/usr/bin/env bash
# Serves the site root so tools/*/dist/ (ES modules) load over HTTP.
# Open: http://localhost:<port>/
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

DEFAULT_PORT=8080
PORT="${PORT:-$DEFAULT_PORT}"

# --- preflight ---
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found. Install it (e.g. 'brew install python') and re-run." >&2
  exit 1
fi
if ! command -v lsof >/dev/null 2>&1; then
  echo "lsof not found; cannot check port $PORT." >&2
  exit 1
fi

port_pids() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | sort -u || true; }

next_free_port() {
  local p=$(( $1 + 1 ))
  while [ -n "$(port_pids "$p")" ]; do p=$(( p + 1 )); done
  echo "$p"
}

pids="$(port_pids "$PORT")"
if [ -n "$pids" ]; then
  echo "Port $PORT is in use by:"
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | awk 'NR==1 || 1 {print "  " $0}'
  echo "PIDs: $(echo "$pids" | tr '\n' ' ')"
  if [ ! -t 0 ]; then
    echo "No TTY: cannot prompt. Re-run with PORT=$(next_free_port "$PORT") ./start.sh" >&2
    exit 2
  fi
  read -r -p "[c]lear  [s]can for next free port  [q]uit > " choice
  case "$choice" in
    c|C)
      echo "$pids" | xargs kill 2>/dev/null || true
      sleep 1
      still="$(port_pids "$PORT")"
      if [ -n "$still" ]; then
        echo "Still alive, escalating to kill -9"
        echo "$still" | xargs kill -9 2>/dev/null || true
        sleep 1
      fi
      if [ -n "$(port_pids "$PORT")" ]; then
        echo "Could not free port $PORT. Aborting." >&2
        exit 1
      fi
      echo "Port $PORT freed."
      ;;
    s|S)
      PORT="$(next_free_port "$PORT")"
      echo "Using port $PORT instead."
      ;;
    *)
      echo "Aborted."
      exit 0
      ;;
  esac
fi

export PORT
echo "Raven Guard site:  http://localhost:$PORT/"
echo "Threat Pulse:      http://localhost:$PORT/tools/threat-pulse/dist/"
echo "Log Explorer:      http://localhost:$PORT/tools/log-explorer/dist/"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
