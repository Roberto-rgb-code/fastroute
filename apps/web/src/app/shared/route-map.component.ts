import { Component, ElementRef, OnDestroy, OnInit, ViewChild, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as L from 'leaflet';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { ApiService } from '../core/api.service';

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  color: string;
  index: number;
}

let googleConfigured = false;

/** Mapa de ruta: Google Maps JS SDK si hay API key; si no, teselas OSM para que se vea igual. */
@Component({
  selector: 'app-route-map',
  standalone: true,
  template: `
    <div class="relative h-full w-full min-h-[280px]">
      <div #host class="h-full w-full"></div>
      <span class="pointer-events-none absolute left-3 top-3 z-[500] rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink-700 shadow-sm">
        {{ engine() === 'google' ? 'Google Maps' : 'Mapa' }}
      </span>
    </div>
  `,
  styles: [':host{display:block;height:100%;width:100%}'],
})
export class RouteMapComponent implements OnInit, OnDestroy {
  points = input<MapPoint[]>([]);
  private api = inject(ApiService);

  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;

  readonly engine = signal<'google' | 'osm'>('osm');
  private leaflet?: L.Map;
  private markers: L.Marker[] = [];
  private line?: L.Polyline;
  private gmap?: google.maps.Map;
  private gmarkers: google.maps.Marker[] = [];
  private gline?: google.maps.Polyline;
  private ready = false;

  constructor() {
    effect(() => {
      const pts = this.points();
      if (this.ready) this.draw(pts);
    });
  }

  async ngOnInit() {
    const cfg = await firstValueFrom(this.api.clientConfig()).catch(() => null);
    const key = cfg?.googleMaps?.apiKey?.trim();
    if (key && (await this.mountGoogle(key))) return;
    this.mountOsm();
  }

  private async mountGoogle(key: string): Promise<boolean> {
    try {
      if (!googleConfigured) {
        setOptions({ key, v: 'weekly', language: 'es', region: 'MX' });
        googleConfigured = true;
      }
      await importLibrary('maps');
      this.gmap = new google.maps.Map(this.host.nativeElement, {
        center: { lat: 19.4326, lng: -99.1332 },
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      this.engine.set('google');
      this.ready = true;
      this.draw(this.points());
      return true;
    } catch {
      return false;
    }
  }

  private mountOsm() {
    this.leaflet = L.map(this.host.nativeElement, { zoomControl: true }).setView([19.4326, -99.1332], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.leaflet);
    this.engine.set('osm');
    this.ready = true;
    this.draw(this.points());
    setTimeout(() => this.leaflet?.invalidateSize(), 80);
  }

  private draw(pts: MapPoint[]) {
    if (this.gmap) this.drawGoogle(pts);
    else if (this.leaflet) this.drawOsm(pts);
  }

  private drawOsm(pts: MapPoint[]) {
    const map = this.leaflet;
    if (!map) return;
    this.markers.forEach((m) => m.remove());
    this.line?.remove();
    this.markers = pts.map((p) => {
      const icon = L.divIcon({
        className: '',
        html: `<span style="display:grid;place-items:center;width:26px;height:26px;border-radius:50% 50% 50% 0;background:${p.color};color:#fff;font-weight:700;font-size:11px;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"><b style="transform:rotate(45deg)">${p.index}</b></span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 24],
      });
      return L.marker([p.lat, p.lng], { icon }).bindPopup(p.label).addTo(map);
    });
    if (pts.length > 1) {
      this.line = L.polyline(
        pts.map((p) => [p.lat, p.lng] as [number, number]),
        { color: '#4f46e5', weight: 4 },
      ).addTo(map);
    }
    if (pts.length) map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 14 });
    setTimeout(() => map.invalidateSize(), 60);
  }

  private drawGoogle(pts: MapPoint[]) {
    const map = this.gmap;
    if (!map) return;
    this.gmarkers.forEach((m) => m.setMap(null));
    this.gline?.setMap(null);
    this.gmarkers = pts.map(
      (p) =>
        new google.maps.Marker({
          map,
          position: { lat: p.lat, lng: p.lng },
          title: p.label,
          label: { text: String(p.index), color: '#fff', fontWeight: '700' },
        }),
    );
    if (pts.length > 1) {
      this.gline = new google.maps.Polyline({
        map,
        path: pts.map((p) => ({ lat: p.lat, lng: p.lng })),
        strokeColor: '#4f46e5',
        strokeWeight: 4,
      });
    }
    if (pts.length) {
      const bounds = new google.maps.LatLngBounds();
      pts.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      map.fitBounds(bounds, 48);
    }
  }

  ngOnDestroy() {
    this.leaflet?.remove();
    this.gmap = undefined;
  }
}
