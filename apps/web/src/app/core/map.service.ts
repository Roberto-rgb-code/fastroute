import { Injectable, signal } from '@angular/core';
import { mapboxgl, waitForMapboxGl } from './mapbox-init';
import type { ClientConfig } from './models';

export type MapboxMap = mapboxgl.Map;
export type MapboxMarker = mapboxgl.Marker;
export type MapboxPopup = mapboxgl.Popup;
export type MapboxLngLatBounds = mapboxgl.LngLatBounds;
export type MapboxGeoJSONSource = mapboxgl.GeoJSONSource;
export { mapboxgl };

export interface DirectionsResult {
  coordinates: [number, number][];
  distanceM: number;
  durationS: number;
}

/** Estilo que siempre pinta tiles en mapbox-gl. */
export const MAPBOX_GL_FALLBACK_STYLE = 'mapbox://styles/mapbox/streets-v12';

/**
 * Mapbox GL + Directions. Token y estilo vienen de /config/client.
 * @see https://docs.mapbox.com/mapbox-gl-js/guides/
 */
@Injectable({ providedIn: 'root' })
export class MapService {
  readonly token = signal<string | null>(null);
  readonly styleUrl = signal(MAPBOX_GL_FALLBACK_STYLE);
  readonly mapStyleUrl = signal(MAPBOX_GL_FALLBACK_STYLE);
  private loaded = false;

  async ensureConfig(): Promise<string | null> {
    if (this.loaded && this.token()) return this.token();

    try {
      await waitForMapboxGl();
      const cfg = await this.fetchClientConfig();
      const t = cfg.mapbox?.token?.trim() || null;
      this.token.set(t);
      const preferred = cfg.mapbox?.styleUrl?.trim() || MAPBOX_GL_FALLBACK_STYLE;
      this.styleUrl.set(preferred);
      this.mapStyleUrl.set(this.resolveGlStyle(preferred));
      if (t) mapboxgl.accessToken = t;
      this.loaded = true;
    } catch (e) {
      console.warn('[MapService] Mapbox config', e);
      this.token.set(null);
    }

    return this.token();
  }

  /** Misma URL que ApiService; fetch evita race con interceptors al arrancar. */
  private async fetchClientConfig(): Promise<ClientConfig> {
    const res = await fetch('/api/v1/config/client', { credentials: 'same-origin' });
    if (!res.ok) {
      throw new Error(`config/client ${res.status}`);
    }
    return res.json() as Promise<ClientConfig>;
  }

  resolveGlStyle(preferred: string): string {
    if (/^mapbox:\/\/styles\/mapbox\//i.test(preferred)) return preferred;
    return MAPBOX_GL_FALLBACK_STYLE;
  }

  get hasToken(): boolean {
    return !!this.token();
  }

  createMap(
    container: HTMLElement,
    center: [number, number],
    zoom = 11,
    opts: { pitch?: number; bearing?: number; style?: string } = {},
  ): mapboxgl.Map {
    const token = this.token();
    if (!token) {
      throw new Error('Mapbox access token missing — configura MAPBOX_ACCESS_TOKEN en .env');
    }

    const style = opts.style ?? this.mapStyleUrl();
    const map = new mapboxgl.Map({
      accessToken: token,
      container,
      style,
      center,
      zoom,
      pitch: opts.pitch ?? 0,
      bearing: opts.bearing ?? 0,
      attributionControl: true,
      failIfMajorPerformanceCaveat: false,
    });

    let fellBack = false;
    map.on('error', (ev: mapboxgl.ErrorEvent) => {
      const msg = String(ev.error?.message ?? ev.error ?? '');
      if (fellBack || !msg) return;
      if (/style|sprite|glyph|tile|401|403|worker/i.test(msg)) {
        fellBack = true;
        map.setStyle(MAPBOX_GL_FALLBACK_STYLE);
      }
    });

    map.once('load', () => {
      requestAnimationFrame(() => map.resize());
    });

    return map;
  }

  fitToStops(map: mapboxgl.Map, stops: { lat: number; lng: number }[], padding = 60) {
    if (!stops.length) return;
    const bounds = new mapboxgl.LngLatBounds();
    stops.forEach((s) => bounds.extend([s.lng, s.lat]));
    map.fitBounds(bounds, { padding, maxZoom: 14 });
  }

  numberedMarker(index: number, color: string): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = `width:28px;height:28px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);display:grid;place-items:center;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid #fff`;
    const inner = document.createElement('span');
    inner.textContent = String(index);
    inner.style.cssText = 'transform:rotate(45deg);color:#fff;font-weight:700;font-size:12px';
    el.appendChild(inner);
    return el;
  }

  vehicleMarker(): HTMLElement {
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="position:relative;width:44px;height:44px">
        <span style="position:absolute;inset:0;border-radius:50%;background:rgba(37,99,235,.35);animation:frPulse 1.6s ease-out infinite"></span>
        <span style="position:absolute;inset:8px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:grid;place-items:center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l4 20-4-3-4 3z"/></svg>
        </span>
      </div>
      <style>@keyframes frPulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(1.5);opacity:0}}</style>`;
    return el;
  }

  async fetchDirections(coords: [number, number][]): Promise<DirectionsResult | null> {
    const token = this.token();
    if (!token || coords.length < 2) return null;
    const path = coords.map((c) => `${c[0]},${c[1]}`).join(';');
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${path}` +
      `?geometries=geojson&overview=full&annotations=duration,distance&access_token=${token}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      const route = json.routes?.[0];
      if (!route?.geometry?.coordinates?.length) return null;
      return {
        coordinates: route.geometry.coordinates as [number, number][],
        distanceM: route.distance ?? 0,
        durationS: route.duration ?? 0,
      };
    } catch {
      return null;
    }
  }

  setRouteLine(map: mapboxgl.Map, coordinates: [number, number][], sourceId = 'fr-route') {
    const data = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates },
    };
    const src = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(data);
      return;
    }
    map.addSource(sourceId, { type: 'geojson', data });
    map.addLayer({
      id: `${sourceId}-halo`,
      type: 'line',
      source: sourceId,
      paint: { 'line-color': '#93c5fd', 'line-width': 10, 'line-opacity': 0.45 },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
    map.addLayer({
      id: sourceId,
      type: 'line',
      source: sourceId,
      paint: { 'line-color': '#2563eb', 'line-width': 5, 'line-opacity': 0.95 },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
  }

  clearRouteLine(map: mapboxgl.Map, sourceId = 'fr-route') {
    if (map.getLayer(sourceId)) map.removeLayer(sourceId);
    if (map.getLayer(`${sourceId}-halo`)) map.removeLayer(`${sourceId}-halo`);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  }
}
