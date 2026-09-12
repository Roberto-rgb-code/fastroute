import { Injectable } from '@nestjs/common';
import { DeliverStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { businessDayOf, businessDayRange, effectiveStart, todayBusinessDay } from '../common/business-day.util';

/**
 * Reportes (sección 15). Siempre filtran por día operativo con
 * COALESCE(date_started, date_start) en UTC-6 (RN-RPT-02) y por empresa (RN-RPT-04).
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private dayWhere(enterpriseId: string, from: string, to: string): Prisma.RouteWhereInput {
    const { start } = businessDayRange(from);
    const { end } = businessDayRange(to);
    return {
      enterpriseId,
      OR: [
        { dateStarted: { gte: start, lt: end } },
        { dateStarted: null, dateStart: { gte: start, lt: end } },
      ],
    };
  }

  /** Paradas: totales delivered / partial / notdelivered por separado (RN-RPT-03). */
  async stops(enterpriseId: string, from?: string, to?: string) {
    const f = from ?? todayBusinessDay();
    const t = to ?? f;
    const events = await this.prisma.event.findMany({
      where: { route: this.dayWhere(enterpriseId, f, t) },
      include: {
        stop: { select: { label: true, address: true, type: true, tag: true } },
        route: {
          select: {
            id: true,
            name: true,
            status: true,
            dateStart: true,
            dateStarted: true,
            driver: { select: { name: true } },
            vehicle: { select: { plate: true } },
          },
        },
      },
      orderBy: [{ route: { dateStart: 'asc' } }, { position: 'asc' }],
    });

    const totals = { delivered: 0, partial: 0, notDelivered: 0, pending: 0, total: events.length };
    const rows = events.map((e) => {
      switch (e.deliverStatus) {
        case DeliverStatus.DELIVERED: totals.delivered++; break;
        case DeliverStatus.PARTIAL: totals.partial++; break;
        case DeliverStatus.NOTDELIVERED: totals.notDelivered++; break;
        default: totals.pending++;
      }
      return {
        day: businessDayOf(effectiveStart(e.route)),
        route: e.route.name,
        routeId: e.route.id,
        routeStatus: e.route.status,
        driver: e.route.driver?.name ?? '',
        plate: e.route.vehicle?.plate ?? '',
        position: e.position,
        stop: e.stop.label,
        address: e.stop.address,
        type: e.stop.type,
        tag: e.stop.tag,
        status: e.status,
        deliverStatus: e.deliverStatus,
        approved: e.approved,
        completedAt: e.completedAt,
        comment: e.comment,
      };
    });
    return { from: f, to: t, totals, rows };
  }

  /** Operaciones: una fila por ruta con km/gas, duración y avance. */
  async operations(enterpriseId: string, from?: string, to?: string) {
    const f = from ?? todayBusinessDay();
    const t = to ?? f;
    const routes = await this.prisma.route.findMany({
      where: this.dayWhere(enterpriseId, f, t),
      include: {
        driver: { select: { name: true } },
        vehicle: { select: { plate: true } },
        client: { select: { name: true } },
        events: { select: { status: true, deliverStatus: true } },
        _count: { select: { incidents: true, expenses: true } },
        expenses: { select: { amount: true } },
      },
      orderBy: [{ dateStart: 'asc' }],
    });
    const rows = routes.map((r) => {
      const done = r.events.filter((e) => e.status === 'COMPLETED').length;
      const durationMin =
        r.dateStarted && r.dateEnd ? Math.round((r.dateEnd.getTime() - r.dateStarted.getTime()) / 60000) : null;
      return {
        day: businessDayOf(effectiveStart(r)),
        routeId: r.id,
        route: r.name,
        status: r.status,
        client: r.client?.name ?? '',
        driver: r.driver?.name ?? '',
        plate: r.vehicle?.plate ?? '',
        dateStart: r.dateStart,
        dateStarted: r.dateStarted,
        dateCompleted: r.dateEnd,
        durationMin,
        stops: r.events.length,
        stopsDone: done,
        kmInitial: r.kmInitial,
        kmFinal: r.kmFinal,
        kmTraveled: r.kmInitial && r.kmFinal ? r.kmFinal - r.kmInitial : null,
        gasInitial: r.gasInitial,
        gasFinal: r.gasFinal,
        incidents: r._count.incidents,
        expenses: r.expenses.reduce((a, e) => a + e.amount, 0),
      };
    });
    const totals = {
      routes: rows.length,
      completed: rows.filter((r) => r.status === 'COMPLETED' || r.status === 'FINISHED').length,
      cancelled: rows.filter((r) => r.status === 'CANCELLED').length,
      km: rows.reduce((a, r) => a + (r.kmTraveled ?? 0), 0),
      expenses: rows.reduce((a, r) => a + r.expenses, 0),
      incidents: rows.reduce((a, r) => a + r.incidents, 0),
    };
    return { from: f, to: t, totals, rows };
  }
}
