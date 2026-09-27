#!/usr/bin/env bash
set -euo pipefail

export PATH="${HOME}/.local/bin:${PATH}"

if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="${HOME}/.local/bin:${PATH}"
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ ! -f "${ROOT}/backend/.env" ]]; then
  cp "${ROOT}/backend/.env.example" "${ROOT}/backend/.env"
fi

if [[ ! -f "${ROOT}/web/.env" ]]; then
  cp "${ROOT}/web/.env.example" "${ROOT}/web/.env"
fi

cd "${ROOT}/backend"
uv sync --extra dev

cd "${ROOT}/web"
npm ci

cd "${ROOT}/backend"
uv run python -m scripts.demo_data
