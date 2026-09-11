import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DeliverStatus,
  DriverStatus,
  EventStatus,
  Prisma,
  RouteStatus,
  VehicleStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isTerminalRoute, mapRouteStatusToEntityStatus } from '../common/route-status.util';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const ROUTE_INCLUDE = {
  driver: true,
  vehicle: true,
  client: true,
  events: {
    orderBy: { position: 'asc' as const },
    include: { stop: true, evidences: true },
  },
  checklist: true,
} satisfies Prisma.RouteInclude;

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  list(enterpriseId: string, status?: RouteStatus) {
    return this.prisma.route.findMany({
      where: { enterpriseId, status: status ?? undefined },
      orderBy: [{ dateStarted: 'desc' }, { dateStart: 'desc' }],
      include: {
        driver: true,
        vehicle: true,
        client: true,
        _count: { select: { events: true } },
        events: { select: { status: true } },
      },
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

  /** Routes assigned to a driver (mobile app). */
  driverRoutes(driverId: string) {
    return this.prisma.route.findMany({
      where: {
        driverId,
        status: { notIn: [RouteStatus.CANCELLED] },
      },
      orderBy: [{ dateStarted: 'desc' }, { dateStart: 'desc' }],
      include: ROUTE_INCLUDE,
    });
  }

  async create(enterpriseId: string, dto: CreateRouteDto) {
    if (!dto.stopIds?.length) {
      throw new BadRequestException('La ruta requiere al menos una parada');
    }

    const stops = await this.prisma.stop.findMany({
      where: { id: { in: dto.stopIds }, enterpriseId },
    });
    if (stops.length !== dto.stopIds.length) {
      throw new BadRequestException('Alguna parada no pertenece a la empresa');
    }

    // Instantiate checklist from client (if any)
    let checklistCreate: Prisma.ChecklistEventCreateWithoutRouteInput[] = [];
    if (dto.clientId) {
      const items = await this.prisma.checklistItem.findMany({
        where: { clientId: dto.clientId },
        orderBy: { position: 'asc' },
      });
      checklistCreate = items.map((i) => ({
        label: i.label,
        required: i.required,
        photo: i.photo,
      }));
    }

    const route = await this.prisma.route.create({
      data: {
        name: dto.name.trim(),
        status: RouteStatus.PENDING,
        dateStart: dto.dateStart ? new Date(dto.dateStart) : new Date(),
        enterpriseId,
        driverId: dto.driverId,
        vehicleId: dto.vehicleId,
        clientId: dto.clientId,
        events: {
          create: dto.stopIds.map((stopId, idx) => ({
            position: idx + 1,
            stopId,
          })),
        },
        checklist: checklistCreate.length ? { create: checklistCreate } : undefined,
      },
      include: ROUTE_INCLUDE,
    });

    await this.syncEntities(route.id);
    return this.get(enterpriseId, route.id);
  }

  async changeStatus(enterpriseId: string, id: string, status: RouteStatus) {
    const route = await this.prisma.route.findFirst({ where: { id, enterpriseId } });
    if (!route) throw new NotFoundException('Ruta no encontrada');

    const data: Prisma.RouteUpdateInput = { status };
    if (status === RouteStatus.ENROUTE && !route.dateStarted) {
      data.dateStarted = new Date();
    }
    if (isTerminalRoute(status) && !route.dateEnd) {
      data.dateEnd = new Date();
    }

    await this.prisma.route.update({ where: { id }, data });
    await this.syncEntities(id);
    return this.get(enterpriseId, id);
  }

  async reorderStops(enterpriseId: string, id: string, eventIdsInOrder: string[]) {
    const route = await this.get(enterpriseId, id);
    const ids = new Set(route.events.map((e) => e.id));
    if (eventIdsInOrder.some((eid) => !ids.has(eid))) {
      throw new BadRequestException('Evento inválido para esta ruta');
    }
    await this.prisma.$transaction(
      eventIdsInOrder.map((eid, idx) =>
        this.prisma.event.update({ where: { id: eid }, data: { position: idx + 1 } }),
      ),
    );
    return this.get(enterpriseId, id);
  }

  async updateEvent(enterpriseId: string, routeId: string, eventId: string, dto: UpdateEventDto) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, routeId, route: { enterpriseId } },
    });
    if (!event) throw new NotFoundException('Parada no encontrada');

    const data: Prisma.EventUpdateInput = { ...dto };
    if (dto.status === EventStatus.COMPLETED || dto.deliverStatus === DeliverStatus.DELIVERED) {
      data.completedAt = new Date();
      if (!dto.status) data.status = EventStatus.COMPLETED;
    }

    await this.prisma.event.update({ where: { id: eventId }, data });
    await this.maybeAutoComplete(enterpriseId, routeId);
    return this.get(enterpriseId, routeId);
  }

  async toggleChecklist(enterpriseId: string, routeId: string, itemId: string, done: boolean) {
    const item = await this.prisma.checklistEvent.findFirst({
      where: { id: itemId, routeId, route: { enterpriseId } },
    });
    if (!item) throw new NotFoundException('Item de checklist no encontrado');
    await this.prisma.checklistEvent.update({ where: { id: itemId }, data: { done } });

    // Recompute route checklist status
    const route = await this.prisma.route.findUniqueOrThrow({
      where: { id: routeId },
      include: { checklist: true },
    });
    if (route.status === RouteStatus.CHECKLIST || route.status === RouteStatus.CHECKLIST_PENDING) {
      const pendingRequired = route.checklist.some((c) => c.required && !c.done);
      const newStatus = pendingRequired ? RouteStatus.CHECKLIST_PENDING : RouteStatus.CHECKLIST;
      if (newStatus !== route.status) {
        await this.prisma.route.update({ where: { id: routeId }, data: { status: newStatus } });
      }
    }
    return this.get(enterpriseId, routeId);
  }

  async remove(enterpriseId: string, id: string) {
    const route = await this.prisma.route.findFirst({ where: { id, enterpriseId } });
    if (!route) throw new NotFoundException('Ruta no encontrada');
    await this.prisma.route.delete({ where: { id } });
    if (route.driverId || route.vehicleId) {
      await this.releaseEntitiesIfIdle(route.driverId, route.vehicleId);
    }
    return { ok: true };
  }

  async kpis(enterpriseId: string) {
    const [pending, enroute, completed, drivers, vehicles] = await Promise.all([
      this.prisma.route.count({ where: { enterpriseId, status: RouteStatus.PENDING } }),
      this.prisma.route.count({
        where: {
          enterpriseId,
          status: { in: [RouteStatus.ENROUTE, RouteStatus.CHECKLIST, RouteStatus.CHECKLIST_PENDING, RouteStatus.PAUSED] },
        },
      }),
      this.prisma.route.count({
        where: { enterpriseId, status: { in: [RouteStatus.COMPLETED, RouteStatus.FINISHED] } },
      }),
      this.prisma.driver.count({ where: { enterpriseId } }),
      this.prisma.vehicle.count({ where: { enterpriseId } }),
    ]);

    const events = await this.prisma.event.groupBy({
      by: ['status'],
      where: { route: { enterpriseId } },
      _count: true,
    });
    const stopsDelivered = events.find((e) => e.status === EventStatus.COMPLETED)?._count ?? 0;
    const stopsTotal = events.reduce((acc, e) => acc + (e._count as number), 0);

    return { pending, enroute, completed, drivers, vehicles, stopsDelivered, stopsTotal };
  }

  // --- internal ---

  private async maybeAutoComplete(enterpriseId: string, routeId: string) {
    const route = await this.prisma.route.findUniqueOrThrow({
      where: { id: routeId },
      include: { events: true },
    });
    if (route.events.length && route.events.every((e) => e.status === EventStatus.COMPLETED)) {
      if (!isTerminalRoute(route.status)) {
        await this.prisma.route.update({
          where: { id: routeId },
          data: { status: RouteStatus.COMPLETED, dateEnd: new Date() },
        });
        await this.syncEntities(routeId);
      }
    }
  }

  private async syncEntities(routeId: string) {
    const route = await this.prisma.route.findUniqueOrThrow({ where: { id: routeId } });
    const mapped = mapRouteStatusToEntityStatus(route.status);

    if (isTerminalRoute(route.status)) {
      await this.releaseEntitiesIfIdle(route.driverId, route.vehicleId);
      return;
    }
    if (route.driverId) {
      await this.prisma.driver.update({
        where: { id: route.driverId },
        data: { status: mapped.driver as DriverStatus },
      });
    }
    if (route.vehicleId) {
      await this.prisma.vehicle.update({
        where: { id: route.vehicleId },
        data: { status: mapped.vehicle as VehicleStatus },
      });
    }
  }

  private async releaseEntitiesIfIdle(driverId?: string | null, vehicleId?: string | null) {
    if (driverId) {
      const active = await this.prisma.route.count({
        where: {
          driverId,
          status: { in: [RouteStatus.ENROUTE, RouteStatus.CHECKLIST, RouteStatus.CHECKLIST_PENDING, RouteStatus.PAUSED, RouteStatus.PENDING] },
        },
      });
      if (active === 0) {
        await this.prisma.driver.update({
          where: { id: driverId },
          data: { status: DriverStatus.AVAILABLE },
        });
      }
    }
    if (vehicleId) {
      const active = await this.prisma.route.count({
        where: {
          vehicleId,
          status: { in: [RouteStatus.ENROUTE, RouteStatus.CHECKLIST, RouteStatus.CHECKLIST_PENDING, RouteStatus.PAUSED, RouteStatus.PENDING] },
        },
      });
      if (active === 0) {
        await this.prisma.vehicle.update({
          where: { id: vehicleId },
          data: { status: VehicleStatus.AVAILABLE },
        });
      }
    }
  }
}
