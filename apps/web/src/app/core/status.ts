type BadgeKind = 'ok' | 'warn' | 'danger' | 'info' | 'muted';

export const ROUTE_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  CHECKLIST: 'Checklist',
  CHECKLIST_PENDING: 'Checklist pend.',
  ENROUTE: 'En ruta',
  PAUSED: 'Pausada',
  COMPLETED: 'Completada',
  FINISHED: 'Terminada',
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
  CHECKLIST: 'Checklist',
  CHECKLIST_PENDING: 'Checklist pend.',
  WORKSHOP: 'Taller',
  NODOCS: 'Sin docs',
  UNAVAILABLE: 'No disponible',
  PAUSED: 'Pausado',
};

export const DRIVER_BADGE: Record<string, BadgeKind> = {
  AVAILABLE: 'ok',
  ENROUTE: 'info',
  CHECKLIST: 'info',
  CHECKLIST_PENDING: 'warn',
  WORKSHOP: 'danger',
  NODOCS: 'warn',
  UNAVAILABLE: 'muted',
  PAUSED: 'warn',
};

export const VEHICLE_LABEL: Record<string, string> = {
  AVAILABLE: 'Disponible',
  ENROUTE: 'En ruta',
  CHECKLIST: 'Checklist',
  CHECKLIST_PENDING: 'Checklist pend.',
  WORKSHOP: 'Taller',
  UNAVAILABLE: 'No disponible',
  PAUSED: 'Pausada',
};

export const VEHICLE_BADGE: Record<string, BadgeKind> = {
  AVAILABLE: 'ok',
  ENROUTE: 'info',
  CHECKLIST: 'info',
  CHECKLIST_PENDING: 'warn',
  WORKSHOP: 'danger',
  UNAVAILABLE: 'muted',
  PAUSED: 'warn',
};

export const EVENT_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  ROUTE: 'En camino',
  ISSUE: 'Con problema',
  SERVICE: 'En servicio',
  COMPLETED: 'Atendida',
};

export const EVENT_BADGE: Record<string, BadgeKind> = {
  PENDING: 'muted',
  ROUTE: 'info',
  ISSUE: 'danger',
  SERVICE: 'warn',
  COMPLETED: 'ok',
};

export const DELIVER_LABEL: Record<string, string> = {
  PENDING: '—',
  DELIVERED: 'Entregado',
  PARTIAL: 'Parcial',
  NOTDELIVERED: 'No entregado',
};

export const DELIVER_BADGE: Record<string, BadgeKind> = {
  PENDING: 'muted',
  DELIVERED: 'ok',
  PARTIAL: 'warn',
  NOTDELIVERED: 'danger',
};

export const STOP_TYPE_LABEL: Record<string, string> = {
  VISIT: 'Visita',
  GAS: 'Gasolina',
  PARKING: 'Estacionamiento',
  CEDIS: 'CEDIS',
  MAIN: 'Principal',
  WORKSHOP: 'Taller',
};

export const INCIDENT_LABEL: Record<string, string> = {
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

export const ROLE_LABEL: Record<string, string> = {
  SUPER: 'Super Admin',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  LOGISTICS: 'Logística',
  DRIVER: 'Conductor',
  EXTERNAL: 'Externo',
};

export function badgeClass(kind: BadgeKind): string {
  return `badge badge-${kind}`;
}
