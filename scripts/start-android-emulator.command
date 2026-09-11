#!/bin/bash
# Doble clic o `open scripts/start-android-emulator.command` — emulador en sesión gráfica (no se cierra solo).
set -euo pipefail
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
AVD="${ANDROID_AVD:-Medium_Phone_API_36.1}"
LOG="${FASTROUTE_ANDROID_LOG:-/tmp/fastroute-android-emulator.log}"

echo "FastRoute — Android ($AVD)"
echo "Log: $LOG"
echo "Cierra esta ventana solo cuando termines (Cmd+W)."

exec "$ANDROID_HOME/emulator/emulator" -avd "$AVD" \
  -gpu auto \
  -no-snapshot-save \
  2>&1 | tee -a "$LOG"
