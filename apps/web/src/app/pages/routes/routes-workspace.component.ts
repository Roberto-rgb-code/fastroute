import { Component, ElementRef, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { DEMO_PLANNER_AFTER_LABELS, DEMO_PLANNER_BEFORE_LABELS, DEMO_ROUTE_NAME, MAP_OVERVIEW_MAX_STOPS } from '../../core/demo.config';
import {
  Driver,
  EnterpriseSettings,
  OPEN_ROUTE_STATUSES,
  RouteDetail,
  RouteEvent,
  RouteStatus,
  RouteSummary,
  Stop,
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
import { RouteChatComponent } from '../../shared/route-chat.component';
import { stopIdsInRoute } from './route-planner.util';
import { capturePlanFlipRects, playPlanFlip } from './plan-flip.util';

type Tab = 'info' | 'stops' | 'plan' | 'checklist' | 'expenses' | 'incidents' | 'chat';
type Filter = 'ALL' | 'OPEN' | 'PENDING' | 'ENROUTE' | 'DONE' | 'APPROVALS';

const PANELS_KEY = 'fastroute_routes_panels';

@Component({
  selector: 'app-routes-workspace',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, RouteMapComponent, RouteChatComponent, DecimalPipe],
  templateUrl: './routes-workspace.component.html',
  styleUrl: './routes-workspace.component.scss',
})
export class RoutesWorkspaceComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly auth = inject(AuthService);

  @ViewChild('planRouteList') planRouteList?: ElementRef<HTMLElement>;

  // ── paneles desplegables ──
  listOpen = signal(true);
  mapOpen = signal(true);
  /** Mapa ocupa todo el alto; KPIs y pestañas quedan ocultas hasta volver a expandir. */
  mapExpanded = signal(false);

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

  /** Paradas desplegadas en la línea de tiempo. */
  expanded = signal<Record<string, boolean>>({});

  /** Planificador Curri-style */
  catalogStops = signal<Stop[]>([]);
  poolSearch = signal('');
  plannerBusy = signal(false);
  planOptimizing = signal(false);
  highlightEventId = signal<string | null>(null);
  /** Orden visual en planificador (demo mezclada hasta optimizar). */
  planOrderOverride = signal<RouteEvent[] | null>(null);
  private demoPlanPreparedForRouteId: string | null = null;
  private demoPlanShuffleDone = false;

  readonly ROUTE_LABEL = ROUTE_LABEL;
  readonly ROUTE_BADGE = ROUTE_BADGE;
  readonly EVENT_LABEL = EVENT_LABEL;
  readonly EVENT_BADGE = EVENT_BADGE;
  readonly DELIVER_LABEL = DELIVER_LABEL;
  readonly DELIVER_BADGE = DELIVER_BADGE;
  readonly STOP_TYPE_LABEL = STOP_TYPE_LABEL;
  readonly INCIDENT_LABEL = INCIDENT_LABEL;

  readonly mapPoints = computed((): MapPoint[] => {
    const color = (status?: string) => (status === 'COMPLETED' ? '#059669' : status === 'ISSUE' ? '#dc2626' : '#4f46e5');
    const d = this.detail();
    if (d) {
      const ordered =
        this.planOrderOverride() ??
        [...d.events].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      return ordered
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
        if (pts.length >= MAP_OVERVIEW_MAX_STOPS) return pts;
      }
    }
    return pts;
  });

  filters: { key: Filter; label: string }[] = [
    { key: 'ALL', label: 'Todas' },
    { key: 'OPEN', label: 'Abiertas' },
    { key: 'PENDING', label: 'Pendientes' },
    { key: 'ENROUTE', label: 'En ruta' },
    { key: 'DONE', label: 'Cerradas' },
    { key: 'APPROVALS', label: 'Por aprobar' },
  ];

  tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'plan', label: 'Planificador', icon: 'navigation' },
    { key: 'info', label: 'Info', icon: 'info' },
    { key: 'stops', label: 'Paradas', icon: 'pin' },
    { key: 'checklist', label: 'Checklist', icon: 'checklist' },
    { key: 'expenses', label: 'Gastos', icon: 'money' },
    { key: 'incidents', label: 'Incidencias', icon: 'alert' },
    { key: 'chat', label: 'Chat', icon: 'message' },
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
    this.mapExpanded.set(saved.mapExpanded);
    effect(() =>
      localStorage.setItem(
        PANELS_KEY,
        JSON.stringify({ list: this.listOpen(), map: this.mapOpen(), mapExpanded: this.mapExpanded() }),
      ),
    );
    effect(() => {
      if (this.tab() !== 'plan') return;
      const r = this.detail();
      if (r) this.ensureDemoPlanShuffle(r);
    });
  }

  ngOnInit() {
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

  // ─────────── lista ───────────
  loadList() {
    this.loadingList.set(true);
    this.api.routes({ day: this.day() }).subscribe({
      next: (r) => {
        this.routes.set(r);
        this.loadingList.set(false);
        if (!this.selectedId() && !this.route.snapshot.paramMap.get('id')) {
          const demo =
            r.find((x) => x.name === DEMO_ROUTE_NAME) ??
            r.find((x) => x.status === 'ENROUTE') ??
            r[0];
          if (demo) void this.router.navigate(['/app/routes', demo.id], { replaceUrl: true });
        }
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
        this.planOrderOverride.set(null);
        this.demoPlanPreparedForRouteId = null;
        this.demoPlanShuffleDone = false;
        this.loadCatalog();
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

  // ─────────── línea de tiempo de paradas ───────────
  toggleStop(id: string) {
    this.expanded.update((m) => ({ ...m, [id]: !m[id] }));
  }
  isStopOpen(id: string): boolean {
    return !!this.expanded()[id];
  }

  /** Paradas ordenadas por posición (origen → destino). */
  orderedEvents(r: RouteDetail): RouteEvent[] {
    return [...r.events].sort((a, b) => a.position - b.position);
  }

  /** Lista del planificador (incluye orden demo mezclado). */
  planEvents(r: RouteDetail): RouteEvent[] {
    const override = this.planOrderOverride();
    if (override?.length) return override;
    return this.orderedEvents(r);
  }

  isDemoPlanShuffle(): boolean {
    return !!this.planOrderOverride() && this.detail()?.name === DEMO_ROUTE_NAME;
  }

  private ensureDemoPlanShuffle(r: RouteDetail) {
    if (r.name !== DEMO_ROUTE_NAME || this.demoPlanShuffleDone) return;
    if (this.planOrderOverride()) return;
    if (this.demoPlanPreparedForRouteId !== r.id) {
      this.demoPlanPreparedForRouteId = r.id;
    }
    const built = this.eventsInLabelOrder(r, DEMO_PLANNER_BEFORE_LABELS);
    if (built.length >= 2) {
      this.planOrderOverride.set(built);
    }
  }

  private eventsInLabelOrder(r: RouteDetail, labels: readonly string[]): RouteEvent[] {
    const byLabel = new Map(r.events.map((e) => [e.stop.label, e]));
    const picked = labels.map((label) => byLabel.get(label)).filter((e): e is RouteEvent => !!e);
    if (picked.length !== r.events.length) return [];
    return picked.map((e, i) => ({ ...e, position: i + 1 }));
  }

  private runPlanFlipAfterReorder(before: Map<string, DOMRect>) {
    const el = this.planRouteList?.nativeElement;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => playPlanFlip(el, before));
    });
  }

  canPlan(r: RouteDetail | null): boolean {
    return !!r && !this.isTerminal(r) && this.auth.canDispatch();
  }

  poolStops(r: RouteDetail): Stop[] {
    const inRoute = stopIdsInRoute(r.events);
    const q = this.poolSearch().toLowerCase().trim();
    return this.catalogStops().filter((s) => {
      if (inRoute.has(s.id)) return false;
      if (!q) return true;
      return `${s.label} ${s.address}`.toLowerCase().includes(q);
    });
  }

  loadCatalog() {
    this.api.stops().subscribe({
      next: (list) => this.catalogStops.set(list.filter((s) => !s.isArchived)),
      error: () => this.catalogStops.set([]),
    });
  }

  addStopFromPool(stop: Stop) {
    const r = this.detail();
    if (!r || !this.canPlan(r)) return;
    this.plannerBusy.set(true);
    this.api.addStopToRoute(r.id, stop.id).subscribe({
      next: (res) => {
        this.apply(res, `${stop.label} agregada a la ruta`);
        const added = res.events.find((e) => e.stop.id === stop.id);
        if (added) {
          this.highlightEventId.set(added.id);
          setTimeout(() => this.highlightEventId.set(null), 1200);
        }
        this.plannerBusy.set(false);
      },
      error: (e) => {
        this.plannerBusy.set(false);
        this.fail(e);
      },
    });
  }

  removeFromRoute(ev: RouteEvent) {
    const r = this.detail();
    if (!r || !this.canPlan(r)) return;
    if (!confirm(`¿Quitar "${ev.stop.label}" de esta ruta?`)) return;
    this.plannerBusy.set(true);
    this.api.removeRouteStop(r.id, ev.id).subscribe({
      next: (res) => {
        this.apply(res, 'Parada quitada de la ruta');
        this.plannerBusy.set(false);
      },
      error: (e) => {
        this.plannerBusy.set(false);
        this.fail(e);
      },
    });
  }

  optimizeRoute() {
    const r = this.detail();
    if (!r || !this.canPlan(r)) return;
    const listEl = this.planRouteList?.nativeElement;
    const beforeRects = capturePlanFlipRects(listEl);
    const demoShuffle = this.isDemoPlanShuffle();

    this.plannerBusy.set(true);
    this.planOptimizing.set(true);

    const finishBusy = () => {
      this.plannerBusy.set(false);
      this.planOptimizing.set(false);
    };

    const applyOptimized = (res: RouteDetail, msg: string) => {
      this.planOrderOverride.set(null);
      this.apply(res, msg);
      finishBusy();
      this.runPlanFlipAfterReorder(beforeRects);
      this.tab.set('plan');
    };

    if (demoShuffle) {
      window.setTimeout(() => {
        const reordered = this.eventsInLabelOrder(r, DEMO_PLANNER_AFTER_LABELS);
        if (reordered.length >= 2) {
          this.planOrderOverride.set(reordered);
          this.demoPlanShuffleDone = true;
          this.runPlanFlipAfterReorder(beforeRects);
          this.notify('ok', 'Ruta optimizada (prioridad + recorrido)');
        }
        this.api.optimizeRoute(r.id).subscribe({
          next: (res) => {
            this.planOrderOverride.set(null);
            this.detail.set(res);
            this.loadList();
            finishBusy();
          },
          error: (e) => {
            finishBusy();
            this.fail(e);
          },
        });
      }, 520);
      return;
    }

    this.api.optimizeRoute(r.id).subscribe({
      next: (res) => applyOptimized(res, 'Ruta optimizada (prioridad + tiempo)'),
      error: (e) => {
        finishBusy();
        this.fail(e);
      },
    });
  }

  originOf(r: RouteSummary): string {
    return this.edgeStop(r, 'first');
  }
  destinationOf(r: RouteSummary): string {
    return this.edgeStop(r, 'last');
  }
  private edgeStop(r: RouteSummary, which: 'first' | 'last'): string {
    const evs = (r.events ?? []).filter((e) => e.stop);
    if (!evs.length) return '—';
    const sorted = [...evs].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const e = which === 'first' ? sorted[0] : sorted[sorted.length - 1];
    return e.stop?.label ?? '—';
  }

  /** Color sólido para iconos y puntos de la línea de tiempo (inspiración 2). */
  toneDot(kind: string): string {
    switch (kind) {
      case 'ok':
        return 'bg-ok';
      case 'info':
        return 'bg-info';
      case 'warn':
        return 'bg-accent-amber';
      case 'danger':
        return 'bg-accent-pink';
      default:
        return 'bg-accent-teal';
    }
  }

  /** Texto de estado en color. */
  toneText(kind: string): string {
    switch (kind) {
      case 'ok':
        return 'text-ok';
      case 'info':
        return 'text-info';
      case 'warn':
        return 'text-accent-amber';
      case 'danger':
        return 'text-accent-pink';
      default:
        return 'text-accent-teal';
    }
  }

  /** Pill suave con fondo. */
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

  initials(name?: string | null): string {
    return (name ?? '?')
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  // ─────────── helpers ───────────
  toggleMap() {
    this.mapOpen.update((v) => {
      const next = !v;
      if (!next) this.mapExpanded.set(false);
      return next;
    });
  }

  /** Estilo Swift Haul: mapa grande; el detalle (KPIs + tabs) sigue ahí, solo colapsado. */
  toggleMapExpanded() {
    if (!this.mapOpen()) this.mapOpen.set(true);
    this.mapExpanded.update((v) => !v);
  }

  collapseMapExpanded() {
    this.mapExpanded.set(false);
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
  kmTraveled(r: RouteDetail): string {
    return r.kmInitial && r.kmFinal ? `${(r.kmFinal - r.kmInitial).toFixed(0)} km` : '—';
  }
  expensesTotal(r: RouteDetail): number {
    return r.expenses.reduce((a, e) => a + e.amount, 0);
  }

  private loadPanels(): { list: boolean; map: boolean; mapExpanded: boolean } {
    try {
      const v = JSON.parse(localStorage.getItem(PANELS_KEY) ?? '{}');
      return { list: v.list ?? true, map: v.map ?? false, mapExpanded: v.mapExpanded ?? false };
    } catch {
      return { list: true, map: false, mapExpanded: false };
    }
  }

}
