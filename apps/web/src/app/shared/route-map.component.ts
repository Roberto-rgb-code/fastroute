import { DecimalPipe } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { mapboxgl, MAPBOX_GL_FALLBACK_STYLE, MapService } from '../core/map.service';
import { IconComponent } from './icon.component';

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  color: string;
  index: number;
}

type MapMode = '2d' | '3d' | 'satellite';

/** Guadalajara — demo por defecto. */
const DEFAULT_CENTER: [number, number] = [-103.3496, 20.6597];

@Component({
  selector: 'app-route-map',
  standalone: true,
  imports: [IconComponent, DecimalPipe],
  template: `
    <div class="relative h-full min-h-[280px] w-full overflow-hidden">
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
      <div class="absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5">
        <div class="flex rounded-lg bg-white/95 p-0.5 shadow-sm">
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
        <div class="flex gap-1.5">
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1 text-[11px] font-semibold shadow-sm"
            [class.bg-brand-600]="trafficOn()"
            [class.text-white]="trafficOn()"
            [class.text-ink-600]="!trafficOn()"
            (click)="toggleTraffic()"
            title="Tráfico en tiempo real"
          >
            <app-icon name="route" [size]="13" class="text-current" /> Tráfico
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1 text-[11px] font-semibold shadow-sm"
            [class.bg-brand-600]="windOn()"
            [class.text-white]="windOn()"
            [class.text-ink-600]="!windOn()"
            (click)="toggleWind()"
            title="Viento en el centro del mapa (Open-Meteo)"
          >
            <app-icon name="wind" [size]="13" class="text-current" /> Viento
          </button>
        </div>
      </div>
      @if (windOn() && windInfo(); as w) {
        <div
          class="wind-flow pointer-events-none absolute inset-0 z-[1]"
          [style.--wind-deg]="windFlowDeg(w.windDir) + 'deg'"
        ></div>
        <div class="absolute bottom-14 left-3 z-10 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/95 px-3 py-2 text-xs font-semibold text-sky-900 shadow-sm backdrop-blur">
          <app-icon name="wind" [size]="16" />
          <span>{{ w.windKmh | number: '1.0-0' }} km/h · {{ windDirLabel(w.windDir) }}</span>
          <span class="font-normal text-sky-700/80">Open-Meteo</span>
        </div>
      }
      @if (loadError()) {
        <div class="absolute inset-x-3 bottom-3 z-10 rounded-lg bg-ink-900/85 px-3 py-2 text-xs text-white">
          {{ loadError() }}
        </div>
      }
      <div #host class="absolute inset-0 h-full w-full"></div>
    </div>
  `,
  styles: [
    ':host{display:block;height:100%;width:100%;min-height:280px}',
    `
      .wind-flow {
        opacity: 0.35;
        background: repeating-linear-gradient(
          var(--wind-deg, 45deg),
          transparent,
          transparent 12px,
          rgba(14, 165, 233, 0.25) 12px,
          rgba(14, 165, 233, 0.25) 14px
        );
        animation: fr-wind-drift 4s linear infinite;
      }
      @keyframes fr-wind-drift {
        from {
          background-position: 0 0;
        }
        to {
          background-position: 80px 80px;
        }
      }
    `,
  ],
})
export class RouteMapComponent implements AfterViewInit, OnDestroy {
  points = input<MapPoint[]>([]);
  private maps = inject(MapService);
  private api = inject(ApiService);
  private zone = inject(NgZone);

  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;

  readonly mode = signal<MapMode>('2d');
  readonly routeMeta = signal<string | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly trafficOn = signal(false);
  readonly windOn = signal(false);
  readonly windInfo = signal<{ windKmh: number; windDir: number | null } | null>(null);

  readonly modes: { id: MapMode; label: string }[] = [
    { id: '2d', label: 'Mapa' },
    { id: '3d', label: '3D' },
    { id: 'satellite', label: 'Satélite' },
  ];

  private map?: mapboxgl.Map;
  private markers: mapboxgl.Marker[] = [];
  private ready = false;
  private drawSeq = 0;
  private baseStyle = MAPBOX_GL_FALLBACK_STYLE;
  private resizeObs?: ResizeObserver;
  private booted = false;
  private drawTimer?: ReturnType<typeof setTimeout>;
  private windMoveHandler?: () => void;
  private windMoveTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const pts = this.points();
      if (!this.ready) return;
      clearTimeout(this.drawTimer);
      this.drawTimer = setTimeout(() => void this.draw(pts), 150);
    });
  }

  async ngAfterViewInit() {
    if (this.booted) return;
    this.booted = true;

    const token = await this.maps.ensureConfig();
    if (!token) {
      this.loadError.set('Configura MAPBOX_ACCESS_TOKEN en .env y reinicia la API.');
      this.host.nativeElement.innerHTML =
        '<div style="height:100%;display:grid;place-items:center;background:#e8eef5;color:#475569;font:600 13px Inter,sans-serif;text-align:center;padding:1rem">Mapbox no configurado</div>';
      return;
    }
    this.baseStyle = this.maps.mapStyleUrl();

    this.resizeObs = new ResizeObserver(() => this.map?.resize());
    this.resizeObs.observe(this.host.nativeElement);
    if (this.host.nativeElement.parentElement) {
      this.resizeObs.observe(this.host.nativeElement.parentElement);
    }

    const pts = untracked(() => this.points());
    const center: [number, number] = pts.length ? [pts[0].lng, pts[0].lat] : DEFAULT_CENTER;
    const zoom = pts.length ? 11 : 10;

    this.zone.runOutsideAngular(() => {
      this.map = this.maps.createMap(this.host.nativeElement, center, zoom);
      this.map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');
      this.map.on('error', (ev) => {
        const msg = String(ev.error?.message ?? ev.error ?? 'Error de Mapbox');
        this.zone.run(() => this.loadError.set(msg));
      });
      this.map.on('load', () => {
        this.ready = true;
        this.map?.resize();
        this.zone.run(() => void this.draw(this.points()));
        if (!pts.length) {
          this.map?.flyTo({ center: DEFAULT_CENTER, zoom: 10, duration: 0 });
        }
      });
    });

    setTimeout(() => this.map?.resize(), 100);
    setTimeout(() => this.map?.resize(), 500);
  }

  setMode(m: MapMode) {
    this.mode.set(m);
    const map = this.map;
    if (!map) return;
    if (m === 'satellite') {
      map.setStyle('mapbox://styles/mapbox/satellite-streets-v12');
      map.once('style.load', () => {
        map.resize();
        this.reapplyOverlays();
        void this.draw(this.points());
      });
      return;
    }
    const style = map.getStyle()?.sprite ?? '';
    if (style.includes('satellite')) {
      map.setStyle(this.baseStyle);
      map.once('style.load', () => {
        map.resize();
        this.applyCamera(m);
        this.reapplyOverlays();
        void this.draw(this.points());
      });
      return;
    }
    this.applyCamera(m);
  }

  toggleTraffic() {
    if (!this.map) return;
    this.trafficOn.update((v) => !v);
    this.maps.setTraffic(this.map, this.trafficOn());
  }

  toggleWind() {
    if (!this.map) return;
    const next = !this.windOn();
    if (!next) {
      this.windOn.set(false);
      this.windInfo.set(null);
      this.detachWindMove();
      this.maps.clearWindGfs(this.map);
      return;
    }
    this.windOn.set(true);
    this.maps.clearWindGfs(this.map);
    void this.refreshWind();
    this.attachWindMove();
  }

  private attachWindMove() {
    if (!this.map || this.windMoveHandler) return;
    this.windMoveHandler = () => {
      clearTimeout(this.windMoveTimer);
      this.windMoveTimer = setTimeout(() => void this.refreshWind(), 800);
    };
    this.map.on('moveend', this.windMoveHandler);
  }

  private detachWindMove() {
    if (this.map && this.windMoveHandler) {
      this.map.off('moveend', this.windMoveHandler);
    }
    this.windMoveHandler = undefined;
    clearTimeout(this.windMoveTimer);
  }

  private async refreshWind() {
    if (!this.map || !this.windOn()) return;
    const pts = this.points();
    const lat = pts.length ? pts[0].lat : this.map.getCenter().lat;
    const lng = pts.length ? pts[0].lng : this.map.getCenter().lng;
    try {
      const w = await firstValueFrom(this.api.weather(lat, lng));
      this.windInfo.set({ windKmh: w.now.windKmh ?? 0, windDir: w.now.windDir });
      this.loadError.set(null);
    } catch {
      this.loadError.set('No se pudo cargar el viento (Open-Meteo).');
      this.windOn.set(false);
      this.windInfo.set(null);
      this.detachWindMove();
    }
  }

  windFlowDeg(dir: number | null): number {
    if (dir == null) return 45;
    return (dir + 180) % 360;
  }

  windDirLabel(dir: number | null): string {
    if (dir == null) return '—';
    const labels = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    const i = Math.round(dir / 45) % 8;
    return labels[i];
  }

  /** Re-pinta las capas overlay tras un cambio de estilo (setStyle las borra). */
  private reapplyOverlays() {
    if (!this.map) return;
    this.maps.clearWindGfs(this.map);
    if (this.trafficOn()) this.maps.setTraffic(this.map, true);
    if (this.windOn()) void this.refreshWind();
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
    map.resize();
    this.applyCamera(this.mode());
  }

  ngOnDestroy() {
    clearTimeout(this.drawTimer);
    this.detachWindMove();
    this.resizeObs?.disconnect();
    this.markers.forEach((m) => m.remove());
    this.map?.remove();
    this.map = undefined;
  }
}
