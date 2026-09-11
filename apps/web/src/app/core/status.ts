type BadgeKind = 'ok' | 'warn' | 'danger' | 'info' | 'muted';

export const ROUTE_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  CHECKLIST: 'Checklist',
  CHECKLIST_PENDING: 'Checklist pend.',
  ENROUTE: 'En ruta',
  PAUSED: 'Pausada',
  COMPLETED: 'Completada',
  FINISHED: 'Finalizada',
  CANCELLED: 'Cancelada',
};

export const ROUTE_BADGE: Record<string, BadgeKind> = {
  PENDING: 'muted',
  CHECKLIST: 'info',
  CHECKLIST_PENDING: 'warn',
  ENROUTE: 'info',
  PAUSED: 'warn',
  COMPLETED: 'ok',
  FINISHED: 'ok',
  CANCELLED: 'danger',
};

export const DRIVER_LABEL: Record<string, string> = {
  AVAILABLE: 'Disponible',
  ENROUTE: 'En ruta',
  WORKSHOP: 'Taller',
  NODOCS: 'Sin docs',
  PAUSED: 'Pausado',
};

export const DRIVER_BADGE: Record<string, BadgeKind> = {
  AVAILABLE: 'ok',
  ENROUTE: 'info',
  WORKSHOP: 'danger',
  NODOCS: 'warn',
  PAUSED: 'warn',
};

export const VEHICLE_LABEL: Record<string, string> = {
  AVAILABLE: 'Disponible',
  ENROUTE: 'En ruta',
  WORKSHOP: 'Taller',
  PAUSED: 'Pausado',
};

export const VEHICLE_BADGE: Record<string, BadgeKind> = {
  AVAILABLE: 'ok',
  ENROUTE: 'info',
  WORKSHOP: 'danger',
  PAUSED: 'warn',
};

export function badgeClass(kind: BadgeKind): string {
  return `badge badge-${kind}`;
}
