#!/usr/bin/env bash
set -euo pipefail

ensure_python_env() {
  local root_dir="$1"
  local venv_dir="${root_dir}/.venv"
  local stamp_file="${venv_dir}/.requirements.stamp"

  if [[ ! -x "${venv_dir}/bin/python" ]]; then
    python3 -m venv "$venv_dir"
  fi

  if [[ -f "${root_dir}/requirements.txt" ]]; then
    if [[ ! -f "$stamp_file" || "${root_dir}/requirements.txt" -nt "$stamp_file" ]]; then
      "${venv_dir}/bin/python" -m pip install --upgrade pip >/dev/null
      "${venv_dir}/bin/python" -m pip install -r "${root_dir}/requirements.txt"
      touch "$stamp_file"
    fi
  fi

  PYTHON_BIN="${venv_dir}/bin/python"
}
