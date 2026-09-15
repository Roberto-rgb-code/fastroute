import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import mapboxgl from 'mapbox-gl';
import { ApiService } from './api.service';

export interface DirectionsResult {
  coordinates: [number, number][];
  distanceM: number;
  durationS: number;
}

/**
 * Mapbox GL + Directions. Token y estilo vienen de /config/client.
 */
@Injectable({ providedIn: 'root' })
export class MapService {
  private api = inject(ApiService);
  readonly token = signal<string | null>(null);
  readonly styleUrl = signal('mapbox://styles/mapbox/light-v11');
  private loaded = false;

  async ensureConfig(): Promise<string | null> {
    if (this.loaded) return this.token();
    try {
      const cfg = await firstValueFrom(this.api.clientConfig());
      const t = cfg.mapbox?.token?.trim() || null;
      this.token.set(t);
      if (cfg.mapbox?.styleUrl) this.styleUrl.set(cfg.mapbox.styleUrl);
      if (t) mapboxgl.accessToken = t;
    } catch {
      this.token.set(null);
    }
    this.loaded = true;
    return this.token();
  }

  get hasToken(): boolean {
    return !!this.token();
  }

  createMap(
    container: HTMLElement,
    center: [number, number],
    zoom = 11,
    opts: { pitch?: number; bearing?: number } = {},
  ): mapboxgl.Map {
    return new mapboxgl.Map({
      container,
      style: this.styleUrl(),
      center,
      zoom,
      pitch: opts.pitch ?? 0,
      bearing: opts.bearing ?? 0,
      attributionControl: true,
    });
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

  /** Marcador de unidad en vivo (pulso). */
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

  /**
   * Directions API (perfil driving-traffic).
   * coords: [lng, lat][] — máximo ~25 waypoints en free tier práctico.
   */
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
