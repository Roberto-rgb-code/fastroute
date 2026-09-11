export type UserRole = 'SUPER' | 'ADMIN' | 'MANAGER' | 'LOGISTICS' | 'DRIVER' | 'EXTERNAL';
export type DriverStatus = 'AVAILABLE' | 'ENROUTE' | 'WORKSHOP' | 'NODOCS' | 'PAUSED';
export type VehicleStatus = 'AVAILABLE' | 'ENROUTE' | 'WORKSHOP' | 'PAUSED';
export type RouteStatus =
  | 'PENDING'
  | 'CHECKLIST'
  | 'CHECKLIST_PENDING'
  | 'ENROUTE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FINISHED'
  | 'CANCELLED';
export type EventStatus = 'PENDING' | 'ROUTE' | 'ISSUE' | 'SERVICE' | 'COMPLETED';
export type DeliverStatus = 'PENDING' | 'DELIVERED' | 'PARTIAL' | 'NOTDELIVERED';
export type PriorityStatus = 'URGENT' | 'NORMAL' | 'NOTURGENT';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  enterpriseId: string | null;
  enterpriseName?: string | null;
}

export interface Enterprise {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  _count?: { users: number };
}

export interface Driver {
  id: string;
  name: string;
  phone?: string;
  licenseId?: string;
  photoUrl?: string;
  status: DriverStatus;
  _count?: { routes: number };
}

export interface Vehicle {
  id: string;
  plate: string;
  name?: string;
  capacity?: number;
  insurance?: string;
  status: VehicleStatus;
  _count?: { routes: number };
}

export interface ChecklistItem {
  id?: string;
  label: string;
  required: boolean;
  photo: boolean;
  position?: number;
}

export interface Client {
  id: string;
  name: string;
  contactName?: string;
  contactPhone?: string;
  pickupMinutes: number;
  deliverMinutes: number;
  checklistItems?: ChecklistItem[];
  stops?: Stop[];
  _count?: { stops: number; checklistItems: number };
}

export interface Stop {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  reference?: string;
  clientId?: string;
}

export interface Evidence {
  id: string;
  url: string;
  type: string;
  approved: boolean;
}

export interface RouteEvent {
  id: string;
  position: number;
  status: EventStatus;
  deliverStatus: DeliverStatus;
  priority: PriorityStatus;
  eta?: string;
  completedAt?: string;
  comment?: string;
  signatureUrl?: string;
  stop: Stop;
  evidences: Evidence[];
}

export interface ChecklistEvent {
  id: string;
  label: string;
  required: boolean;
  photo: boolean;
  done: boolean;
}

export interface RouteSummary {
  id: string;
  name: string;
  status: RouteStatus;
  dateStart: string;
  dateStarted?: string;
  totalDistance?: number;
  totalDuration?: number;
  driver?: Driver | null;
  vehicle?: Vehicle | null;
  client?: Client | null;
  events?: { status: EventStatus }[];
  _count?: { events: number };
}

export interface RouteDetail extends RouteSummary {
  polyline?: string;
  events: RouteEvent[];
  checklist: ChecklistEvent[];
}

export interface Kpis {
  pending: number;
  enroute: number;
  completed: number;
  drivers: number;
  vehicles: number;
  stopsDelivered: number;
  stopsTotal: number;
}

export interface ClientConfig {
  mapbox: { token: string };
  pusher: { key: string; cluster: string };
}
