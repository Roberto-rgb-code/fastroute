#!/usr/bin/env bash
# Stable Android emulator for FastRoute mobile dev (macOS).
set -euo pipefail

AVD="${ANDROID_AVD:-Medium_Phone_API_36.1}"
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
EMU="$SDK/emulator/emulator"
ADB="$SDK/platform-tools/adb"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GUI_LAUNCHER="$ROOT/scripts/start-android-emulator.command"
LOG="${FASTROUTE_ANDROID_LOG:-/tmp/fastroute-android-emulator.log}"
EXPO_URL="${EXPO_ANDROID_URL:-exp://10.0.2.2:8082}"
EXPO_APK="${EXPO_GO_APK:-$HOME/.expo/android-apk-cache/Expo-Go-2.33.22.apk}"

emu_running() {
  pgrep -f "qemu-system" >/dev/null 2>&1
}

device_ready() {
  "$ADB" devices 2>/dev/null | grep -q "emulator-5554[[:space:]]*device" \
    && [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]
}

# Abre el emulador en Terminal.app (sesión gráfica). Evita cierres por falta de ventana.
start_gui() {
  if device_ready; then
    echo "Emulador ya listo."
    return 0
  fi
  if emu_running; then
    echo "Emulador arrancando (espera boot)..."
    return 0
  fi
  chmod +x "$GUI_LAUNCHER"
  echo "Abriendo emulador en Terminal (mantén esa ventana abierta)..."
  open "$GUI_LAUNCHER"
}

wait_boot() {
  local max="${1:-180}"
  for i in $(seq 1 "$max"); do
    if device_ready; then
      echo "Android listo (~$((i * 2))s)."
      return 0
    fi
    sleep 2
  done
  echo "Timeout esperando boot. ¿Terminal del emulador sigue abierta? tail -f $LOG" >&2
  return 1
}

ensure_expo_go() {
  if "$ADB" shell pm path host.exp.exponent 2>/dev/null | grep -q package; then
    return 0
  fi
  if [ ! -f "$EXPO_APK" ]; then
    echo "Falta Expo Go APK: $EXPO_APK" >&2
    return 1
  fi
  echo "Instalando Expo Go..."
  "$ADB" install -r -d "$EXPO_APK"
}

open_app() {
  "$ADB" shell am start -a android.intent.action.VIEW -d "$EXPO_URL" >/dev/null
  echo "Abierto: $EXPO_URL"
}

open_physical() {
  echo "Dispositivo físico: redirige puertos y abre Expo en LAN."
  "$ADB" wait-for-device
  "$ADB" reverse tcp:8082 tcp:8082
  "$ADB" reverse tcp:3000 tcp:3000
  local ip
  ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "TU_IP_LAN")
  echo "En el teléfono (Expo Go), si hace falta usa: exp://${ip}:8082"
  echo "API en el teléfono: http://${ip}:3000/api/v1 (configura extra en app.json si usas build propio)"
}

cmd="${1:-start}"
case "$cmd" in
  start)
    start_gui
    wait_boot 180
    ensure_expo_go || true
    open_app
    "$ADB" devices -l
    ;;
  gui)
    start_gui
    ;;
  restart)
    if device_ready; then
      open_app
      exit 0
    fi
    start_gui
    wait_boot 180
    ensure_expo_go || true
    open_app
    ;;
  open)
    device_ready || { echo "Emulador no listo. Ejecuta: $0 start" >&2; exit 1; }
    open_app
    ;;
  physical)
    open_physical
    ;;
  status)
    echo "AVD=$AVD"
    emu_running && echo "qemu: running" || echo "qemu: stopped"
    "$ADB" devices -l
    curl -s -o /dev/null -w "metro:8082 HTTP %{http_code}\n" http://localhost:8082/ 2>/dev/null || echo "metro: down"
    ;;
  watchdog)
    echo "Watchdog: solo reabre la app si adb sigue vivo (no relanza emulador en background)."
    echo "Si se cierra la ventana del emulador, vuelve a ejecutar: npm run dev:android"
    while true; do
      if device_ready; then
        if ! "$ADB" shell pidof host.exp.exponent >/dev/null 2>&1; then
          open_app || true
        fi
      else
        echo "[$(date +%H:%M:%S)] Sin emulador — abre Terminal con: open scripts/start-android-emulator.command"
        sleep 60
      fi
      sleep 25
    done
    ;;
  *)
    echo "Uso: $0 {start|gui|restart|open|physical|status|watchdog}" >&2
    exit 1
    ;;
esac
