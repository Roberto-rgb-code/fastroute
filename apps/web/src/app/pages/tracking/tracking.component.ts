import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { mapboxgl, MapService } from '../../core/map.service';
import Pusher from 'pusher-js';
import { RouteSummary } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { ROUTE_BADGE, ROUTE_LABEL } from '../../core/status';

interface LiveFix {
  lat: number;
  lng: number;
  at: string;
  routeId?: string;
}

@Component({
  selector: 'app-tracking',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './tracking.component.html',
  styleUrl: './tracking.component.scss',
})
export class TrackingComponent implements AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private maps = inject(MapService);

  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  active = signal<RouteSummary[]>([]);
  selectedId = signal<string | null>(null);
  live = signal(false);
  liveCount = signal(0);
  lastAt = signal<string | null>(null);
  engineReady = signal(false);
  error = signal<string | null>(null);

  private map?: mapboxgl.Map;
  private pusher?: Pusher;
  private markers = new Map<string, mapboxgl.Marker>();
  private stopMarkers: mapboxgl.Marker[] = [];
  private lastFix = new Map<string, LiveFix>();

  ROUTE_LABEL = ROUTE_LABEL;
  ROUTE_BADGE = ROUTE_BADGE;

  async ngAfterViewInit() {
    const token = await this.maps.ensureConfig();
    if (!token) {
      this.error.set('Falta MAPBOX_ACCESS_TOKEN. Agrégalo al .env y reinicia la API.');
      return;
    }

    this.map = this.maps.createMap(this.mapEl.nativeElement, [-99.1332, 19.4326], 11, { pitch: 45 });
    this.map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    this.map.on('load', () => {
      this.engineReady.set(true);
      this.redrawStops();
    });

    this.api.routes().subscribe((r) => {
      this.active.set(
        r.filter((x) => ['ENROUTE', 'CHECKLIST', 'CHECKLIST_PENDING', 'PAUSED'].includes(x.status)),
      );
      if (this.engineReady()) this.redrawStops();
    });

    await this.initPusher();
  }

  ngOnDestroy() {
    this.stopMarkers.forEach((m) => m.remove());
    this.markers.forEach((m) => m.remove());
    this.map?.remove();
    this.pusher?.disconnect();
  }

  select(r: RouteSummary) {
    this.selectedId.set(r.id);
    const fix = this.lastFix.get(r.id);
    if (fix && this.map) {
      this.map.easeTo({ center: [fix.lng, fix.lat], zoom: 14, pitch: 55, duration: 700 });
      return;
    }
    const stops = (r.events ?? []).map((e) => e.stop).filter(Boolean) as { lat: number; lng: number }[];
    if (stops.length && this.map) this.maps.fitToStops(this.map, stops, 80);
  }

  private async initPusher() {
    try {
      const cfg = await firstValueFrom(this.api.clientConfig());
      const key = cfg.pusher?.key?.trim();
      const eid = this.auth.activeEnterpriseId() ?? this.auth.user()?.enterpriseId;
      if (!key || !eid) {
        this.error.set((this.error() ? this.error() + ' · ' : '') + 'Pusher sin key; el mapa funciona pero sin live.');
        return;
      }
      this.pusher = new Pusher(key, { cluster: cfg.pusher.cluster || 'us2' });
      const channel = this.pusher.subscribe(`enterprise-${eid}`);
      channel.bind(
        'driver-location',
        (data: { lat: number; lng: number; routeId?: string; at?: string }) => {
          if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return;
          this.live.set(true);
          const id = data.routeId ?? 'unknown';
          const fix: LiveFix = { lat: data.lat, lng: data.lng, at: data.at ?? new Date().toISOString(), routeId: id };
          this.lastFix.set(id, fix);
          this.liveCount.set(this.lastFix.size);
          this.lastAt.set(fix.at);
          this.updateVehicle(id, fix);
        },
      );
    } catch {
      /* optional */
    }
  }

  private redrawStops() {
    if (!this.map) return;
    this.stopMarkers.forEach((m) => m.remove());
    this.stopMarkers = [];
    const allStops: { lat: number; lng: number }[] = [];
    for (const r of this.active()) {
      const events = r.events ?? [];
      events.forEach((e, i) => {
        if (!e.stop) return;
        allStops.push({ lat: e.stop.lat, lng: e.stop.lng });
        const color = e.status === 'COMPLETED' ? '#059669' : '#4f46e5';
        this.stopMarkers.push(
          new mapboxgl.Marker({ element: this.maps.numberedMarker(e.position ?? i + 1, color) })
            .setLngLat([e.stop.lng, e.stop.lat])
            .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(`<strong>${r.name}</strong><br/>${e.stop.label}`))
            .addTo(this.map!),
        );
      });
      // polyline simple entre paradas de cada ruta
      const coords = events
        .filter((e) => e.stop)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((e) => [e.stop!.lng, e.stop!.lat] as [number, number]);
      if (coords.length >= 2) this.maps.setRouteLine(this.map, coords, `track-${r.id}`);
    }
    if (allStops.length) this.maps.fitToStops(this.map, allStops, 70);
  }

  private updateVehicle(id: string, fix: LiveFix) {
    if (!this.map) return;
    const existing = this.markers.get(id);
    if (existing) {
      existing.setLngLat([fix.lng, fix.lat]);
      return;
    }
    const route = this.active().find((r) => r.id === id);
    const popup = new mapboxgl.Popup({ offset: 22 }).setHTML(
      `<strong>${route?.name ?? 'Unidad'}</strong><br/>${route?.driver?.name ?? 'Operador'}<br/><small>${new Date(fix.at).toLocaleTimeString('es-MX')}</small>`,
    );
    const m = new mapboxgl.Marker({ element: this.maps.vehicleMarker() })
      .setLngLat([fix.lng, fix.lat])
      .setPopup(popup)
      .addTo(this.map);
    this.markers.set(id, m);
  }

  tonePill(kind: string): string {
    switch (kind) {
      case 'ok':
        return 'bg-ok-bg text-ok';
      case 'info':
        return 'bg-info-bg text-info';
      case 'warn':
        return 'bg-warn-bg text-warn';
      case 'danger':
        return 'bg-danger-bg text-danger';
      default:
        return 'bg-ink-100 text-ink-700';
    }
  }

  timeAgo(iso: string | null): string {
    if (!iso) return '—';
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `hace ${s}s`;
    if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }
}
