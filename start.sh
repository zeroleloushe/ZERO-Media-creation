#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then
  echo "Нужен Node.js 20+ — https://nodejs.org"
  exit 1
fi
if [[ ! -d node_modules ]]; then
  echo "Ставлю зависимости…"
  npm install
fi
echo
echo "Панель:  http://127.0.0.1:8080"
echo "Comfy:   сама подключится к http://127.0.0.1:8188"
echo
exec npm run dev
