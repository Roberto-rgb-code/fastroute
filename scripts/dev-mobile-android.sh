#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/ 2>/dev/null | grep -q 200; then
  echo "Iniciando Metro en :8082..."
  cd apps/mobile
  nohup npx expo start --port 8082 >> /tmp/fastroute-expo.log 2>&1 &
  disown 2>/dev/null || true
  cd "$ROOT"
  for _ in $(seq 1 30); do
    curl -s -o /dev/null http://localhost:8082/ && break
    sleep 2
  done
fi

chmod +x "$ROOT/scripts/android-emulator.sh" "$ROOT/scripts/start-android-emulator.command"
"$ROOT/scripts/android-emulator.sh" start

echo ""
echo "Si el emulador se cierra: NO uses pkill. Abre solo:"
echo "  open scripts/start-android-emulator.command"
echo "Alternativa estable: teléfono USB → ./scripts/android-emulator.sh physical"
