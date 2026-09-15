#!/usr/bin/env bash
# FastRoute QA — same gates as Jenkins CI
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> [1/7] npm ci (workspaces)"
if [[ -f package-lock.json ]]; then
  npm ci --ignore-scripts
else
  npm install --ignore-scripts
fi

echo "==> [2/7] Prisma generate"
npm run prisma:generate

echo "==> [3/7] Typecheck API"
npm run typecheck:api

echo "==> [4/7] Typecheck Web"
npm run typecheck:web

echo "==> [5/7] Typecheck Mobile"
npm run typecheck:mobile

echo "==> [6/7] Jest unit tests (API + web)"
npm run test:ci

echo "==> [7/7] Production builds"
npm run build:api
npm run build:web

if [[ -x scripts/e2e-chat.sh ]]; then
  echo "==> [optional] Chat E2E (requires API on :3000)"
  bash scripts/e2e-chat.sh || echo "WARN: e2e-chat skipped/failed"
fi

echo ""
echo "QA OK — API/web tests + builds passed."
