import { DriverStatus, RouteStatus, VehicleStatus } from '@prisma/client';

const ACTIVE_ROUTE_STATUSES: RouteStatus[] = [
  RouteStatus.CHECKLIST,
  RouteStatus.CHECKLIST_PENDING,
  RouteStatus.ENROUTE,
  RouteStatus.PAUSED,
];

const TERMINAL_ROUTE_STATUSES: RouteStatus[] = [
  RouteStatus.COMPLETED,
  RouteStatus.FINISHED,
  RouteStatus.CANCELLED,
];

export function isActiveRoute(status: RouteStatus): boolean {
  return ACTIVE_ROUTE_STATUSES.includes(status);
}

export function isTerminalRoute(status: RouteStatus): boolean {
  return TERMINAL_ROUTE_STATUSES.includes(status);
}

/** Maps a route status to the driver/vehicle status it should produce. */
export function mapRouteStatusToEntityStatus(
  status: RouteStatus,
): { driver: DriverStatus; vehicle: VehicleStatus } {
  if (isTerminalRoute(status)) {
    return { driver: DriverStatus.AVAILABLE, vehicle: VehicleStatus.AVAILABLE };
  }
  if (status === RouteStatus.PAUSED) {
    return { driver: DriverStatus.PAUSED, vehicle: VehicleStatus.PAUSED };
  }
  // pending, checklist, checklist-pending, enroute
  return { driver: DriverStatus.ENROUTE, vehicle: VehicleStatus.ENROUTE };
}
