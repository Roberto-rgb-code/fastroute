import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import mapboxgl from 'mapbox-gl';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { MapService } from '../../core/map.service';
import {
  Driver,
  EnterpriseSettings,
  OPEN_ROUTE_STATUSES,
  RouteDetail,
  RouteEvent,
  RouteStatus,
  RouteSummary,
  TERMINAL_ROUTE_STATUSES,
  TRACKABLE_ROUTE_STATUSES,
  Vehicle,
} from '../../core/models';
import {
  DELIVER_BADGE,
  DELIVER_LABEL,
  EVENT_BADGE,
  EVENT_LABEL,
  INCIDENT_LABEL,
  ROUTE_BADGE,
  ROUTE_LABEL,
  STOP_TYPE_LABEL,
} from '../../core/status';
import { IconComponent } from '../../shared/icon.component';
import { MapPoint, RouteMapComponent } from '../../shared/route-map.component';

type Tab = 'info' | 'stops' | 'checklist' | 'expenses' | 'incidents';
type Filter = 'ALL' | 'OPEN' | 'PENDING' | 'ENROUTE' | 'DONE' | 'APPROVALS';

const PANELS_KEY = 'fastroute_routes_panels';

@Component({
  selector: 'app-routes-workspace',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, RouteMapComponent, DecimalPipe],
  templateUrl: './routes-workspace.component.html',
  styleUrl: './routes-workspace.component.scss',
})
export class RoutesWorkspaceComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private maps = inject(MapService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly auth = inject(AuthService);

  @ViewChild('mapEl') mapEl?: ElementRef<HTMLDivElement>;

  // ── paneles desplegables ──
  listOpen = signal(true);
  mapOpen = signal(true);

  // ── lista ──
  day = signal<string>('');
  routes = signal<RouteSummary[]>([]);
  loadingList = signal(true);
  filter = signal<Filter>('ALL');
  search = signal('');

  // ── detalle ──
  selectedId = signal<string | null>(null);
  detail = signal<RouteDetail | null>(null);
  loadingDetail = signal(false);
  tab = signal<Tab>('stops');
  actionsOpen = signal(false);
  toast = signal<{ kind: 'ok' | 'err'; text: string } | null>(null);
  settings = signal<EnterpriseSettings | null>(null);

  // ── modales ──
  dupOpen = signal(false);
  dupDriverId = '';
  dupVehicleId = '';
  drivers = signal<Driver[]>([]);
  vehicles = signal<Vehicle[]>([]);
  cancelOpen = signal(false);
  cancelReason = '';
  lightbox = signal<string | null>(null);

  useMapbox = signal(false);
  private map?: mapboxgl.Map;
  private markers: mapboxgl.Marker[] = [];

  readonly ROUTE_LABEL = ROUTE_LABEL;
  readonly ROUTE_BADGE = ROUTE_BADGE;
  readonly EVENT_LABEL = EVENT_LABEL;
  readonly EVENT_BADGE = EVENT_BADGE;
  readonly DELIVER_LABEL = DELIVER_LABEL;
  readonly DELIVER_BADGE = DELIVER_BADGE;
  readonly STOP_TYPE_LABEL = STOP_TYPE_LABEL;
  readonly INCIDENT_LABEL = INCIDENT_LABEL;

  filters: { key: Filter; label: string }[] = [
    { key: 'ALL', label: 'Todas' },
    { key: 'OPEN', label: 'Abiertas' },
    { key: 'PENDING', label: 'Pendientes' },
    { key: 'ENROUTE', label: 'En ruta' },
    { key: 'DONE', label: 'Cerradas' },
    { key: 'APPROVALS', label: 'Por aprobar' },
  ];

  tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'info', label: 'Info', icon: 'info' },
    { key: 'stops', label: 'Paradas', icon: 'pin' },
    { key: 'checklist', label: 'Checklist', icon: 'checklist' },
    { key: 'expenses', label: 'Gastos', icon: 'money' },
    { key: 'incidents', label: 'Incidencias', icon: 'alert' },
  ];

  visible = computed(() => {
    const f = this.filter();
    const q = this.search().toLowerCase().trim();
    return this.routes().filter((r) => {
      if (q && !`${r.name} ${r.driver?.name ?? ''} ${r.vehicle?.plate ?? ''}`.toLowerCase().includes(q)) return false;
      switch (f) {
        case 'OPEN':
          return OPEN_ROUTE_STATUSES.includes(r.status);
        case 'PENDING':
          return r.status === 'PENDING';
        case 'ENROUTE':
          return ['ENROUTE', 'CHECKLIST', 'CHECKLIST_PENDING', 'PAUSED'].includes(r.status);
        case 'DONE':
          return TERMINAL_ROUTE_STATUSES.includes(r.status);
        case 'APPROVALS':
          return r.status === 'CHECKLIST_PENDING' || this.pendingApprovals(r) > 0;
        default:
          return true;
      }
    });
  });

  counts = computed(() => {
    const rs = this.routes();
    return {
      open: rs.filter((r) => OPEN_ROUTE_STATUSES.includes(r.status)).length,
      done: rs.filter((r) => TERMINAL_ROUTE_STATUSES.includes(r.status)).length,
      approvals: rs.filter((r) => r.status === 'CHECKLIST_PENDING' || this.pendingApprovals(r) > 0).length,
    };
  });

  constructor() {
    const saved = this.loadPanels();
    this.listOpen.set(saved.list);
    this.mapOpen.set(saved.map);
    effect(() => localStorage.setItem(PANELS_KEY, JSON.stringify({ list: this.listOpen(), map: this.mapOpen() })));
    effect(() => {
      // Redibuja el mapa cuando cambia el detalle o se abre el panel.
      const d = this.detail();
      const open = this.mapOpen();
      if (d && open && this.useMapbox()) setTimeout(() => this.renderMap(), 60);
    });
  }

  async ngOnInit() {
    await this.maps.ensureConfig();
    this.useMapbox.set(this.maps.hasToken);
    this.api.today().subscribe((t) => {
      this.day.set(t.day);
      this.loadList();
    });
    this.api.settings().subscribe({ next: (s) => this.settings.set(s), error: () => null });
    this.route.paramMap.subscribe((p) => {
      const id = p.get('id');
      this.selectedId.set(id);
      if (id) this.loadDetail(id);
      else this.detail.set(null);
    });
    if (this.route.snapshot.queryParamMap.get('approvals')) this.filter.set('APPROVALS');
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  // ─────────── lista ───────────
  loadList() {
    this.loadingList.set(true);
    this.api.routes({ day: this.day() }).subscribe({
      next: (r) => {
        this.routes.set(r);
        this.loadingList.set(false);
      },
      error: () => this.loadingList.set(false),
    });
  }

  shiftDay(delta: number) {
    const [y, m, d] = this.day().split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + delta));
    this.day.set(dt.toISOString().slice(0, 10));
    this.loadList();
  }

  onDay(v: string) {
    if (!v) return;
    this.day.set(v);
    this.loadList();
  }

  select(r: RouteSummary) {
    void this.router.navigate(['/app/routes', r.id]);
  }

  progress(r: RouteSummary | RouteDetail): number {
    const total = r._count?.events ?? r.events?.length ?? 0;
    if (!total) return 0;
    const done = (r.events ?? []).filter((e) => e.status === 'COMPLETED').length;
    return Math.round((done / total) * 100);
  }

  pendingApprovals(r: RouteSummary): number {
    return (r.events ?? []).filter((e) => e.approved === false && e.status === 'SERVICE').length;
  }

  // ─────────── detalle ───────────
  loadDetail(id: string) {
    this.loadingDetail.set(true);
    this.api.route(id).subscribe({
      next: (r) => {
        this.detail.set(r);
        this.loadingDetail.set(false);
      },
      error: () => {
        this.loadingDetail.set(false);
        this.notify('err', 'No se encontró la ruta');
        void this.router.navigate(['/app/routes']);
      },
    });
  }

  private apply(res: RouteDetail, msg?: string) {
    this.detail.set(res);
    this.loadList();
    if (msg) this.notify('ok', msg);
  }

  private fail(e: { error?: { message?: string | string[] } }) {
    const m = e?.error?.message;
    this.notify('err', Array.isArray(m) ? m.join(', ') : (m ?? 'Operación no permitida'));
  }

  notify(kind: 'ok' | 'err', text: string) {
    this.toast.set({ kind, text });
    setTimeout(() => this.toast.set(null), 3500);
  }

  isTerminal(r: RouteSummary | null) {
    return !!r && TERMINAL_ROUTE_STATUSES.includes(r.status);
  }
  isTrackable(r: RouteSummary | null) {
    return !!r && TRACKABLE_ROUTE_STATUSES.includes(r.status);
  }
  canNotifyDriver(r: RouteDetail | null) {
    return !!r && !!this.settings()?.whatsapp_notifications && !!r.driver?.phone && ['ENROUTE', 'PAUSED'].includes(r.status);
  }
  canNotifyClient(r: RouteDetail | null) {
    return !!r && ['ENROUTE', 'PAUSED', 'CHECKLIST', 'CHECKLIST_PENDING'].includes(r.status);
  }

  changeStatus(status: RouteStatus) {
    const r = this.detail();
    if (!r) return;
    this.api.changeRouteStatus(r.id, status).subscribe({
      next: (res) => this.apply(res, `Ruta ${ROUTE_LABEL[status].toLowerCase()}`),
      error: (e) => this.fail(e),
    });
  }

  approveChecklist() {
    const r = this.detail();
    if (!r) return;
    this.api.approveChecklist(r.id).subscribe({
      next: (res) => this.apply(res, 'Checklist aprobado, ruta liberada'),
      error: (e) => this.fail(e),
    });
  }

  approveEvent(ev: RouteEvent) {
    const r = this.detail();
    if (!r) return;
    this.api.approveEvent(r.id, ev.id).subscribe({
      next: (res) => this.apply(res, `Parada ${ev.position} aprobada`),
      error: (e) => this.fail(e),
    });
  }

  retryEvent(ev: RouteEvent) {
    const r = this.detail();
    if (!r || !confirm(`¿Reabrir la parada ${ev.position} para reintento?`)) return;
    this.api.retryEvent(r.id, ev.id).subscribe({ next: (res) => this.apply(res, 'Parada reabierta'), error: (e) => this.fail(e) });
  }

  setPriority(ev: RouteEvent, priority: string) {
    const r = this.detail();
    if (!r) return;
    this.api.updateEvent(r.id, ev.id, { priority }).subscribe({ next: (res) => this.apply(res), error: (e) => this.fail(e) });
  }

  notifyDriver() {
    const r = this.detail();
    if (!r) return;
    this.api.notifyDriver(r.id).subscribe({
      next: (res) => window.open(res.link, '_blank'),
      error: (e) => this.fail(e),
    });
  }

  notifyClient(ev: RouteEvent) {
    const r = this.detail();
    if (!r) return;
    this.api.notifyClient(r.id, ev.id).subscribe({
      next: (res) => {
        this.notify('ok', `Aviso listo para ${res.to}`);
        window.open(res.link, '_blank');
      },
      error: (e) => this.fail(e),
    });
  }

  expenseDone(id: string) {
    const r = this.detail();
    if (!r) return;
    this.api.expenseDone(r.id, id).subscribe({ next: (res) => this.apply(res, 'Gasto marcado como pagado'), error: (e) => this.fail(e) });
  }

  openDuplicate() {
    const r = this.detail();
    if (!r) return;
    this.dupDriverId = r.driver?.id ?? '';
    this.dupVehicleId = r.vehicle?.id ?? '';
    this.api.drivers().subscribe((d) => this.drivers.set(d));
    this.api.vehicles().subscribe((v) => this.vehicles.set(v));
    this.dupOpen.set(true);
    this.actionsOpen.set(false);
  }

  duplicate() {
    const r = this.detail();
    if (!r) return;
    this.api.duplicateRoute(r.id, { driverId: this.dupDriverId || undefined, vehicleId: this.dupVehicleId || undefined }).subscribe({
      next: (res) => {
        this.dupOpen.set(false);
        this.notify('ok', 'Ruta duplicada');
        this.loadList();
        void this.router.navigate(['/app/routes', res.id]);
      },
      error: (e) => this.fail(e),
    });
  }

  cancel() {
    const r = this.detail();
    if (!r) return;
    this.api.cancelRoute(r.id, this.cancelReason || undefined).subscribe({
      next: (res) => {
        this.cancelOpen.set(false);
        this.cancelReason = '';
        this.apply(res, 'Ruta cancelada');
      },
      error: (e) => this.fail(e),
    });
  }

  remove() {
    const r = this.detail();
    if (!r || !confirm('¿Eliminar esta ruta y su checklist? El catálogo de paradas no se borra.')) return;
    this.api.deleteRoute(r.id).subscribe({
      next: () => {
        this.notify('ok', 'Ruta eliminada');
        this.loadList();
        void this.router.navigate(['/app/routes']);
      },
      error: (e) => this.fail(e),
    });
  }

  // ─────────── helpers ───────────
  toggleMap() {
    this.mapOpen.update((v) => !v);
  }
  toggleActions() {
    this.actionsOpen.update((v) => !v);
  }
  km(m?: number | null): string {
    return m ? (m / 1000).toFixed(1) + ' km' : '—';
  }
  dur(s?: number | null): string {
    if (!s) return '—';
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
  }
  time(d?: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });
  }
  dateTime(d?: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Mexico_City',
    });
  }
  money(n: number): string {
    return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
  dayLabel(): string {
    const d = this.day();
    if (!d) return '';
    const [y, m, dd] = d.split('-').map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  /** Paradas del trayecto seleccionado, o de todas las rutas visibles si aún no hay selección. */
  mapPoints(): MapPoint[] {
    const color = (status?: string) => (status === 'COMPLETED' ? '#059669' : status === 'ISSUE' ? '#dc2626' : '#4f46e5');
    const d = this.detail();
    if (d) {
      return d.events
        .filter((e) => e.stop)
        .map((e, i) => ({
          lat: e.evLat ?? e.stop.lat,
          lng: e.evLng ?? e.stop.lng,
          label: e.stop.label,
          color: color(e.status),
          index: e.position ?? i + 1,
        }));
    }
    const pts: MapPoint[] = [];
    for (const r of this.visible()) {
      for (const e of r.events ?? []) {
        if (!e.stop) continue;
        pts.push({
          lat: e.evLat ?? e.stop.lat,
          lng: e.evLng ?? e.stop.lng,
          label: `${r.name} · ${e.stop.label}`,
          color: color(e.status),
          index: e.position ?? pts.length + 1,
        });
      }
    }
    return pts;
  }
  kmTraveled(r: RouteDetail): string {
    return r.kmInitial && r.kmFinal ? `${(r.kmFinal - r.kmInitial).toFixed(0)} km` : '—';
  }
  expensesTotal(r: RouteDetail): number {
    return r.expenses.reduce((a, e) => a + e.amount, 0);
  }

  private loadPanels(): { list: boolean; map: boolean } {
    try {
      const v = JSON.parse(localStorage.getItem(PANELS_KEY) ?? '{}');
      return { list: v.list ?? true, map: v.map ?? true };
    } catch {
      return { list: true, map: true };
    }
  }

  private renderMap() {
    const r = this.detail();
    if (!r || !this.mapEl) return;
    const stops = r.events.map((e) => e.stop);
    if (!stops.length) return;

    if (!this.map) {
      this.map = this.maps.createMap(this.mapEl.nativeElement, [stops[0].lng, stops[0].lat]);
      this.map.on('load', () => this.drawRoute(r));
    } else {
      this.drawRoute(r);
    }
  }

  private drawRoute(r: RouteDetail) {
    if (!this.map) return;
    const map = this.map;
    const stops = r.events.map((e) => e.stop);
    const coords = stops.map((s) => [s.lng, s.lat]);
    const data = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: coords },
    };
    const src = map.getSource('route') as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(data);
    } else {
      map.addSource('route', { type: 'geojson', data });
      map.addLayer({ id: 'route', type: 'line', source: 'route', paint: { 'line-color': '#4f46e5', 'line-width': 4 } });
    }
    this.markers.forEach((m) => m.remove());
    this.markers = r.events.map((e, i) => {
      const color = e.status === 'COMPLETED' ? '#059669' : e.status === 'ISSUE' ? '#dc2626' : '#4f46e5';
      // RN-MAP-03: la posición de una entrega es la coordenada capturada al enviar evidencia.
      const lng = e.evLng ?? e.stop.lng;
      const lat = e.evLat ?? e.stop.lat;
      return new mapboxgl.Marker({ element: this.maps.numberedMarker(i + 1, color) })
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup().setText(e.stop.label))
        .addTo(map);
    });
    this.maps.fitToStops(map, stops);
    setTimeout(() => map.resize(), 50);
  }
}
