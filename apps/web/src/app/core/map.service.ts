import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import mapboxgl from 'mapbox-gl';
import { ApiService } from './api.service';
import { Stop } from './models';

/**
 * Wraps Mapbox GL. Falls back gracefully to a static placeholder when no token
 * is configured (demo without keys still works).
 */
@Injectable({ providedIn: 'root' })
export class MapService {
  private api = inject(ApiService);
  readonly token = signal<string | null>(null);
  private loaded = false;

  async ensureConfig(): Promise<string | null> {
    if (this.loaded) return this.token();
    try {
      const cfg = await firstValueFrom(this.api.clientConfig());
      const t = cfg.mapbox.token || null;
      this.token.set(t);
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

  createMap(container: HTMLElement, center: [number, number], zoom = 11): mapboxgl.Map {
    return new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/light-v11',
      center,
      zoom,
    });
  }

  fitToStops(map: mapboxgl.Map, stops: { lat: number; lng: number }[]) {
    if (!stops.length) return;
    const bounds = new mapboxgl.LngLatBounds();
    stops.forEach((s) => bounds.extend([s.lng, s.lat]));
    map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
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
}
