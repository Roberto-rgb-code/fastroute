import { Component, ElementRef, OnDestroy, OnInit, ViewChild, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { ApiService } from '../core/api.service';

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  color: string;
  index: number;
}

type MapMode = 'roadmap' | 'satellite' | '3d';

let googleBootstrapped = false;

/**
 * Mapa operativo con Google Maps JavaScript API:
 * - Ruta por calles (Directions API)
 * - Vista satélite / híbrido
 * - Vista 3D (inclinación + mapas 3D cuando el navegador lo soporta)
 */
@Component({
  selector: 'app-route-map',
  standalone: true,
  template: `
    <div class="relative flex h-full min-h-[280px] w-full flex-col">
      <div class="absolute left-3 top-3 z-[500] flex flex-wrap gap-1.5">
        <span class="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink-700 shadow-sm">
          Google Maps
        </span>
        @if (routeMeta()) {
          <span class="rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
            {{ routeMeta() }}
          </span>
        }
      </div>
      <div class="absolute right-3 top-3 z-[500] flex rounded-lg bg-white/95 p-0.5 shadow-sm">
        @for (m of modes; track m.id) {
          <button
            type="button"
            class="rounded-md px-2 py-1 text-[11px] font-semibold"
            [class.bg-brand-600]="mode() === m.id"
            [class.text-white]="mode() === m.id"
            [class.text-ink-600]="mode() !== m.id"
            (click)="setMode(m.id)"
          >
            {{ m.label }}
          </button>
        }
      </div>
      @if (loadError()) {
        <div class="absolute inset-x-3 bottom-3 z-[500] rounded-lg bg-ink-900/85 px-3 py-2 text-xs text-white">
          {{ loadError() }}
        </div>
      }
      <div #host class="min-h-0 flex-1 w-full"></div>
    </div>
  `,
  styles: [':host{display:block;height:100%;width:100%;min-height:280px}'],
})
export class RouteMapComponent implements OnInit, OnDestroy {
  points = input<MapPoint[]>([]);
  private api = inject(ApiService);

  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;

  readonly mode = signal<MapMode>('roadmap');
  readonly routeMeta = signal<string | null>(null);
  readonly loadError = signal<string | null>(null);

  readonly modes: { id: MapMode; label: string }[] = [
    { id: 'roadmap', label: 'Mapa' },
    { id: 'satellite', label: 'Satélite' },
    { id: '3d', label: '3D' },
  ];

  private apiKey = '';
  private map?: google.maps.Map;
  private directionsRenderer?: google.maps.DirectionsRenderer;
  private markers: google.maps.Marker[] = [];
  private fallbackLine?: google.maps.Polyline;
  private ready = false;
  private ro?: ResizeObserver;

  constructor() {
    effect(() => {
      const pts = this.points();
      const m = this.mode();
      if (this.ready && this.map) {
        this.applyMode(m);
        this.draw(pts);
      }
    });
  }

  async ngOnInit() {
    const cfg = await firstValueFrom(this.api.clientConfig()).catch(() => null);
    this.apiKey = cfg?.googleMaps?.apiKey?.trim() ?? '';
    if (!this.apiKey) {
      this.loadError.set('Configura GOOGLE_MAPS_API_KEY en tu .env y reinicia la API (docker compose up -d api).');
      this.renderStaticFallback();
      return;
    }
    try {
      if (!googleBootstrapped) {
        setOptions({ key: this.apiKey, v: 'weekly', language: 'es', region: 'MX' });
        googleBootstrapped = true;
      }
      await importLibrary('maps');
      await importLibrary('routes');
      this.map = new google.maps.Map(this.host.nativeElement, {
        center: { lat: 19.4326, lng: -99.1332 },
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: true,
        fullscreenControl: true,
        gestureHandling: 'greedy',
      });
      this.directionsRenderer = new google.maps.DirectionsRenderer({
        map: this.map,
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#4f46e5', strokeWeight: 5, strokeOpacity: 0.9 },
      });
      this.ready = true;
      this.ro = new ResizeObserver(() => {
        google.maps.event.trigger(this.map!, 'resize');
        this.draw(this.points());
      });
      this.ro.observe(this.host.nativeElement);
      this.applyMode(this.mode());
      this.draw(this.points());
    } catch (e) {
      this.loadError.set('No se pudo cargar Google Maps. Revisa la API key y las APIs Maps/Directions en GCP.');
      this.renderStaticFallback();
    }
  }

  setMode(m: MapMode) {
    this.mode.set(m);
    if (this.ready && this.map) {
      this.applyMode(m);
      this.draw(this.points());
    }
  }

  private applyMode(m: MapMode) {
    const map = this.map;
    if (!map) return;
    if (m === 'satellite') {
      map.setMapTypeId('hybrid');
      map.setTilt(0);
      map.setHeading(0);
      return;
    }
    if (m === '3d') {
      map.setMapTypeId('roadmap');
      map.setTilt(45);
      map.setHeading(20);
      return;
    }
    map.setMapTypeId('roadmap');
    map.setTilt(0);
    map.setHeading(0);
  }

  private draw(pts: MapPoint[]) {
    if (!this.map) return;
    this.clearOverlays();
    if (!pts.length) {
      this.routeMeta.set(null);
      return;
    }
    this.markers = pts.map(
      (p) =>
        new google.maps.Marker({
          map: this.map!,
          position: { lat: p.lat, lng: p.lng },
          title: p.label,
          label: { text: String(p.index), color: '#fff', fontWeight: '700' },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: p.color,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        }),
    );

    if (pts.length >= 2) {
      this.routeDriving(pts);
    } else {
      this.map.setCenter({ lat: pts[0].lat, lng: pts[0].lng });
      this.map.setZoom(14);
    }
  }

  private routeDriving(pts: MapPoint[]) {
    const sorted = [...pts].sort((a, b) => a.index - b.index);
    const origin = { lat: sorted[0].lat, lng: sorted[0].lng };
    const destination = { lat: sorted[sorted.length - 1].lat, lng: sorted[sorted.length - 1].lng };
    const waypoints =
      sorted.length > 2
        ? sorted.slice(1, -1).map((p) => ({
            location: { lat: p.lat, lng: p.lng },
            stopover: true,
          }))
        : [];

    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin,
        destination,
        waypoints,
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING,
        region: 'MX',
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          this.directionsRenderer?.setDirections(result);
          const leg = result.routes[0]?.legs ?? [];
          const km = leg.reduce((a, l) => a + (l.distance?.value ?? 0), 0) / 1000;
          const min = leg.reduce((a, l) => a + (l.duration?.value ?? 0), 0) / 60;
          this.routeMeta.set(`${km.toFixed(1)} km · ${Math.round(min)} min`);
          return;
        }
        this.routeMeta.set('Ruta directa (sin Directions)');
        this.fallbackLine = new google.maps.Polyline({
          map: this.map!,
          path: sorted.map((p) => ({ lat: p.lat, lng: p.lng })),
          strokeColor: '#4f46e5',
          strokeWeight: 4,
        });
        const bounds = new google.maps.LatLngBounds();
        sorted.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        this.map!.fitBounds(bounds, 48);
      },
    );
  }

  private clearOverlays() {
    this.markers.forEach((m) => m.setMap(null));
    this.markers = [];
    if (this.directionsRenderer) {
      this.directionsRenderer.setMap(null);
      this.directionsRenderer.setMap(this.map!);
    }
    this.fallbackLine?.setMap(null);
  }

  /** SVG mínimo si no hay key (sin mensaje Mapbox). */
  private renderStaticFallback() {
    const pts = this.points();
    this.host.nativeElement.innerHTML = `
      <div style="height:100%;display:grid;place-items:center;background:#e8eef5;color:#475569;font:600 13px Inter,sans-serif;text-align:center;padding:1rem">
        Mapa no disponible<br/><span style="font-weight:400;font-size:12px">GOOGLE_MAPS_API_KEY requerida</span>
      </div>`;
    if (pts.length) void pts;
  }

  ngOnDestroy() {
    this.ro?.disconnect();
    this.clearOverlays();
    this.map = undefined;
  }
}
