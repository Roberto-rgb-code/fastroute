import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import mapboxgl from 'mapbox-gl';
import { ApiService } from '../../core/api.service';
import { MapService } from '../../core/map.service';
import { RouteDetail, RouteStatus } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { MapPlaceholderComponent } from '../../shared/map-placeholder.component';
import { ROUTE_BADGE, ROUTE_LABEL } from '../../core/status';

@Component({
  selector: 'app-route-detail',
  standalone: true,
  imports: [RouterLink, IconComponent, MapPlaceholderComponent],
  templateUrl: './route-detail.component.html',
  styleUrl: './route-detail.component.scss',
})
export class RouteDetailComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private maps = inject(MapService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  @ViewChild('mapEl') mapEl?: ElementRef<HTMLDivElement>;

  data = signal<RouteDetail | null>(null);
  loading = signal(true);
  useMapbox = signal(false);
  private map?: mapboxgl.Map;

  ROUTE_LABEL = ROUTE_LABEL;
  ROUTE_BADGE = ROUTE_BADGE;

  async ngOnInit() {
    await this.maps.ensureConfig();
    this.useMapbox.set(this.maps.hasToken);
    const id = this.route.snapshot.paramMap.get('id')!;
    this.load(id);
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  load(id: string) {
    this.loading.set(true);
    this.api.route(id).subscribe((r) => {
      this.data.set(r);
      this.loading.set(false);
      if (this.useMapbox()) {
        setTimeout(() => this.renderMap(), 50);
      }
    });
  }

  private renderMap() {
    const r = this.data();
    if (!r || !this.mapEl || this.map) return;
    const stops = r.events.map((e) => e.stop);
    if (!stops.length) return;
    this.map = this.maps.createMap(this.mapEl.nativeElement, [stops[0].lng, stops[0].lat]);
    this.map.on('load', () => {
      const coords = stops.map((s) => [s.lng, s.lat]);
      this.map!.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
      });
      this.map!.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#4f46e5', 'line-width': 4 },
      });
      r.events.forEach((e, i) => {
        const color = e.status === 'COMPLETED' ? '#059669' : '#4f46e5';
        new mapboxgl.Marker({ element: this.maps.numberedMarker(i + 1, color) })
          .setLngLat([e.stop.lng, e.stop.lat])
          .setPopup(new mapboxgl.Popup().setText(e.stop.label))
          .addTo(this.map!);
      });
      this.maps.fitToStops(this.map!, stops);
    });
  }

  get stopsForMap() {
    return (this.data()?.events ?? []).map((e) => e.stop);
  }

  progress(): number {
    const r = this.data();
    if (!r || !r.events.length) return 0;
    const done = r.events.filter((e) => e.status === 'COMPLETED').length;
    return Math.round((done / r.events.length) * 100);
  }

  changeStatus(status: RouteStatus) {
    const r = this.data();
    if (!r) return;
    this.api.changeRouteStatus(r.id, status).subscribe((res) => this.data.set(res));
  }

  remove() {
    const r = this.data();
    if (!r || !confirm('¿Eliminar esta ruta?')) return;
    this.api.deleteRoute(r.id).subscribe(() => this.router.navigate(['/app/routes']));
  }

  km(m?: number): string {
    return m ? (m / 1000).toFixed(1) + ' km' : '—';
  }
  dur(s?: number): string {
    if (!s) return '—';
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
  }

  nextActions(): { label: string; status: RouteStatus; kind: string }[] {
    const s = this.data()?.status;
    switch (s) {
      case 'PENDING':
        return [{ label: 'Iniciar checklist', status: 'CHECKLIST', kind: 'btn-ghost' }];
      case 'CHECKLIST':
      case 'CHECKLIST_PENDING':
        return [{ label: 'Aprobar y salir', status: 'ENROUTE', kind: 'btn-primary' }];
      case 'ENROUTE':
        return [
          { label: 'Pausar', status: 'PAUSED', kind: 'btn-ghost' },
          { label: 'Finalizar', status: 'FINISHED', kind: 'btn-primary' },
        ];
      case 'PAUSED':
        return [{ label: 'Reanudar', status: 'ENROUTE', kind: 'btn-primary' }];
      default:
        return [];
    }
  }
}
