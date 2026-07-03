#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-5174}"

echo "Starting JobKorea Vibe at http://${HOST}:${PORT}"
HOST="$HOST" PORT="$PORT" python3 server.py
