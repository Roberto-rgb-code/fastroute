#!/usr/bin/env bash
# FastRoute QA — same gates as Jenkins CI
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> [1/5] npm ci (workspaces)"
if [[ -f package-lock.json ]]; then
  npm ci --ignore-scripts
else
  npm install --ignore-scripts
fi

echo "==> [2/5] Prisma generate"
npm run prisma:generate

echo "==> [3/5] Typecheck API"
npm run typecheck:api

echo "==> [4/5] Jest unit tests (API + web)"
npm run test:ci

echo "==> [5/5] Production builds"
npm run build:api
npm run build:web

echo ""
echo "QA OK — API/web tests + builds passed."
