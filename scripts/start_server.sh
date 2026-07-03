#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
source "$ROOT_DIR/scripts/python_env.sh"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-5174}"
ensure_python_env "$ROOT_DIR"

echo "Starting JobKorea Vibe at http://${HOST}:${PORT}"
HOST="$HOST" PORT="$PORT" "$PYTHON_BIN" server.py
