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
  private readonly directionsCache = new Map<string, DirectionsResult>();

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
    if (coords.length > 12) return null;

    const key = coords.map((c) => `${c[0].toFixed(5)},${c[1].toFixed(5)}`).join('|');
    const cached = this.directionsCache.get(key);
    if (cached) return cached;

    const path = coords.map((c) => `${c[0]},${c[1]}`).join(';');
    const profile = coords.length > 6 ? 'driving' : 'driving-traffic';
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${path}` +
      `?geometries=geojson&overview=full&annotations=duration,distance&access_token=${token}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      const route = json.routes?.[0];
      if (!route?.geometry?.coordinates?.length) return null;
      const result: DirectionsResult = {
        coordinates: route.geometry.coordinates as [number, number][],
        distanceM: route.distance ?? 0,
        durationS: route.duration ?? 0,
      };
      this.directionsCache.set(key, result);
      return result;
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

  // ── Tráfico en tiempo real (Mapbox Traffic v1) ────────────────────────────
  /** @see https://docs.mapbox.com/data/tilesets/reference/mapbox-traffic-v1/ */
  setTraffic(map: mapboxgl.Map, on: boolean) {
    const SRC = 'fr-traffic';
    const LYR = 'fr-traffic-line';
    if (!on) {
      if (map.getLayer(LYR)) map.removeLayer(LYR);
      if (map.getSource(SRC)) map.removeSource(SRC);
      return;
    }
    if (!map.getSource(SRC)) {
      map.addSource(SRC, { type: 'vector', url: 'mapbox://mapbox.mapbox-traffic-v1' });
    }
    if (!map.getLayer(LYR)) {
      map.addLayer({
        id: LYR,
        type: 'line',
        source: SRC,
        'source-layer': 'traffic',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 14, 4, 18, 8],
          'line-color': [
            'match',
            ['get', 'congestion'],
            'low', '#22c55e',
            'moderate', '#f59e0b',
            'heavy', '#ef4444',
            'severe', '#991b1b',
            '#94a3b8',
          ],
        },
      });
    }
  }

  // ── Viento GFS (raster-particle) — demo Mapbox ─────────────────────────────
  /** @see https://docs.mapbox.com/mapbox-gl-js/example/raster-particle-layer/ */
  private static readonly GFS_WIND_TILESET = 'mapbox://rasterarrayexamples.gfs-winds';

  private static readonly GFS_PARTICLE_PAINT: Record<string, unknown> = {
    'raster-particle-speed-factor': 0.4,
    'raster-particle-fade-opacity-factor': 0.9,
    'raster-particle-reset-rate-factor': 0.4,
    'raster-particle-count': 2800,
    'raster-particle-max-speed': 40,
    'raster-particle-color': [
      'interpolate',
      ['linear'],
      ['raster-particle-speed'],
      1.5,
      'rgba(134,163,171,256)',
      2.5,
      'rgba(126,152,188,256)',
      4.12,
      'rgba(110,143,208,256)',
      6.17,
      'rgba(15,147,167,256)',
      9.26,
      'rgba(57,163,57,256)',
      11.83,
      'rgba(194,134,62,256)',
      14.92,
      'rgba(200,66,13,256)',
      18.0,
      'rgba(210,0,50,256)',
      25.21,
      'rgba(117,74,147,256)',
      33.44,
      'rgba(194,251,119,256)',
      50.41,
      'rgba(256,256,256,256)',
    ],
  };

  /** Comprueba si el token puede leer al menos un tile MRT del ejemplo GFS. */
  async probeGfsWindAccess(): Promise<boolean> {
    const token = this.token();
    if (!token) return false;
    try {
      const metaRes = await fetch(
        `https://api.mapbox.com/v4/rasterarrayexamples.gfs-winds.json?access_token=${token}`,
      );
      if (!metaRes.ok) return false;
      const meta = (await metaRes.json()) as {
        raster_layers?: { fields?: { current_job_id?: string } }[];
      };
      const jobid = meta.raster_layers?.[0]?.fields?.current_job_id;
      if (!jobid) return false;
      const tileRes = await fetch(
        `https://api.mapbox.com/rasterarrays/v1/rasterarrayexamples.gfs-winds/2/1/1.mrt?jobid=${jobid}&access_token=${token}`,
      );
      return tileRes.ok;
    } catch {
      return false;
    }
  }

  setWind(map: mapboxgl.Map, on: boolean, beforeLayerId?: string): void {
    const SRC = 'fr-wind';
    const LYR = 'fr-wind-particles';
    if (!on) {
      this.clearWindGfs(map);
      return;
    }
    const add = () => {
      if (!map.getSource(SRC)) {
        map.addSource(SRC, {
          type: 'raster-array',
          url: MapService.GFS_WIND_TILESET,
          tileSize: 512,
        } as mapboxgl.RasterArraySourceSpecification);
      }
      if (!map.getLayer(LYR)) {
        const spec = {
          id: LYR,
          type: 'raster-particle',
          source: SRC,
          'source-layer': '10winds',
          paint: MapService.GFS_PARTICLE_PAINT,
        } as mapboxgl.LayerSpecification;
        if (beforeLayerId && map.getLayer(beforeLayerId)) {
          map.addLayer(spec, beforeLayerId);
        } else {
          map.addLayer(spec);
        }
      }
    };
    if (!map.isStyleLoaded()) {
      map.once('idle', add);
      return;
    }
    add();
  }

  clearWindGfs(map: mapboxgl.Map) {
    const SRC = 'fr-wind';
    const LYR = 'fr-wind-particles';
    if (map.getLayer(LYR)) map.removeLayer(LYR);
    if (map.getSource(SRC)) map.removeSource(SRC);
  }
}
