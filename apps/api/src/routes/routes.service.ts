import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliverStatus,
  DriverStatus,
  EventStatus,
  Prisma,
  Route,
  RouteStatus,
  User,
  UserRole,
  VehicleStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { businessDayOf, businessDayRange, shiftDay, todayBusinessDay } from '../common/business-day.util';
import {
  IN_PROGRESS_ROUTE_STATUSES,
  KPI_IN_PROGRESS_STATUSES,
  MANUAL_DRIVER_STATUSES,
  MANUAL_VEHICLE_STATUSES,
  NOTIFY_CLIENT_STATUSES,
  NOTIFY_DRIVER_STATUSES,
  OPEN_ROUTE_STATUSES,
  TERMINAL_ROUTE_STATUSES,
  canTransition,
  isTerminalRoute,
  mapRouteStatusToEntityStatus,
} from '../common/route-status.util';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import {
  CancelRouteDto,
  CloseRouteDto,
  DuplicateRouteDto,
  ExpenseDto,
  IncidentDto,
  StartRouteDto,
  SubmitEvidenceDto,
} from './dto/route-ops.dto';
import { PusherNotifyService } from '../realtime/pusher-notify.service';

const ROUTE_INCLUDE = {
  driver: true,
  vehicle: true,
  client: true,
  template: { select: { id: true, name: true } },
  events: {
    orderBy: { position: 'asc' as const },
    include: { stop: true, evidences: true },
  },
  checklist: true,
  expenses: { orderBy: { createdAt: 'desc' as const } },
  incidents: { orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.RouteInclude;

const LIST_INCLUDE = {
  driver: true,
  vehicle: true,
  client: true,
  _count: { select: { events: true, incidents: true, expenses: true } },
  events: {
    select: {
      status: true,
      deliverStatus: true,
      approved: true,
      position: true,
      evLat: true,
      evLng: true,
      stop: { select: { id: true, label: true, lat: true, lng: true } },
    },
  },
} satisfies Prisma.RouteInclude;

/** Placeholder de depuración que se rechaza (RN-EVT-07). */
const PLACEHOLDER_IMG = /^\s*$|^\[\d+ URLs?\]$/i;

@Injectable()
export class RoutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly notify: PusherNotifyService,
  ) {}

  // ─────────────────────────── consultas ───────────────────────────

  /**
   * Rutas del día operativo (RN-FEC-01..03).
   * `day` = 'YYYY-MM-DD' (UTC-6). Sin `day` devuelve todas.
   * Siempre incluye rutas en curso aunque su fecha no coincida.
   */
  list(enterpriseId: string, opts: { status?: RouteStatus; day?: string; all?: boolean } = {}) {
    const where: Prisma.RouteWhereInput = { enterpriseId };
    if (opts.status) where.status = opts.status;

    if (opts.day && !opts.all) {
      const { start, end } = businessDayRange(opts.day);
      const inDay: Prisma.RouteWhereInput = {
        OR: [
          { dateStarted: { gte: start, lt: end } },
          { dateStarted: null, dateStart: { gte: start, lt: end } },
        ],
      };
      where.AND = [
        {
          OR: [inDay, { status: { in: IN_PROGRESS_ROUTE_STATUSES } }],
        },
      ];
    }

    return this.prisma.route.findMany({
      where,
      orderBy: [{ dateStarted: 'desc' }, { dateStart: 'desc' }],
      include: LIST_INCLUDE,
    });
  }

  async get(enterpriseId: string, id: string) {
    const route = await this.prisma.route.findFirst({
      where: { id, enterpriseId },
      include: ROUTE_INCLUDE,
    });
    if (!route) throw new NotFoundException('Ruta no encontrada');
    return route;
  }

  /**
   * Historial operativo: rutas cerradas (COMPLETED/FINISHED/CANCELLED)
   * dentro de un rango de fechas, ordenadas por cierre descendente.
   */
  history(
    enterpriseId: string,
    opts: { from?: string; to?: string; driverId?: string; q?: string } = {},
  ) {
    const where: Prisma.RouteWhereInput = {
      enterpriseId,
      status: { in: [...TERMINAL_ROUTE_STATUSES] },
    };
    if (opts.driverId) where.driverId = opts.driverId;
    if (opts.q) {
      where.OR = [
        { name: { contains: opts.q, mode: 'insensitive' } },
        { driver: { name: { contains: opts.q, mode: 'insensitive' } } },
        { vehicle: { plate: { contains: opts.q, mode: 'insensitive' } } },
      ];
    }
    if (opts.from || opts.to) {
      const range: Prisma.DateTimeFilter = {};
      if (opts.from) range.gte = new Date(`${opts.from}T00:00:00`);
      if (opts.to) range.lte = new Date(`${opts.to}T23:59:59`);
      where.OR = [{ dateEnd: range }, { dateEnd: null, dateStart: range }];
    }

    return this.prisma.route.findMany({
      where,
      orderBy: [{ dateEnd: 'desc' }, { dateStart: 'desc' }],
      include: LIST_INCLUDE,
      take: 300,
    });
  }

  /** App móvil: rutas del conductor (RN-USR-01). */
  driverRoutes(driverId: string) {
    return this.prisma.route.findMany({
      where: { driverId, status: { notIn: [RouteStatus.CANCELLED] } },
      orderBy: [{ status: 'asc' }, { dateStarted: 'desc' }, { dateStart: 'desc' }],
      include: ROUTE_INCLUDE,
    });
  }

  /** Reglas visibles para la app: qué puede hacer el operador con esta ruta. */
  async driverContext(enterpriseId: string, routeId: string) {
    const route = await this.get(enterpriseId, routeId);
    const s = await this.settings.get(enterpriseId);
    const requiredMissing = route.checklist.filter((c) => c.required && !(c.done && (!c.photo || c.photoUrl)));
    const startMissing = !route.kmInitial || !route.gasInitial; // 0 = no capturado (RN-GAS-03)
    const canOperateStops =
      ([RouteStatus.ENROUTE, RouteStatus.PAUSED] as RouteStatus[]).includes(route.status) && !startMissing;
    return {
      route,
      settings: {
        sms_active: s.sms_active,
        signature_active: s.signature_active,
        stops_order_restriction: s.stops_order_restriction,
        stops_wait_approval: s.stops_wait_approval,
      },
      canOperateStops,
      startMissing,
      requiredChecklistPending: requiredMissing.map((c) => c.id),
    };
  }

  // ─────────────────────────── alta / duplicado ───────────────────────────

  async create(enterpriseId: string, dto: CreateRouteDto) {
    let stopIds = dto.stopIds ?? [];
    let clientId = dto.clientId;

    if (dto.templateId) {
      const tpl = await this.prisma.routeTemplate.findFirst({
        where: { id: dto.templateId, enterpriseId },
        include: { stops: { orderBy: { position: 'asc' } } },
      });
      if (!tpl) throw new BadRequestException('Plantilla no encontrada');
      if (!stopIds.length) stopIds = tpl.stops.map((s) => s.stopId);
      clientId = clientId ?? tpl.clientId ?? undefined;
    }

    // RN-RTE-01: al menos origen y destino.
    if (stopIds.length < 2) {
      throw new BadRequestException('La ruta requiere al menos origen y destino (2 paradas)');
    }
    if (!dto.driverId || !dto.vehicleId) {
      throw new BadRequestException('La ruta exige operador y unidad');
    }

    const stops = await this.prisma.stop.findMany({
      where: { id: { in: stopIds }, enterpriseId },
    });
    if (new Set(stops.map((s) => s.id)).size !== new Set(stopIds).size) {
      throw new BadRequestException('Alguna parada no pertenece a la empresa');
    }
    // RN-STP-03: archivadas no se ofrecen en altas nuevas.
    if (stops.some((s) => s.isArchived)) {
      throw new BadRequestException('No se pueden usar paradas archivadas');
    }

    await this.assertAssignable(enterpriseId, dto.driverId, dto.vehicleId);

    // RN-CLI-03 / RN-RTE-03 / RN-CHK-01: copiar checklist del cliente.
    const checklistCreate = await this.checklistFromClient(clientId);

    const route = await this.prisma.route.create({
      data: {
        name: dto.name.trim(),
        status: RouteStatus.PENDING, // RN-RTE-05
        dateStart: dto.dateStart ? new Date(dto.dateStart) : new Date(),
        enterpriseId,
        driverId: dto.driverId,
        vehicleId: dto.vehicleId,
        clientId,
        templateId: dto.templateId,
        events: {
          create: stopIds.map((stopId, idx) => ({ position: idx + 1, stopId })),
        },
        checklist: checklistCreate.length ? { create: checklistCreate } : undefined,
      },
    });

    await this.syncEntities(route.id); // RN-RTE-06
    return this.get(enterpriseId, route.id);
  }

  /** RN-RTE-08: copia sin evidencias ni avance. */
  async duplicate(enterpriseId: string, id: string, dto: DuplicateRouteDto) {
    const src = await this.get(enterpriseId, id);
    const driverId = dto.driverId ?? src.driverId;
    const vehicleId = dto.vehicleId ?? src.vehicleId;
    if (!driverId || !vehicleId) throw new BadRequestException('La ruta exige operador y unidad');
    await this.assertAssignable(enterpriseId, driverId, vehicleId);

    const route = await this.prisma.route.create({
      data: {
        name: `${src.name} (Copia)`,
        status: RouteStatus.PENDING,
        dateStart: dto.dateStart ? new Date(dto.dateStart) : new Date(),
        enterpriseId,
        driverId,
        vehicleId,
        clientId: src.clientId,
        templateId: src.templateId,
        polyline: src.polyline,
        totalDistance: src.totalDistance,
        totalDuration: src.totalDuration,
        events: {
          create: src.events.map((e) => ({ position: e.position, stopId: e.stopId, priority: e.priority })),
        },
        checklist: src.checklist.length
          ? { create: src.checklist.map((c) => ({ label: c.label, required: c.required, photo: c.photo })) }
          : undefined,
      },
    });
    await this.syncEntities(route.id);
    return this.get(enterpriseId, route.id);
  }

  // ─────────────────────────── ciclo de vida ───────────────────────────

  async changeStatus(enterpriseId: string, id: string, status: RouteStatus, actor: User) {
    const route = await this.getOwned(enterpriseId, id, actor);

    if (status === RouteStatus.CANCELLED && actor.role === UserRole.DRIVER) {
      throw new ForbiddenException('Cancelar es una acción del administrador'); // RN-STA-08
    }
    if (!canTransition(route.status, status)) {
      throw new BadRequestException(`Transición no permitida: ${route.status} → ${status}`);
    }
    // RN-STA-01: no se puede pasar a ENROUTE sin km/gas inicial + checklist obligatorio.
    if (status === RouteStatus.ENROUTE && route.status !== RouteStatus.PAUSED) {
      await this.assertReadyToDepart(route.id);
    }
    await this.applyStatus(route, status);
    return this.get(enterpriseId, id);
  }

  /**
   * Checklist de salida (RN-STA-02): km + gas inicial + evidencias.
   * Obligatorios sin foto → CHECKLIST_PENDING; completos → ENROUTE.
   */
  async start(enterpriseId: string, id: string, dto: StartRouteDto, actor: User) {
    const route = await this.getOwned(enterpriseId, id, actor);
    if (!([RouteStatus.PENDING, RouteStatus.CHECKLIST, RouteStatus.CHECKLIST_PENDING] as RouteStatus[]).includes(route.status)) {
      throw new BadRequestException('La ruta ya fue iniciada');
    }
    // RN-GAS-03: 0 = no capturado.
    if (!(dto.kmInitial > 0) || !(dto.gasInitial > 0)) {
      throw new BadRequestException('Km inicial y gasolina inicial son obligatorios');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const c of dto.checklist ?? []) {
        await tx.checklistEvent.updateMany({
          where: { id: c.itemId, routeId: id },
          data: {
            done: c.done ?? Boolean(c.photoUrl),
            photoUrl: c.photoUrl ?? undefined,
          },
        });
      }
      await tx.route.update({
        where: { id },
        data: {
          kmInitial: dto.kmInitial,
          gasInitial: dto.gasInitial,
          startLat: dto.lat ?? undefined, // RN-CHK-05: GPS opcional
          startLng: dto.lng ?? undefined,
        },
      });
    });

    const fresh = await this.prisma.route.findUniqueOrThrow({ where: { id }, include: { checklist: true } });
    const pendingRequired = fresh.checklist.some((c) => c.required && !this.checklistItemFulfilled(c));
    await this.applyStatus(fresh, pendingRequired ? RouteStatus.CHECKLIST_PENDING : RouteStatus.ENROUTE);
    return this.get(enterpriseId, id);
  }

  /** RN-STA-03: el admin aprueba el checklist y libera a ENROUTE. */
  async approveChecklist(enterpriseId: string, id: string) {
    const route = await this.get(enterpriseId, id);
    if (route.status !== RouteStatus.CHECKLIST_PENDING) {
      throw new BadRequestException('Solo se aprueba un checklist pendiente');
    }
    await this.prisma.checklistEvent.updateMany({ where: { routeId: id, required: true }, data: { done: true } });
    await this.applyStatus(route, RouteStatus.ENROUTE);
    return this.get(enterpriseId, id);
  }

  /** RN-STA-08: cancelar (admin). */
  async cancel(enterpriseId: string, id: string, dto: CancelRouteDto) {
    const route = await this.get(enterpriseId, id);
    if (isTerminalRoute(route.status)) throw new BadRequestException('La ruta ya está cerrada');
    await this.prisma.route.update({ where: { id }, data: { cancelReason: dto.reason ?? null } });
    await this.applyStatus(route, RouteStatus.CANCELLED);
    return this.get(enterpriseId, id);
  }

  /** RN-STA-07: "Terminar" del conductor → FINISHED. */
  async finish(enterpriseId: string, id: string, actor: User, dto?: Partial<CloseRouteDto>) {
    const route = await this.getOwned(enterpriseId, id, actor);
    if (isTerminalRoute(route.status)) throw new BadRequestException('La ruta ya está cerrada');
    if (route.status === RouteStatus.PENDING) {
      throw new BadRequestException('No se puede terminar una ruta que no ha iniciado');
    }
    if (dto && (dto.kmFinal || dto.gasFinal)) {
      await this.prisma.route.update({
        where: { id },
        data: { kmFinal: dto.kmFinal ?? undefined, gasFinal: dto.gasFinal ?? undefined },
      });
    }
    await this.applyStatus(route, RouteStatus.FINISHED);
    return this.get(enterpriseId, id);
  }

  /**
   * Cierre del destino (RN-EVT-08 / RN-STA-06 / RN-GAS-02): evidencia de llegada + km/gas final.
   * Estampa dateEnd (date_completed) y pasa a COMPLETED.
   */
  async closeDestination(enterpriseId: string, id: string, dto: CloseRouteDto, actor: User) {
    const route = await this.getOwned(enterpriseId, id, actor);
    if (!([RouteStatus.ENROUTE, RouteStatus.PAUSED] as RouteStatus[]).includes(route.status)) {
      throw new BadRequestException('Solo se cierra el destino de una ruta en curso');
    }
    if (!(dto.kmFinal > 0) || !(dto.gasFinal > 0)) {
      throw new BadRequestException('Km final y gasolina final son obligatorios');
    }
    await this.prisma.route.update({
      where: { id },
      data: {
        kmFinal: dto.kmFinal,
        gasFinal: dto.gasFinal,
        finalImg: dto.finalImg ?? undefined,
        finalLat: dto.finalLat ?? undefined,
        finalLng: dto.finalLng ?? undefined,
      },
    });
    await this.applyStatus(route, RouteStatus.COMPLETED);
    return this.get(enterpriseId, id);
  }

  // ─────────────────────────── paradas ───────────────────────────

  async reorderStops(enterpriseId: string, id: string, eventIdsInOrder: string[], actor?: User) {
    const route =
      actor?.role === UserRole.DRIVER
        ? await this.getOwned(enterpriseId, id, actor)
        : await this.get(enterpriseId, id);
    if (isTerminalRoute(route.status)) throw new BadRequestException('La ruta ya está cerrada');
    const ids = new Set(route.events.map((e) => e.id));
    if (eventIdsInOrder.some((eid) => !ids.has(eid))) {
      throw new BadRequestException('Evento inválido para esta ruta');
    }
    if (eventIdsInOrder.length !== route.events.length) {
      throw new BadRequestException('Debes incluir todas las paradas de la ruta');
    }
    await this.prisma.$transaction(
      eventIdsInOrder.map((eid, idx) =>
        this.prisma.event.update({ where: { id: eid }, data: { position: idx + 1 } }),
      ),
    );
    return this.get(enterpriseId, id);
  }

  /** Añade una parada del catálogo al final de la ruta (planificador admin). */
  async addStopToRoute(enterpriseId: string, routeId: string, stopId: string) {
    const route = await this.get(enterpriseId, routeId);
    if (isTerminalRoute(route.status)) throw new BadRequestException('La ruta ya está cerrada');
    if (route.events.some((e) => e.stopId === stopId)) {
      throw new BadRequestException('Esa parada ya está en la ruta');
    }
    const stop = await this.prisma.stop.findFirst({
      where: { id: stopId, enterpriseId, isArchived: false },
    });
    if (!stop) throw new NotFoundException('Parada no encontrada');
    const maxPos = route.events.reduce((m, e) => Math.max(m, e.position), 0);
    await this.prisma.event.create({
      data: { routeId, stopId, position: maxPos + 1 },
    });
    return this.get(enterpriseId, routeId);
  }

  /** Quita una parada pendiente de la ruta (mínimo 2 paradas). */
  async removeEventFromRoute(enterpriseId: string, routeId: string, eventId: string) {
    const route = await this.get(enterpriseId, routeId);
    if (isTerminalRoute(route.status)) throw new BadRequestException('La ruta ya está cerrada');
    if (route.events.length <= 2) {
      throw new BadRequestException('La ruta debe conservar al menos dos paradas');
    }
    const event = route.events.find((e) => e.id === eventId);
    if (!event) throw new NotFoundException('Parada no encontrada');
    if (event.status === EventStatus.COMPLETED) {
      throw new BadRequestException('No se quita una parada ya completada');
    }
    await this.prisma.event.delete({ where: { id: eventId } });
    const remaining = route.events
      .filter((e) => e.id !== eventId)
      .sort((a, b) => a.position - b.position);
    await this.prisma.$transaction(
      remaining.map((e, idx) =>
        this.prisma.event.update({ where: { id: e.id }, data: { position: idx + 1 } }),
      ),
    );
    return this.get(enterpriseId, routeId);
  }

  /**
   * Optimiza orden: urgentes primero, resto por ETA y Mapbox Optimization (≤12 puntos).
   */
  async optimizeRoute(enterpriseId: string, routeId: string) {
    const route = await this.get(enterpriseId, routeId);
    if (isTerminalRoute(route.status)) throw new BadRequestException('La ruta ya está cerrada');
    const sorted = [...route.events].sort((a, b) => a.position - b.position);
    const urgent = sorted.filter((e) => e.priority === 'URGENT');
    const rest = sorted.filter((e) => e.priority !== 'URGENT');
    const orderedRest = await this.orderEventsForTravel(rest);
    const ordered = [...urgent, ...orderedRest];
    const eventIds = ordered.map((e) => e.id);
    return this.reorderStops(enterpriseId, routeId, eventIds);
  }

  private async orderEventsForTravel(
    events: { id: string; position: number; eta: Date | null; stop: { lat: number; lng: number } }[],
  ) {
    if (events.length <= 1) return events;
    const byEta = [...events].sort((a, b) => {
      const ta = a.eta?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const tb = b.eta?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return ta - tb || a.position - b.position;
    });
    if (events.length > 12) return byEta;
    const token = process.env.MAPBOX_ACCESS_TOKEN?.trim();
    if (!token) return byEta;
    try {
      const coords = byEta.map((e) => `${e.stop.lng},${e.stop.lat}`).join(';');
      const url =
        `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coords}` +
        `?overview=false&source=first&destination=last&roundtrip=false&access_token=${token}`;
      const res = await fetch(url);
      if (!res.ok) return byEta;
      const json = (await res.json()) as {
        waypoints?: { waypoint_index: number; trips_index: number }[];
      };
      const wps = json.waypoints;
      if (!wps?.length) return byEta;
      const order = [...wps].sort((a, b) => a.waypoint_index - b.waypoint_index);
      return order.map((wp) => byEta[wp.waypoint_index]).filter(Boolean);
    } catch {
      return byEta;
    }
  }

  /** Cambios de estado operativo de la parada (route/issue/service/prioridad) sin evidencia. */
  async updateEvent(enterpriseId: string, routeId: string, eventId: string, dto: UpdateEventDto, actor: User) {
    const route = await this.getOwned(enterpriseId, routeId, actor);
    const event = route.events.find((e) => e.id === eventId);
    if (!event) throw new NotFoundException('Parada no encontrada');
    if (event.status === EventStatus.COMPLETED) {
      throw new BadRequestException('Una parada completada no se edita (RN-EVT-14)'); // salvo reintento explícito
    }
    // Completar exige evidencia (RN-EVT-03): usar submitEvidence.
    if (dto.status === EventStatus.COMPLETED || (dto.deliverStatus && dto.deliverStatus !== DeliverStatus.PENDING)) {
      throw new BadRequestException('Para completar una parada envía evidencia con foto');
    }
    if (dto.status && dto.status !== EventStatus.PENDING) {
      await this.assertCanOperateStops(route);
    }
    const data: Prisma.EventUpdateInput = { ...dto };
    if (dto.status === EventStatus.SERVICE && !event.arrivedAt) data.arrivedAt = new Date();
    await this.prisma.event.update({ where: { id: eventId }, data });
    return this.get(enterpriseId, routeId);
  }

  /**
   * Evidencia de parada intermedia (sección 8).
   * - Exige foto (RN-EVT-03), rechaza placeholders (RN-EVT-07).
   * - Reemplaza evidencias previas (RN-EVT-04).
   * - Respeta orden (RN-EVT-11/12) y aprobación (RN-EVT-09/10).
   * - Firma obligatoria si signature_active (RN-EVT-13).
   */
  async submitEvidence(
    enterpriseId: string,
    routeId: string,
    eventId: string,
    dto: SubmitEvidenceDto,
    actor: User,
  ) {
    const route = await this.getOwned(enterpriseId, routeId, actor);
    await this.assertCanOperateStops(route);
    const s = await this.settings.get(enterpriseId);

    const event = route.events.find((e) => e.id === eventId);
    if (!event) throw new NotFoundException('Parada no encontrada'); // RN-SEC-03
    if (event.status === EventStatus.COMPLETED) {
      throw new BadRequestException('La parada ya fue completada');
    }

    const images = (dto.images ?? []).filter((u) => typeof u === 'string');
    if (!images.length || images.some((u) => PLACEHOLDER_IMG.test(u))) {
      throw new BadRequestException('La evidencia requiere al menos una foto válida');
    }
    if (s.signature_active && !dto.signatureUrl) {
      throw new BadRequestException('Esta empresa exige firma del cliente en la entrega');
    }

    // RN-EVT-11: orden restringido → la anterior debe tener foto.
    if (!s.stops_order_restriction) {
      const prev = route.events.filter((e) => e.position < event.position).sort((a, b) => b.position - a.position)[0];
      if (prev && prev.evidences.length === 0) {
        throw new BadRequestException(
          `Debes atender primero la parada ${prev.position} (${prev.stop.label}) antes de esta`,
        );
      }
    }

    const autoApprove = !s.stops_wait_approval; // RN-EVT-09
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.evidence.deleteMany({ where: { eventId } }); // RN-EVT-04
      await tx.evidence.createMany({
        data: images.map((url) => ({ url, type: 'photo', approved: autoApprove, eventId })),
      });
      if (dto.signatureUrl) {
        await tx.evidence.create({ data: { url: dto.signatureUrl, type: 'signature', approved: autoApprove, eventId } });
      }
      await tx.event.update({
        where: { id: eventId },
        data: {
          deliverStatus: dto.deliverStatus,
          comment: dto.comment ?? null,
          evLat: dto.evLat ?? null, // RN-MAP-03
          evLng: dto.evLng ?? null,
          signatureUrl: dto.signatureUrl ?? null,
          approved: autoApprove,
          status: autoApprove ? EventStatus.COMPLETED : EventStatus.SERVICE,
          completedAt: autoApprove ? now : null,
          arrivedAt: event.arrivedAt ?? now,
        },
      });
    });

    await this.notify.notify(enterpriseId, {
      type: 'stop.completed',
      title: 'Parada atendida',
      body: `${route.name} · #${event.position} ${event.stop.label}`,
      routeId,
      href: '/app/routes',
    });

    return this.get(enterpriseId, routeId);
  }

  /** RN-EVT-10 / RN-EVD-04: el admin aprueba evidencia pendiente → parada completed. */
  async approveEvent(enterpriseId: string, routeId: string, eventId: string) {
    const route = await this.get(enterpriseId, routeId);
    const event = route.events.find((e) => e.id === eventId);
    if (!event) throw new NotFoundException('Parada no encontrada');
    if (event.approved) throw new BadRequestException('La parada ya está aprobada');
    if (!event.evidences.length) throw new BadRequestException('No hay evidencia que aprobar');
    await this.prisma.$transaction([
      this.prisma.evidence.updateMany({ where: { eventId }, data: { approved: true } }),
      this.prisma.event.update({
        where: { id: eventId },
        data: { approved: true, status: EventStatus.COMPLETED, completedAt: new Date() },
      }),
    ]);
    return this.get(enterpriseId, routeId);
  }

  /** RN-EVT-14: reintento explícito sobre una parada completada. */
  async retryEvent(enterpriseId: string, routeId: string, eventId: string) {
    const route = await this.get(enterpriseId, routeId);
    if (isTerminalRoute(route.status)) throw new BadRequestException('La ruta ya está cerrada');
    const event = route.events.find((e) => e.id === eventId);
    if (!event) throw new NotFoundException('Parada no encontrada');
    await this.prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.PENDING, deliverStatus: DeliverStatus.PENDING, approved: false, completedAt: null },
    });
    return this.get(enterpriseId, routeId);
  }

  async toggleChecklist(enterpriseId: string, routeId: string, itemId: string, done: boolean, photoUrl: string | undefined, actor: User) {
    const route = await this.getOwned(enterpriseId, routeId, actor);
    const item = route.checklist.find((c) => c.id === itemId);
    if (!item) throw new NotFoundException('Item de checklist no encontrado');
    await this.prisma.checklistEvent.update({
      where: { id: itemId },
      data: { done, photoUrl: photoUrl ?? (done ? item.photoUrl : null) },
    });

    if (route.status === RouteStatus.CHECKLIST || route.status === RouteStatus.CHECKLIST_PENDING) {
      const fresh = await this.prisma.route.findUniqueOrThrow({ where: { id: routeId }, include: { checklist: true } });
      const pendingRequired = fresh.checklist.some((c) => c.required && !this.checklistItemFulfilled(c));
      const newStatus = pendingRequired ? RouteStatus.CHECKLIST_PENDING : RouteStatus.CHECKLIST;
      if (newStatus !== fresh.status) await this.applyStatus(fresh, newStatus);
    }
    return this.get(enterpriseId, routeId);
  }

  // ─────────────────────────── gastos e incidencias ───────────────────────────

  /** RN-GST-02/03: inserta o actualiza sin duplicar. */
  async saveExpense(enterpriseId: string, routeId: string, dto: ExpenseDto, actor: User) {
    await this.getOwned(enterpriseId, routeId, actor);
    if (PLACEHOLDER_IMG.test(dto.imageUrl)) throw new BadRequestException('Comprobante inválido');
    if (dto.id) {
      const existing = await this.prisma.expense.findFirst({ where: { id: dto.id, routeId } });
      if (!existing) throw new NotFoundException('Gasto no encontrado');
      if (existing.status === 'DONE') throw new BadRequestException('Un gasto completado no se vuelve a capturar');
      await this.prisma.expense.update({
        where: { id: dto.id },
        data: { concept: dto.concept, paymentType: dto.paymentType, amount: dto.amount, comment: dto.comment, imageUrl: dto.imageUrl },
      });
    } else {
      await this.prisma.expense.create({
        data: { routeId, concept: dto.concept, paymentType: dto.paymentType, amount: dto.amount, comment: dto.comment, imageUrl: dto.imageUrl },
      });
    }
    return this.get(enterpriseId, routeId);
  }

  async markExpenseDone(enterpriseId: string, routeId: string, expenseId: string) {
    await this.get(enterpriseId, routeId);
    await this.prisma.expense.update({ where: { id: expenseId }, data: { status: 'DONE' } });
    return this.get(enterpriseId, routeId);
  }

  /** RN-INC-01/03: hecho operativo, no cambia el estado de la ruta. */
  async addIncident(enterpriseId: string, routeId: string, dto: IncidentDto, actor: User) {
    const route = await this.getOwned(enterpriseId, routeId, actor);
    if (!OPEN_ROUTE_STATUSES.includes(route.status)) {
      throw new BadRequestException('Las incidencias se registran sobre una ruta en curso');
    }
    await this.prisma.incident.create({
      data: {
        routeId,
        reason: dto.reason,
        comment: dto.comment,
        photos: (dto.photos ?? []).slice(0, 5),
        lat: dto.lat,
        lng: dto.lng,
      },
    });
    const reasonLabel: Record<string, string> = {
      CAR_ACCIDENT: 'Accidente',
      HOSPITAL: 'Hospital',
      WC: 'Baño',
      RESTAURANT: 'Restaurante',
      PARKING: 'Estacionamiento',
      TRAFFIC: 'Tráfico',
      GAS: 'Gasolina',
      ROBBERY: 'Robo',
      OTHER: 'Otro',
    };
    await this.notify.notify(route.enterpriseId, {
      type: 'incident',
      title: 'Incidencia reportada',
      body: `${route.name}: ${reasonLabel[dto.reason] ?? dto.reason}`,
      routeId,
      href: '/app/routes',
    });
    return this.get(enterpriseId, routeId);
  }

  /** Incidencias del día operativo (RN-INC-02). */
  async incidentsOfDay(enterpriseId: string, day?: string) {
    const d = day ?? todayBusinessDay();
    const { start, end } = businessDayRange(d);
    return this.prisma.incident.findMany({
      where: {
        route: {
          enterpriseId,
          OR: [
            { dateStarted: { gte: start, lt: end } },
            { dateStarted: null, dateStart: { gte: start, lt: end } },
          ],
        },
      },
      include: { route: { select: { id: true, name: true, driver: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─────────────────────────── notificaciones ───────────────────────────

  /** RN-ADM-04 / RN-NOT-01: WhatsApp al chofer; devuelve un deep link wa.me. */
  async notifyDriver(enterpriseId: string, routeId: string, message?: string) {
    const route = await this.get(enterpriseId, routeId);
    const s = await this.settings.get(enterpriseId);
    if (!s.whatsapp_notifications) throw new BadRequestException('Notificaciones de WhatsApp desactivadas');
    if (!route.driver?.phone) throw new BadRequestException('El operador no tiene teléfono');
    if (!NOTIFY_DRIVER_STATUSES.includes(route.status)) {
      throw new BadRequestException('Solo se notifica al chofer con ruta en ruta o pausada');
    }
    const text = message ?? `Hola ${route.driver.name}, seguimiento de la ruta "${route.name}".`;
    const phone = route.driver.phone.replace(/\D/g, '');
    return { ok: true, channel: 'whatsapp', link: `https://wa.me/${phone}?text=${encodeURIComponent(text)}` };
  }

  /** RN-ADM-03 / RN-NOT-02/04: aviso al cliente de una parada por su phone_notification. */
  async notifyClient(enterpriseId: string, routeId: string, eventId: string) {
    const route = await this.get(enterpriseId, routeId);
    if (!NOTIFY_CLIENT_STATUSES.includes(route.status)) {
      throw new BadRequestException('Solo se notifica al cliente con la ruta en progreso');
    }
    const ev = route.events.find((e) => e.id === eventId);
    if (!ev) throw new NotFoundException('Parada no encontrada');
    const phone = ev.stop.phoneNotification;
    if (!phone) throw new BadRequestException('La parada no tiene teléfono de notificación');
    const text = `Tu pedido de "${route.name}" va en camino. Parada ${ev.position}: ${ev.stop.label}.`;
    return {
      ok: true,
      channel: 'sms',
      to: phone,
      message: text,
      link: `sms:${phone.replace(/\s/g, '')}?body=${encodeURIComponent(text)}`,
    };
  }

  // ─────────────────────────── borrar / KPIs ───────────────────────────

  async remove(enterpriseId: string, id: string) {
    const route = await this.prisma.route.findFirst({ where: { id, enterpriseId } });
    if (!route) throw new NotFoundException('Ruta no encontrada');
    await this.prisma.route.delete({ where: { id } }); // RN-RTE-09: cascade checklist_event
    await this.releaseEntitiesIfIdle(route.driverId, route.vehicleId);
    return { ok: true };
  }

  /** RN-SYN-02/03. */
  async kpis(enterpriseId: string, day?: string) {
    const d = day ?? todayBusinessDay();
    const { start, end } = businessDayRange(d);
    const dayFilter: Prisma.RouteWhereInput = {
      enterpriseId,
      OR: [
        { dateStarted: { gte: start, lt: end } },
        { dateStarted: null, dateStart: { gte: start, lt: end } },
        { status: { in: IN_PROGRESS_ROUTE_STATUSES } },
      ],
    };

    const [pending, inProgress, paused, completed, cancelled, drivers, vehicles, driversAvailable, vehiclesAvailable, pendingApprovals] =
      await Promise.all([
        this.prisma.route.count({ where: { ...dayFilter, status: RouteStatus.PENDING } }),
        this.prisma.route.count({ where: { ...dayFilter, status: { in: KPI_IN_PROGRESS_STATUSES } } }),
        this.prisma.route.count({ where: { ...dayFilter, status: RouteStatus.PAUSED } }),
        this.prisma.route.count({ where: { ...dayFilter, status: { in: [RouteStatus.COMPLETED, RouteStatus.FINISHED] } } }),
        this.prisma.route.count({ where: { ...dayFilter, status: RouteStatus.CANCELLED } }),
        this.prisma.driver.count({ where: { enterpriseId } }),
        this.prisma.vehicle.count({ where: { enterpriseId } }),
        this.prisma.driver.count({ where: { enterpriseId, status: DriverStatus.AVAILABLE } }),
        this.prisma.vehicle.count({ where: { enterpriseId, status: VehicleStatus.AVAILABLE } }),
        this.prisma.event.count({
          where: { route: { enterpriseId }, approved: false, evidences: { some: {} } },
        }),
      ]);

    const events = await this.prisma.event.groupBy({
      by: ['deliverStatus'],
      where: { route: dayFilter },
      _count: true,
    });
    const count = (s: DeliverStatus) => events.find((e) => e.deliverStatus === s)?._count ?? 0;
    const stopsTotal = events.reduce((acc, e) => acc + (e._count as number), 0);
    const delivered = count(DeliverStatus.DELIVERED);
    const partial = count(DeliverStatus.PARTIAL);
    const notDelivered = count(DeliverStatus.NOTDELIVERED);

    return {
      day: d,
      pending,
      enroute: inProgress,
      paused,
      completed,
      cancelled,
      drivers,
      vehicles,
      driversAvailable,
      vehiclesAvailable,
      pendingApprovals,
      stopsTotal,
      stopsDelivered: delivered + partial + notDelivered,
      delivered,
      partial,
      notDelivered,
    };
  }

  /**
   * Series para el dashboard (inspirado en paneles tipo "Sales overview"):
   * barras por día operativo, comparación con periodo anterior, dona de resultados,
   * heatmap día×hora de entregas y rutas recientes.
   */
  async series(enterpriseId: string, days = 14) {
    const n = Math.min(Math.max(days, 7), 60);
    const today = todayBusinessDay();
    const { end } = businessDayRange(today);
    const { start: startPrev } = businessDayRange(shiftDay(today, -(n * 2 - 1)));
    const { start: startCur } = businessDayRange(shiftDay(today, -(n - 1)));

    const routes = await this.prisma.route.findMany({
      where: {
        enterpriseId,
        OR: [
          { dateStarted: { gte: startPrev, lt: end } },
          { dateStarted: null, dateStart: { gte: startPrev, lt: end } },
        ],
      },
      select: {
        id: true, name: true, status: true, dateStart: true, dateStarted: true, dateEnd: true,
        kmInitial: true, kmFinal: true, totalDistance: true,
        driver: { select: { id: true, name: true } },
        vehicle: { select: { id: true, plate: true, name: true } },
        events: { select: { deliverStatus: true, status: true, completedAt: true } },
        expenses: { select: { amount: true } },
        incidents: { select: { id: true } },
      },
      orderBy: { dateStart: 'desc' },
    });

    const dayKeys: string[] = [];
    for (let i = n - 1; i >= 0; i--) dayKeys.push(shiftDay(today, -i));
    const daily = new Map(dayKeys.map((k) => [k, { day: k, routes: 0, completed: 0, cancelled: 0, delivered: 0, partial: 0, notDelivered: 0, stops: 0, km: 0, expenses: 0 }]));
    const prev = { routes: 0, delivered: 0, stops: 0, km: 0, expenses: 0, completed: 0 };
    const cur = { routes: 0, delivered: 0, stops: 0, km: 0, expenses: 0, completed: 0 };
    const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const donut = { delivered: 0, partial: 0, notDelivered: 0, pending: 0 };

    for (const r of routes) {
      const eff = r.dateStarted ?? r.dateStart;
      const key = businessDayOf(eff);
      const isCur = eff >= startCur;
      const bucket = isCur ? cur : prev;
      const km = r.kmInitial != null && r.kmFinal != null ? Math.max(0, r.kmFinal - r.kmInitial) : Math.round((r.totalDistance ?? 0) / 1000);
      const exp = r.expenses.reduce((a, e) => a + e.amount, 0);
      const delivered = r.events.filter((e) => e.deliverStatus === DeliverStatus.DELIVERED).length;
      const partial = r.events.filter((e) => e.deliverStatus === DeliverStatus.PARTIAL).length;
      const notDelivered = r.events.filter((e) => e.deliverStatus === DeliverStatus.NOTDELIVERED).length;
      const isDone = r.status === RouteStatus.COMPLETED || r.status === RouteStatus.FINISHED;

      bucket.routes++; bucket.delivered += delivered; bucket.stops += r.events.length; bucket.km += km; bucket.expenses += exp;
      if (isDone) bucket.completed++;

      if (isCur) {
        const d = daily.get(key);
        if (d) {
          d.routes++; d.delivered += delivered; d.partial += partial; d.notDelivered += notDelivered;
          d.stops += r.events.length; d.km += km; d.expenses += exp;
          if (isDone) d.completed++;
          if (r.status === RouteStatus.CANCELLED) d.cancelled++;
        }
        donut.delivered += delivered; donut.partial += partial; donut.notDelivered += notDelivered;
        donut.pending += r.events.length - delivered - partial - notDelivered;
        for (const e of r.events) {
          if (!e.completedAt) continue;
          const local = new Date(e.completedAt.getTime() - 6 * 3600e3);
          heat[(local.getUTCDay() + 6) % 7][local.getUTCHours()]++;
        }
      }
    }

    const pct = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : 100) : Math.round(((a - b) / b) * 1000) / 10);
    const recent = routes
      .filter((r) => (r.dateStarted ?? r.dateStart) >= startCur)
      .slice(0, 8)
      .map((r) => ({
        id: r.id, name: r.name, status: r.status, dateStart: r.dateStart, dateEnd: r.dateEnd,
        driver: r.driver, vehicle: r.vehicle,
        stops: r.events.length,
        delivered: r.events.filter((e) => e.deliverStatus === DeliverStatus.DELIVERED).length,
        km: r.kmInitial != null && r.kmFinal != null ? r.kmFinal - r.kmInitial : null,
        expenses: r.expenses.reduce((a, e) => a + e.amount, 0),
        incidents: r.incidents.length,
      }));

    return {
      days: n,
      from: dayKeys[0],
      to: today,
      daily: dayKeys.map((k) => daily.get(k)!),
      totals: {
        routes: cur.routes, completed: cur.completed, delivered: cur.delivered, stops: cur.stops, km: cur.km, expenses: cur.expenses,
        successRate: cur.stops ? Math.round((cur.delivered / cur.stops) * 100) : 0,
      },
      trend: {
        routes: pct(cur.routes, prev.routes),
        delivered: pct(cur.delivered, prev.delivered),
        km: pct(cur.km, prev.km),
        expenses: pct(cur.expenses, prev.expenses),
        completed: pct(cur.completed, prev.completed),
      },
      donut,
      heatmap: heat,
      recent,
    };
  }

  // ─────────────────────────── internos ───────────────────────────

  private checklistItemFulfilled(c: { done: boolean; photo: boolean; photoUrl: string | null; required: boolean }) {
    // RN-CHK-03: un obligatorio con foto requerida se cumple con evidencia.
    if (c.photo) return Boolean(c.photoUrl);
    return c.done;
  }

  private async checklistFromClient(clientId?: string | null) {
    if (!clientId) return [] as Prisma.ChecklistEventCreateWithoutRouteInput[];
    const items = await this.prisma.checklistItem.findMany({ where: { clientId }, orderBy: { position: 'asc' } });
    return items.map((i) => ({ label: i.label, required: i.required, photo: i.photo }));
  }

  /** RN-USR-01: un conductor solo opera sus rutas; admin/super supervisan (RN-USR-02). */
  private async getOwned(enterpriseId: string, id: string, actor: User) {
    const route = await this.get(enterpriseId, id);
    if (actor.role === UserRole.DRIVER) {
      const driver = await this.prisma.driver.findFirst({ where: { userId: actor.id } });
      if (!driver || route.driverId !== driver.id) {
        throw new ForbiddenException('Solo puedes operar tus propias rutas');
      }
    }
    return route;
  }

  /** RN-RTE-07 / RN-DRV-02 / RN-VEH-01/02. */
  private async assertAssignable(enterpriseId: string, driverId: string, vehicleId: string) {
    const [driver, vehicle] = await Promise.all([
      this.prisma.driver.findFirst({ where: { id: driverId, enterpriseId } }),
      this.prisma.vehicle.findFirst({ where: { id: vehicleId, enterpriseId } }),
    ]);
    if (!driver) throw new BadRequestException('Operador no encontrado');
    if (!vehicle) throw new BadRequestException('Unidad no encontrada');
    if (driver.status === DriverStatus.WORKSHOP || driver.status === DriverStatus.NODOCS || driver.status === DriverStatus.UNAVAILABLE) {
      throw new BadRequestException(`El operador ${driver.name} no está disponible (${driver.status.toLowerCase()})`);
    }
    if (vehicle.status === VehicleStatus.WORKSHOP || vehicle.status === VehicleStatus.UNAVAILABLE) {
      throw new BadRequestException(`La unidad ${vehicle.plate} está en taller / no disponible`);
    }
    const [driverBusy, vehicleBusy] = await Promise.all([
      this.prisma.route.findFirst({ where: { driverId, status: { in: OPEN_ROUTE_STATUSES } }, select: { name: true } }),
      this.prisma.route.findFirst({ where: { vehicleId, status: { in: OPEN_ROUTE_STATUSES } }, select: { name: true } }),
    ]);
    if (driverBusy) throw new BadRequestException(`El operador ya tiene un viaje abierto: ${driverBusy.name}`);
    if (vehicleBusy) throw new BadRequestException(`La unidad ya tiene un viaje abierto: ${vehicleBusy.name}`);
  }

  /** RN-STA-01 / RN-CHK-04/07. */
  private async assertReadyToDepart(routeId: string) {
    const r = await this.prisma.route.findUniqueOrThrow({ where: { id: routeId }, include: { checklist: true } });
    if (!r.kmInitial || !r.gasInitial) {
      throw new BadRequestException('Captura km inicial y gasolina inicial antes de salir');
    }
    if (r.checklist.some((c) => c.required && !this.checklistItemFulfilled(c))) {
      throw new BadRequestException('Completa el checklist obligatorio (o pide aprobación del admin)');
    }
  }

  private async assertCanOperateStops(route: Route) {
    if (!([RouteStatus.ENROUTE, RouteStatus.PAUSED] as RouteStatus[]).includes(route.status)) {
      throw new BadRequestException('Las paradas son de solo lectura hasta que la ruta esté en ruta');
    }
    if (!route.kmInitial || !route.gasInitial) {
      throw new BadRequestException('Faltan km/gasolina inicial para operar paradas');
    }
  }

  /** Aplica estado + timestamps (RN-STA-04/05) + sincroniza operador/unidad. */
  private async applyStatus(route: Route, status: RouteStatus) {
    const data: Prisma.RouteUpdateInput = { status };
    if (
      ([RouteStatus.ENROUTE, RouteStatus.CHECKLIST, RouteStatus.CHECKLIST_PENDING] as RouteStatus[]).includes(status) &&
      !route.dateStarted
    ) {
      data.dateStarted = new Date();
    }
    if ((status === RouteStatus.COMPLETED || status === RouteStatus.FINISHED) && !route.dateEnd) {
      data.dateEnd = new Date();
    }
    if (status === RouteStatus.CANCELLED && !route.dateEnd) {
      data.dateEnd = new Date();
    }
    await this.prisma.route.update({ where: { id: route.id }, data });
    await this.syncEntities(route.id);
    await this.notifyRouteStatus(route, status);
  }

  private async notifyRouteStatus(route: Route, status: RouteStatus) {
    const base = { routeId: route.id, href: '/app/routes' as const };
    switch (status) {
      case RouteStatus.ENROUTE:
        await this.notify.notify(route.enterpriseId, {
          ...base,
          type: 'route.started',
          title: 'Ruta en curso',
          body: `${route.name} — el conductor inició`,
        });
        break;
      case RouteStatus.COMPLETED:
      case RouteStatus.FINISHED:
        await this.notify.notify(route.enterpriseId, {
          ...base,
          type: 'route.completed',
          title: 'Ruta completada',
          body: `${route.name} — destino cerrado`,
        });
        break;
      case RouteStatus.PAUSED:
        await this.notify.notify(route.enterpriseId, {
          ...base,
          type: 'route.paused',
          title: 'Ruta pausada',
          body: route.name,
        });
        break;
      case RouteStatus.CANCELLED:
        await this.notify.notify(route.enterpriseId, {
          ...base,
          type: 'route.cancelled',
          title: 'Ruta cancelada',
          body: route.name,
        });
        break;
    }
  }

  /** Tabla 6.3 + RN-SYN-01. */
  private async syncEntities(routeId: string) {
    const route = await this.prisma.route.findUniqueOrThrow({ where: { id: routeId } });
    if (isTerminalRoute(route.status)) {
      await this.releaseEntitiesIfIdle(route.driverId, route.vehicleId);
      return;
    }
    const mapped = mapRouteStatusToEntityStatus(route.status);
    if (route.driverId) {
      await this.prisma.driver.update({ where: { id: route.driverId }, data: { status: mapped.driver } });
    }
    if (route.vehicleId) {
      await this.prisma.vehicle.update({ where: { id: route.vehicleId }, data: { status: mapped.vehicle } });
    }
  }

  /** RN-SYN-01 / RN-VEH-03: hereda otro viaje abierto; si no hay, available (respetando estados manuales). */
  private async releaseEntitiesIfIdle(driverId?: string | null, vehicleId?: string | null) {
    if (driverId) {
      const other = await this.prisma.route.findFirst({
        where: { driverId, status: { in: OPEN_ROUTE_STATUSES } },
        orderBy: { dateStart: 'asc' },
      });
      const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
      if (driver && !MANUAL_DRIVER_STATUSES.includes(driver.status)) {
        const status = other ? mapRouteStatusToEntityStatus(other.status).driver : DriverStatus.AVAILABLE;
        await this.prisma.driver.update({ where: { id: driverId }, data: { status } });
      }
    }
    if (vehicleId) {
      const other = await this.prisma.route.findFirst({
        where: { vehicleId, status: { in: OPEN_ROUTE_STATUSES } },
        orderBy: { dateStart: 'asc' },
      });
      const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
      if (vehicle && !MANUAL_VEHICLE_STATUSES.includes(vehicle.status)) {
        const status = other ? mapRouteStatusToEntityStatus(other.status).vehicle : VehicleStatus.AVAILABLE;
        await this.prisma.vehicle.update({ where: { id: vehicleId }, data: { status } });
      }
    }
  }
}

export { TERMINAL_ROUTE_STATUSES };
