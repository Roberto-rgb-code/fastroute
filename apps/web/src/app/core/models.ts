export type UserRole = 'SUPER' | 'ADMIN' | 'MANAGER' | 'LOGISTICS' | 'DRIVER' | 'EXTERNAL';
export type DriverStatus =
  | 'AVAILABLE'
  | 'ENROUTE'
  | 'CHECKLIST'
  | 'CHECKLIST_PENDING'
  | 'WORKSHOP'
  | 'NODOCS'
  | 'UNAVAILABLE'
  | 'PAUSED';
export type VehicleStatus =
  | 'AVAILABLE'
  | 'ENROUTE'
  | 'CHECKLIST'
  | 'CHECKLIST_PENDING'
  | 'WORKSHOP'
  | 'UNAVAILABLE'
  | 'PAUSED';
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
export type StopType = 'VISIT' | 'GAS' | 'PARKING' | 'CEDIS' | 'MAIN' | 'WORKSHOP';
export type IncidentReason =
  | 'CAR_ACCIDENT'
  | 'HOSPITAL'
  | 'WC'
  | 'RESTAURANT'
  | 'PARKING'
  | 'TRAFFIC'
  | 'GAS'
  | 'ROBBERY'
  | 'OTHER';

export const OPEN_ROUTE_STATUSES: RouteStatus[] = ['PENDING', 'CHECKLIST', 'CHECKLIST_PENDING', 'ENROUTE', 'PAUSED'];
export const TERMINAL_ROUTE_STATUSES: RouteStatus[] = ['COMPLETED', 'FINISHED', 'CANCELLED'];
export const TRACKABLE_ROUTE_STATUSES: RouteStatus[] = ['CHECKLIST', 'CHECKLIST_PENDING', 'ENROUTE', 'PAUSED'];

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  enterpriseId: string | null;
  enterpriseName?: string | null;
}

export interface StopTag {
  name: string;
  color: string;
}

export interface EnterpriseSettings {
  sms_active: boolean;
  stops_wait_approval: boolean;
  stops_order_restriction: boolean;
  stop_tag: StopTag[];
  active_membership: boolean;
  whatsapp_notifications: boolean;
  max_users_per_ent: number;
  signature_active: boolean;
}

export interface Enterprise {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  _count?: { users: number };
}

export interface EnterpriseUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  driver?: { id: string; name: string; status: DriverStatus } | null;
}

export interface Driver {
  id: string;
  name: string;
  phone?: string;
  licenseId?: string;
  licenseExpiry?: string | null;
  idDocExpiry?: string | null;
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
  clientId?: string | null;
  client?: { id: string; name: string } | null;
  type: StopType;
  isMain: boolean;
  isArchived: boolean;
  phoneNotification?: string | null;
  schedule?: string | null;
  commentInternal?: string | null;
  commentDriver?: string | null;
  tag?: string | null;
  tagColor?: string | null;
  fileUrl?: string | null;
  _count?: { events: number };
}

export interface RouteTemplate {
  id: string;
  name: string;
  totalDistance?: number | null;
  totalDuration?: number | null;
  clientId?: string | null;
  client?: { id: string; name: string } | null;
  stops: { id: string; position: number; stop: Stop }[];
  _count?: { routes: number };
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
  approved: boolean;
  eta?: string;
  arrivedAt?: string;
  completedAt?: string;
  evLat?: number | null;
  evLng?: number | null;
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
  photoUrl?: string | null;
}

export interface Expense {
  id: string;
  concept: string;
  paymentType: string;
  amount: number;
  comment?: string | null;
  imageUrl: string;
  status: 'PENDING' | 'DONE';
  createdAt: string;
}

export interface Incident {
  id: string;
  reason: IncidentReason;
  comment?: string | null;
  photos: string[];
  lat?: number | null;
  lng?: number | null;
  createdAt: string;
  route?: { id: string; name: string; driver?: { name: string } | null };
}

export interface RouteSummary {
  id: string;
  name: string;
  status: RouteStatus;
  dateStart: string;
  dateStarted?: string | null;
  dateEnd?: string | null;
  totalDistance?: number | null;
  totalDuration?: number | null;
  kmInitial?: number | null;
  kmFinal?: number | null;
  gasInitial?: number | null;
  gasFinal?: number | null;
  cancelReason?: string | null;
  driver?: Driver | null;
  vehicle?: Vehicle | null;
  client?: Client | null;
  events?: {
    status: EventStatus;
    deliverStatus?: DeliverStatus;
    approved?: boolean;
    position?: number;
    evLat?: number | null;
    evLng?: number | null;
    stop?: { id: string; label: string; lat: number; lng: number };
  }[];
  _count?: { events: number; incidents?: number; expenses?: number };
}

export interface RouteDetail extends RouteSummary {
  polyline?: string | null;
  startLat?: number | null;
  startLng?: number | null;
  finalImg?: string | null;
  finalLat?: number | null;
  finalLng?: number | null;
  template?: { id: string; name: string } | null;
  events: RouteEvent[];
  checklist: ChecklistEvent[];
  expenses: Expense[];
  incidents: Incident[];
}

export interface Kpis {
  day: string;
  pending: number;
  enroute: number;
  paused: number;
  completed: number;
  cancelled: number;
  drivers: number;
  vehicles: number;
  driversAvailable: number;
  vehiclesAvailable: number;
  pendingApprovals: number;
  stopsTotal: number;
  stopsDelivered: number;
  delivered: number;
  partial: number;
  notDelivered: number;
}

export interface DailySeriesPoint {
  day: string;
  routes: number;
  completed: number;
  cancelled: number;
  delivered: number;
  partial: number;
  notDelivered: number;
  stops: number;
  km: number;
  expenses: number;
}

export interface RecentRoute {
  id: string;
  name: string;
  status: RouteStatus;
  dateStart: string;
  dateEnd?: string | null;
  driver?: { id: string; name: string } | null;
  vehicle?: { id: string; plate: string; name?: string | null } | null;
  stops: number;
  delivered: number;
  km: number | null;
  expenses: number;
  incidents: number;
}

export interface DashboardSeries {
  days: number;
  from: string;
  to: string;
  daily: DailySeriesPoint[];
  totals: { routes: number; completed: number; delivered: number; stops: number; km: number; expenses: number; successRate: number };
  trend: { routes: number; delivered: number; km: number; expenses: number; completed: number };
  donut: { delivered: number; partial: number; notDelivered: number; pending: number };
  /** 7 filas (Lun..Dom) × 24 horas. */
  heatmap: number[][];
  recent: RecentRoute[];
}

export interface StopsReport {
  from: string;
  to: string;
  totals: { delivered: number; partial: number; notDelivered: number; pending: number; total: number };
  rows: {
    day: string;
    route: string;
    routeId: string;
    routeStatus: RouteStatus;
    driver: string;
    plate: string;
    position: number;
    stop: string;
    address: string;
    type: StopType;
    tag?: string | null;
    status: EventStatus;
    deliverStatus: DeliverStatus;
    approved: boolean;
    completedAt?: string | null;
    comment?: string | null;
  }[];
}

export interface OperationsReport {
  from: string;
  to: string;
  totals: { routes: number; completed: number; cancelled: number; km: number; expenses: number; incidents: number };
  rows: {
    day: string;
    routeId: string;
    route: string;
    status: RouteStatus;
    client: string;
    driver: string;
    plate: string;
    dateStart: string;
    dateStarted?: string | null;
    dateCompleted?: string | null;
    durationMin?: number | null;
    stops: number;
    stopsDone: number;
    kmInitial?: number | null;
    kmFinal?: number | null;
    kmTraveled?: number | null;
    gasInitial?: number | null;
    gasFinal?: number | null;
    incidents: number;
    expenses: number;
  }[];
}

export interface ClientConfig {
  mapbox: { token: string; styleUrl: string };
  googleMaps: { apiKey: string };
  pusher: { key: string; cluster: string };
}

export type MessageSender = 'ADMIN' | 'DRIVER';

export interface Message {
  id: string;
  body: string;
  sender: MessageSender;
  routeId: string;
  userId: string | null;
  user?: { id: string; name: string } | null;
  readAt: string | null;
  createdAt: string;
}

export interface WeatherResult {
  lat: number;
  lng: number;
  now: {
    tempC: number | null;
    windKmh: number | null;
    windDir: number | null;
    precipMm: number | null;
    code: number | null;
    label: string;
    isDay: boolean;
  };
  hourly: { time: string; tempC: number; precipMm: number; windKmh: number }[];
  fetchedAt: string;
}
