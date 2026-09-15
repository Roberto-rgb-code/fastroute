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
import { WindFieldCell, WindParticleOverlay } from './wind-particle-overlay';

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
/** Estilo tipo demo Mapbox “Wind Speed” (satélite + partículas). */
const WIND_SCENE_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12';

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
            title="Animación de viento (Open-Meteo; la demo Mapbox GFS requiere tileset de pago)"
          >
            <app-icon name="wind" [size]="13" class="text-current" /> Viento
          </button>
        </div>
      </div>
      @if (windOn() && windInfo(); as w) {
        <div class="absolute bottom-14 left-3 z-10 flex max-w-[min(100%,18rem)] flex-col gap-1 rounded-xl border border-sky-200/80 bg-slate-900/75 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur">
          <div class="flex items-center gap-2">
            <app-icon name="wind" [size]="16" />
            <span>{{ w.windKmh | number: '1.0-0' }} km/h · {{ windDirLabel(w.windDir) }}</span>
          </div>
          <span class="text-[10px] font-normal text-sky-100/85">
            @if (windGfs()) {
              GFS Mapbox · raster-particle
            } @else {
              Vivid Open-Meteo (GFS no disponible en este token)
            }
          </span>
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
  styles: [':host{display:block;height:100%;width:100%;min-height:280px}'],
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
  readonly windGfs = signal(false);
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
  private windOverlay?: WindParticleOverlay;
  private windResizeHandler?: () => void;
  private modeBeforeWind: MapMode | null = null;
  private windEnabling = false;

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

    this.resizeObs = new ResizeObserver(() => {
      this.map?.resize();
      this.windOverlay?.resize();
    });
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
    if (!this.map || this.windEnabling) return;
    const next = !this.windOn();
    if (!next) {
      void this.disableWind();
      return;
    }
    void this.enableWind();
  }

  private async enableWind() {
    const map = this.map;
    if (!map) return;
    this.windEnabling = true;
    this.windOn.set(true);
    this.modeBeforeWind = this.mode();
    if (this.modeBeforeWind !== 'satellite') {
      await this.applyMapStyle(WIND_SCENE_STYLE);
    }
    const gfsOk = await this.maps.probeGfsWindAccess();
    if (gfsOk) {
      this.stopWindOverlay();
      this.maps.setWind(map, true, map.getLayer('fr-route-halo') ? 'fr-route-halo' : undefined);
      this.windGfs.set(true);
    } else {
      this.maps.clearWindGfs(map);
      this.windGfs.set(false);
      this.startWindOverlay();
    }
    await this.refreshWind();
    this.attachWindMove();
    this.windEnabling = false;
  }

  private async disableWind() {
    const map = this.map;
    this.windOn.set(false);
    this.windGfs.set(false);
    this.windInfo.set(null);
    this.detachWindMove();
    this.stopWindOverlay();
    if (map) this.maps.clearWindGfs(map);
    const prevMode = this.modeBeforeWind;
    this.modeBeforeWind = null;
    if (map && prevMode && prevMode !== 'satellite') {
      await this.applyMapStyle(this.baseStyle);
    }
    if (prevMode) {
      this.mode.set(prevMode);
      this.applyCamera(prevMode);
    }
  }

  private applyMapStyle(style: string): Promise<void> {
    const map = this.map;
    if (!map) return Promise.resolve();
    return new Promise((resolve) => {
      map.setStyle(style);
      map.once('style.load', () => {
        map.resize();
        this.reapplyOverlays(false);
        void this.draw(this.points());
        resolve();
      });
    });
  }

  private startWindOverlay() {
    const shell = this.host.nativeElement.parentElement;
    if (!shell || this.windOverlay) return;
    this.windOverlay = new WindParticleOverlay(shell, 2800);
    this.windOverlay.start();
    if (this.map && !this.windResizeHandler) {
      this.windResizeHandler = () => this.windOverlay?.resize();
      this.map.on('resize', this.windResizeHandler);
    }
  }

  private stopWindOverlay() {
    if (this.map && this.windResizeHandler) {
      this.map.off('resize', this.windResizeHandler);
      this.windResizeHandler = undefined;
    }
    this.windOverlay?.destroy();
    this.windOverlay = undefined;
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
    try {
      const field = await this.fetchWindField();
      this.windInfo.set({ windKmh: field.centerKmh, windDir: field.centerDir });
      this.windOverlay?.setField(field.cols, field.rows, field.grid);
      this.loadError.set(null);
    } catch {
      this.loadError.set('No se pudo cargar el viento (Open-Meteo).');
      if (!this.windGfs()) {
        this.windOn.set(false);
        this.windInfo.set(null);
        this.detachWindMove();
        this.stopWindOverlay();
      }
    }
  }

  /** Muestra 3×3 muestras Open-Meteo sobre el viewport para variar la animación. */
  private async fetchWindField(): Promise<{
    cols: number;
    rows: number;
    grid: WindFieldCell[];
    centerKmh: number;
    centerDir: number | null;
  }> {
    const map = this.map!;
    const cols = 5;
    const rows = 5;
    const b = map.getBounds();
    if (!b) {
      const c = map.getCenter();
      const w = await firstValueFrom(this.api.weather(c.lat, c.lng));
      const speedKmh = w.now.windKmh ?? 0;
      const { u, v } = WindParticleOverlay.vectorFromMeteo(speedKmh, w.now.windDir);
      const cell = { u, v, speedKmh };
      return { cols: 1, rows: 1, grid: [cell], centerKmh: speedKmh, centerDir: w.now.windDir };
    }
    const west = b.getWest();
    const east = b.getEast();
    const south = b.getSouth();
    const north = b.getNorth();
    const tasks: Promise<{ r: number; c: number; cell: WindFieldCell; windDir: number | null }>[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lat = north - (r / (rows - 1)) * (north - south);
        const lng = west + (c / (cols - 1)) * (east - west);
        tasks.push(
          firstValueFrom(this.api.weather(lat, lng)).then((w) => {
            const speedKmh = w.now.windKmh ?? 0;
            const { u, v } = WindParticleOverlay.vectorFromMeteo(speedKmh, w.now.windDir);
            return { r, c, cell: { u, v, speedKmh }, windDir: w.now.windDir };
          }),
        );
      }
    }
    const samples = await Promise.all(tasks);
    const grid: WindFieldCell[] = Array.from({ length: rows * cols }, () => ({
      u: 0.1,
      v: 0,
      speedKmh: 0,
    }));
    let centerKmh = 0;
    let centerDir: number | null = null;
    for (const s of samples) {
      grid[s.r * cols + s.c] = s.cell;
      if (s.r === Math.floor(rows / 2) && s.c === Math.floor(cols / 2)) {
        centerKmh = s.cell.speedKmh;
        centerDir = s.windDir;
      }
    }
    return { cols, rows, grid, centerKmh, centerDir };
  }

  windDirLabel(dir: number | null): string {
    if (dir == null) return '—';
    const labels = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    const i = Math.round(dir / 45) % 8;
    return labels[i];
  }

  /** Re-pinta capas overlay tras setStyle (tráfico / viento GFS). */
  private reapplyOverlays(refreshWindField = true) {
    if (!this.map) return;
    if (this.windOn()) {
      if (this.windGfs()) {
        this.maps.setWind(this.map, true, this.map.getLayer('fr-route-halo') ? 'fr-route-halo' : undefined);
      } else if (!this.windOverlay) {
        this.startWindOverlay();
      }
    } else {
      this.maps.clearWindGfs(this.map);
    }
    if (this.trafficOn()) this.maps.setTraffic(this.map, true);
    if (refreshWindField && this.windOn() && !this.windGfs()) void this.refreshWind();
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
    this.stopWindOverlay();
    this.resizeObs?.disconnect();
    this.markers.forEach((m) => m.remove());
    this.map?.remove();
    this.map = undefined;
  }
}
