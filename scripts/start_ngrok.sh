#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
source "$ROOT_DIR/scripts/python_env.sh"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-5174}"
ensure_python_env "$ROOT_DIR"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok is not installed. Install it first, then run this script again."
  echo "After login/setup: ngrok config add-authtoken <your-token>"
  exit 1
fi

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

HOST="$HOST" PORT="$PORT" "$PYTHON_BIN" server.py &
SERVER_PID="$!"
sleep 1

echo "Local server: http://${HOST}:${PORT}"
echo "ngrok will print the public Forwarding URL below."
ngrok http "http://${HOST}:${PORT}"
