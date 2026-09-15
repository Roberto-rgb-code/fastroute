#!/usr/bin/env python3
"""Geocoding gratis con geopy + Nominatim (OpenStreetMap).

Lee JSON por stdin y escribe JSON por stdout.
No usa Mapbox ni GCP.

Entrada:
  {"action":"forward","query":"Av. López Mateos 123, Guadalajara","country":"mx"}
  {"action":"reverse","lat":20.67,"lng":-103.35}

Salida:
  {"ok":true,"lat":...,"lng":...,"displayName":"...","raw":{...}}
  {"ok":false,"error":"..."}
"""
from __future__ import annotations

import json
import sys

from geopy.exc import GeocoderServiceError, GeocoderTimedOut, GeocoderUnavailable
from geopy.geocoders import Nominatim

USER_AGENT = "FastRoute/1.0 (logistics; geopy-nominatim; contact=ops@fastroute.local)"


def fail(msg: str, code: int = 1) -> None:
    print(json.dumps({"ok": False, "error": msg}, ensure_ascii=False))
    sys.exit(code)


def ok(payload: dict) -> None:
    print(json.dumps({"ok": True, **payload}, ensure_ascii=False))
    sys.exit(0)


def main() -> None:
    try:
        raw = sys.stdin.read() or "{}"
        data = json.loads(raw)
    except json.JSONDecodeError:
        fail("JSON inválido en stdin")

    action = (data.get("action") or "forward").strip().lower()
    geolocator = Nominatim(user_agent=USER_AGENT, timeout=12)

    try:
        if action == "forward":
            query = (data.get("query") or "").strip()
            if not query:
                fail("query requerida")
            country = (data.get("country") or "mx").strip().lower() or None
            loc = geolocator.geocode(
                query,
                exactly_one=True,
                addressdetails=True,
                language="es",
                country_codes=country,
            )
            if not loc:
                fail("No se encontró la dirección", 0)
            ok(
                {
                    "lat": float(loc.latitude),
                    "lng": float(loc.longitude),
                    "displayName": loc.address,
                    "provider": "nominatim",
                    "raw": getattr(loc, "raw", None),
                }
            )

        if action == "reverse":
            lat = data.get("lat")
            lng = data.get("lng")
            if lat is None or lng is None:
                fail("lat y lng requeridos")
            loc = geolocator.reverse(
                (float(lat), float(lng)),
                exactly_one=True,
                addressdetails=True,
                language="es",
            )
            if not loc:
                fail("No se encontró dirección para esas coordenadas", 0)
            ok(
                {
                    "lat": float(loc.latitude),
                    "lng": float(loc.longitude),
                    "displayName": loc.address,
                    "provider": "nominatim",
                    "raw": getattr(loc, "raw", None),
                }
            )

        fail(f"action desconocida: {action}")
    except (GeocoderTimedOut, GeocoderUnavailable, GeocoderServiceError) as exc:
        fail(f"Nominatim no disponible: {exc}")
    except Exception as exc:  # noqa: BLE001
        fail(str(exc))


if __name__ == "__main__":
    main()
