import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import mapboxgl from 'mapbox-gl';
import { MapService } from '../core/map.service';

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  color: string;
  index: number;
}

type MapMode = '2d' | '3d' | 'satellite';

/**
 * Mapa de ruta con Mapbox GL + Directions (estilo custom del proyecto).
 * Controles: 2D / 3D / Satélite.
 */
@Component({
  selector: 'app-route-map',
  standalone: true,
  template: `
    <div class="relative flex h-full min-h-[280px] w-full flex-col">
      <div class="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
        <span class="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink-700 shadow-sm">
          Mapbox
        </span>
        @if (routeMeta()) {
          <span class="rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
            {{ routeMeta() }}
          </span>
        }
      </div>
      <div class="absolute right-3 top-3 z-10 flex rounded-lg bg-white/95 p-0.5 shadow-sm">
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
        <div class="absolute inset-x-3 bottom-3 z-10 rounded-lg bg-ink-900/85 px-3 py-2 text-xs text-white">
          {{ loadError() }}
        </div>
      }
      <div #host class="min-h-0 w-full flex-1"></div>
    </div>
  `,
  styles: [':host{display:block;height:100%;width:100%;min-height:280px}'],
})
export class RouteMapComponent implements OnInit, OnDestroy {
  points = input<MapPoint[]>([]);
  private maps = inject(MapService);

  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;

  readonly mode = signal<MapMode>('2d');
  readonly routeMeta = signal<string | null>(null);
  readonly loadError = signal<string | null>(null);

  readonly modes: { id: MapMode; label: string }[] = [
    { id: '2d', label: 'Mapa' },
    { id: '3d', label: '3D' },
    { id: 'satellite', label: 'Satélite' },
  ];

  private map?: mapboxgl.Map;
  private markers: mapboxgl.Marker[] = [];
  private ready = false;
  private drawSeq = 0;
  private customStyle = '';

  constructor() {
    effect(() => {
      const pts = this.points();
      if (this.ready) void this.draw(pts);
    });
  }

  async ngOnInit() {
    const token = await this.maps.ensureConfig();
    if (!token) {
      this.loadError.set('Configura MAPBOX_ACCESS_TOKEN en .env y reinicia la API.');
      this.host.nativeElement.innerHTML =
        '<div style="height:100%;display:grid;place-items:center;background:#e8eef5;color:#475569;font:600 13px Inter,sans-serif;text-align:center;padding:1rem">Mapbox no configurado</div>';
      return;
    }
    this.customStyle = this.maps.styleUrl();
    const pts = untracked(() => this.points());
    const center: [number, number] = pts.length ? [pts[0].lng, pts[0].lat] : [-99.1332, 19.4326];
    this.map = this.maps.createMap(this.host.nativeElement, center, 11);
    this.map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    this.map.on('load', () => {
      this.ready = true;
      void this.draw(this.points());
    });
  }

  setMode(m: MapMode) {
    this.mode.set(m);
    const map = this.map;
    if (!map) return;
    if (m === 'satellite') {
      map.setStyle('mapbox://styles/mapbox/satellite-streets-v12');
      map.once('style.load', () => void this.draw(this.points()));
      return;
    }
    // Volver al estilo del proyecto
    if (map.getStyle()?.sprite?.includes('satellite') || map.getStyle()?.name?.toLowerCase().includes('satellite')) {
      map.setStyle(this.customStyle || this.maps.styleUrl());
      map.once('style.load', () => {
        this.applyCamera(m);
        void this.draw(this.points());
      });
      return;
    }
    this.applyCamera(m);
  }

  private applyCamera(m: MapMode) {
    const map = this.map;
    if (!map) return;
    if (m === '3d') {
      map.easeTo({ pitch: 55, bearing: 20, duration: 600 });
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
    }
  }

  private async draw(pts: MapPoint[]) {
    const map = this.map;
    if (!map || !this.ready) return;
    const seq = ++this.drawSeq;

    this.markers.forEach((m) => m.remove());
    this.markers = [];
    this.maps.clearRouteLine(map);

    if (!pts.length) {
      this.routeMeta.set(null);
      return;
    }

    const sorted = [...pts].sort((a, b) => a.index - b.index);
    this.markers = sorted.map((p) =>
      new mapboxgl.Marker({ element: this.maps.numberedMarker(p.index, p.color) })
        .setLngLat([p.lng, p.lat])
        .setPopup(new mapboxgl.Popup({ offset: 18 }).setText(p.label))
        .addTo(map),
    );

    const coords: [number, number][] = sorted.map((p) => [p.lng, p.lat]);
    let line = coords;
    if (coords.length >= 2) {
      const dir = await this.maps.fetchDirections(coords);
      if (seq !== this.drawSeq) return;
      if (dir) {
        line = dir.coordinates;
        const km = dir.distanceM / 1000;
        const min = Math.round(dir.durationS / 60);
        this.routeMeta.set(`${km.toFixed(1)} km · ${min} min`);
      } else {
        this.routeMeta.set('Ruta directa');
      }
    } else {
      this.routeMeta.set(null);
    }

    if (seq !== this.drawSeq) return;
    this.maps.setRouteLine(map, line);
    this.maps.fitToStops(
      map,
      sorted.map((p) => ({ lat: p.lat, lng: p.lng })),
      56,
    );
    this.applyCamera(this.mode());
  }

  ngOnDestroy() {
    this.markers.forEach((m) => m.remove());
    this.map?.remove();
    this.map = undefined;
  }
}
