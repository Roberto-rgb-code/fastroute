#!/usr/bin/env bash
# Prueba E2E del chat por ruta: admin (web) ↔ conductor (mobile) vía API.
set -euo pipefail
API="${API:-http://localhost:3000/api/v1}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@demo-logistica.local}"
ADMIN_PASS="${ADMIN_PASS:-Admin123!}"
DRIVER_EMAIL="${DRIVER_EMAIL:-conductor@demo-logistica.local}"
DRIVER_PASS="${DRIVER_PASS:-Driver123!}"

login() {
  local email="$1" pass="$2"
  curl -sf -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$pass\"}" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).accessToken))"
}

TOKEN_ADMIN=$(login "$ADMIN_EMAIL" "$ADMIN_PASS")
TOKEN_DRIVER=$(login "$DRIVER_EMAIL" "$DRIVER_PASS")

ROUTE_ID=$(curl -sf "$API/routes/mine" -H "Authorization: Bearer $TOKEN_DRIVER" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log(r[0]?.id||'')})")

if [ -z "$ROUTE_ID" ]; then
  echo "FAIL: el conductor no tiene rutas asignadas (seed o asignación)"
  exit 1
fi

echo "Route: $ROUTE_ID"

ADMIN_MSG="E2E admin $(date +%s)"
DRIVER_MSG="E2E driver $(date +%s)"

curl -sf -X POST "$API/routes/$ROUTE_ID/messages" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H 'Content-Type: application/json' \
  -d "{\"body\":\"$ADMIN_MSG\"}" >/dev/null

curl -sf -X POST "$API/routes/$ROUTE_ID/messages" \
  -H "Authorization: Bearer $TOKEN_DRIVER" \
  -H 'Content-Type: application/json' \
  -d "{\"body\":\"$DRIVER_MSG\"}" >/dev/null

LIST=$(curl -sf "$API/routes/$ROUTE_ID/messages" -H "Authorization: Bearer $TOKEN_ADMIN")

node -e "
const list = JSON.parse(process.argv[1]);
const a = list.some(m => m.body === process.argv[2] && m.sender === 'ADMIN');
const d = list.some(m => m.body === process.argv[3] && m.sender === 'DRIVER');
if (!a || !d) {
  console.error('FAIL: mensajes no encontrados', { admin: a, driver: d, count: list.length });
  process.exit(1);
}
console.log('OK: chat E2E —', list.length, 'mensajes en hilo, admin y driver presentes');
" "$LIST" "$ADMIN_MSG" "$DRIVER_MSG"

PUSHER_KEY=$(curl -sf "$API/config/client" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).pusher?.key||''))")
if [ -n "$PUSHER_KEY" ]; then
  echo "OK: Pusher key configurada (realtime web/mobile)"
else
  echo "WARN: Pusher sin key — chat funciona por HTTP; configura PUSHER_* en .env"
fi
