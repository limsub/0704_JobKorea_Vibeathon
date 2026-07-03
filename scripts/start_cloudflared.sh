#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
source "$ROOT_DIR/scripts/python_env.sh"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-5174}"
ensure_python_env "$ROOT_DIR"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is not installed."
  echo "Install it with: brew install cloudflared"
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
echo "Cloudflare quick tunnel will print a trycloudflare.com URL below."
cloudflared tunnel --url "http://${HOST}:${PORT}" --no-autoupdate
