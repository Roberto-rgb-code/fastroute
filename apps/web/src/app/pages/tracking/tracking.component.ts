import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import mapboxgl from 'mapbox-gl';
import Pusher from 'pusher-js';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { MapService } from '../../core/map.service';
import { RouteSummary } from '../../core/models';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { IconComponent } from '../../shared/icon.component';
import { MapPlaceholderComponent } from '../../shared/map-placeholder.component';
import { ROUTE_BADGE, ROUTE_LABEL } from '../../core/status';

@Component({
  selector: 'app-tracking',
  standalone: true,
  imports: [PageHeaderComponent, IconComponent, MapPlaceholderComponent],
  templateUrl: './tracking.component.html',
  styleUrl: './tracking.component.scss',
})
export class TrackingComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private maps = inject(MapService);

  @ViewChild('mapEl') mapEl?: ElementRef<HTMLDivElement>;

  active = signal<RouteSummary[]>([]);
  useMapbox = signal(false);
  live = signal(false);
  private map?: mapboxgl.Map;
  private pusher?: Pusher;
  private markers = new Map<string, mapboxgl.Marker>();

  ROUTE_LABEL = ROUTE_LABEL;
  ROUTE_BADGE = ROUTE_BADGE;

  async ngOnInit() {
    await this.maps.ensureConfig();
    this.useMapbox.set(this.maps.hasToken);
    this.api.routes().subscribe((r) => {
      this.active.set(r.filter((x) => ['ENROUTE', 'CHECKLIST', 'CHECKLIST_PENDING', 'PAUSED'].includes(x.status)));
      if (this.useMapbox()) setTimeout(() => this.initMap(), 50);
    });
    this.initPusherIfAvailable();
  }

  ngOnDestroy() {
    this.map?.remove();
    this.pusher?.disconnect();
  }

  get placeholderStops() {
    // Represent each active route by its first known driver marker; fallback none.
    return [];
  }

  private initMap() {
    if (!this.mapEl || this.map) return;
    this.map = this.maps.createMap(this.mapEl.nativeElement, [-70.62, -33.44], 11);
  }

  private async initPusherIfAvailable() {
    try {
      const cfg = await this.api.clientConfig().toPromise();
      const key = cfg?.pusher.key;
      const eid = this.auth.user()?.enterpriseId;
      if (!key || !eid) return;
      this.pusher = new Pusher(key, { cluster: cfg!.pusher.cluster });
      const channel = this.pusher.subscribe(`enterprise-${eid}`);
      channel.bind('driver-location', (data: { lat: number; lng: number; routeId?: string }) => {
        this.live.set(true);
        this.updateMarker(data.routeId ?? 'unknown', data.lat, data.lng);
      });
    } catch {
      /* realtime optional */
    }
  }

  private updateMarker(id: string, lat: number, lng: number) {
    if (!this.map) return;
    const existing = this.markers.get(id);
    if (existing) {
      existing.setLngLat([lng, lat]);
    } else {
      const el = this.maps.numberedMarker(this.markers.size + 1, '#2563eb');
      const m = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(this.map);
      this.markers.set(id, m);
    }
  }
}
