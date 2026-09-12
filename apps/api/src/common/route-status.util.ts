import { DriverStatus, RouteStatus, VehicleStatus } from '@prisma/client';

/** En curso (RN-FEC-03 / RN-MAP-01): se listan y rastrean aunque su fecha no coincida. */
export const IN_PROGRESS_ROUTE_STATUSES: RouteStatus[] = [
  RouteStatus.CHECKLIST,
  RouteStatus.CHECKLIST_PENDING,
  RouteStatus.ENROUTE,
  RouteStatus.PAUSED,
];

/** Abiertos = comprometen operador/unidad (incluye PENDING). */
export const OPEN_ROUTE_STATUSES: RouteStatus[] = [RouteStatus.PENDING, ...IN_PROGRESS_ROUTE_STATUSES];

/** Terminales: liberan operador y unidad. */
export const TERMINAL_ROUTE_STATUSES: RouteStatus[] = [
  RouteStatus.COMPLETED,
  RouteStatus.FINISHED,
  RouteStatus.CANCELLED,
];

/** KPI "en curso" (RN-SYN-03): enroute + checklist + checklist-pending (sin paused). */
export const KPI_IN_PROGRESS_STATUSES: RouteStatus[] = [
  RouteStatus.ENROUTE,
  RouteStatus.CHECKLIST,
  RouteStatus.CHECKLIST_PENDING,
];

/** Estados en los que aplica notificar al cliente (RN-ADM-03 / RN-NOT-02). */
export const NOTIFY_CLIENT_STATUSES: RouteStatus[] = IN_PROGRESS_ROUTE_STATUSES;

/** Estados en los que aplica notificar al chofer (RN-ADM-04 / RN-NOT-01). */
export const NOTIFY_DRIVER_STATUSES: RouteStatus[] = [RouteStatus.ENROUTE, RouteStatus.PAUSED];

export function isActiveRoute(status: RouteStatus): boolean {
  return IN_PROGRESS_ROUTE_STATUSES.includes(status);
}

export function isOpenRoute(status: RouteStatus): boolean {
  return OPEN_ROUTE_STATUSES.includes(status);
}

export function isTerminalRoute(status: RouteStatus): boolean {
  return TERMINAL_ROUTE_STATUSES.includes(status);
}

/** Estados de operador/unidad que se ponen a mano y NO gobierna una ruta (RN-DRV-05). */
export const MANUAL_DRIVER_STATUSES: DriverStatus[] = [
  DriverStatus.WORKSHOP,
  DriverStatus.NODOCS,
  DriverStatus.UNAVAILABLE,
];
export const MANUAL_VEHICLE_STATUSES: VehicleStatus[] = [
  VehicleStatus.WORKSHOP,
  VehicleStatus.UNAVAILABLE,
];

/** Tabla 6.3: estado que heredan operador y unidad según el estado de la ruta. */
export function mapRouteStatusToEntityStatus(
  status: RouteStatus,
): { driver: DriverStatus; vehicle: VehicleStatus } {
  switch (status) {
    case RouteStatus.CHECKLIST:
      return { driver: DriverStatus.CHECKLIST, vehicle: VehicleStatus.CHECKLIST };
    case RouteStatus.CHECKLIST_PENDING:
      return { driver: DriverStatus.CHECKLIST_PENDING, vehicle: VehicleStatus.CHECKLIST_PENDING };
    case RouteStatus.PAUSED:
      return { driver: DriverStatus.PAUSED, vehicle: VehicleStatus.PAUSED };
    case RouteStatus.COMPLETED:
    case RouteStatus.FINISHED:
    case RouteStatus.CANCELLED:
      return { driver: DriverStatus.AVAILABLE, vehicle: VehicleStatus.AVAILABLE };
    case RouteStatus.PENDING:
    case RouteStatus.ENROUTE:
    default:
      return { driver: DriverStatus.ENROUTE, vehicle: VehicleStatus.ENROUTE };
  }
}

/**
 * Transiciones válidas del ciclo de vida (sección 6.2).
 * Las transiciones especiales (checklist/start, cierre de destino) las hace el servicio.
 */
const TRANSITIONS: Record<RouteStatus, RouteStatus[]> = {
  PENDING: [RouteStatus.CHECKLIST, RouteStatus.CANCELLED],
  CHECKLIST: [RouteStatus.CHECKLIST_PENDING, RouteStatus.ENROUTE, RouteStatus.CANCELLED, RouteStatus.FINISHED],
  CHECKLIST_PENDING: [RouteStatus.ENROUTE, RouteStatus.CANCELLED, RouteStatus.FINISHED],
  ENROUTE: [RouteStatus.PAUSED, RouteStatus.COMPLETED, RouteStatus.FINISHED, RouteStatus.CANCELLED],
  PAUSED: [RouteStatus.ENROUTE, RouteStatus.FINISHED, RouteStatus.CANCELLED],
  COMPLETED: [],
  FINISHED: [],
  CANCELLED: [],
};

export function canTransition(from: RouteStatus, to: RouteStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
