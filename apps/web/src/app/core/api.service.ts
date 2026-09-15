import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  ChecklistItem,
  Client,
  ClientConfig,
  DashboardSeries,
  DeliverStatus,
  Driver,
  Enterprise,
  EnterpriseSettings,
  EnterpriseUser,
  Incident,
  IncidentReason,
  Kpis,
  OperationsReport,
  RouteDetail,
  RouteStatus,
  RouteSummary,
  RouteTemplate,
  Stop,
  StopsReport,
  Message,
  UserRole,
  Vehicle,
  WeatherResult,
} from './models';

const BASE = '/api/v1';

function params(obj: Record<string, string | number | boolean | undefined | null>): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // Config
  clientConfig() {
    return this.http.get<ClientConfig>(`${BASE}/config/client`);
  }
  today() {
    return this.http.get<{ day: string; tz: string }>(`${BASE}/routes/today`);
  }
  weather(lat: number, lng: number) {
    return this.http.get<WeatherResult>(`${BASE}/weather`, { params: params({ lat, lng }) });
  }

  // Chat por ruta (web admin ↔ mobile driver)
  routeMessages(routeId: string) {
    return this.http.get<Message[]>(`${BASE}/routes/${routeId}/messages`);
  }
  sendMessage(routeId: string, body: string) {
    return this.http.post<Message>(`${BASE}/routes/${routeId}/messages`, { body });
  }
  markMessagesRead(routeId: string) {
    return this.http.post<{ ok: boolean }>(`${BASE}/routes/${routeId}/messages/read`, {});
  }

  // Super admin
  enterprises() {
    return this.http.get<Enterprise[]>(`${BASE}/super/enterprises`);
  }
  createEnterprise(body: { name: string; slug: string }) {
    return this.http.post<Enterprise>(`${BASE}/super/enterprises`, body);
  }
  createEnterpriseUser(id: string, body: { email: string; name: string; password: string; role?: string }) {
    return this.http.post(`${BASE}/super/enterprises/${id}/users`, body);
  }
  setEnterpriseActive(id: string, isActive: boolean) {
    return this.http.patch(`${BASE}/super/enterprises/${id}/active`, { isActive });
  }
  superSettings(id: string) {
    return this.http.get<EnterpriseSettings>(`${BASE}/super/enterprises/${id}/settings`);
  }
  updateSuperSettings(id: string, body: Partial<EnterpriseSettings>) {
    return this.http.patch<EnterpriseSettings>(`${BASE}/super/enterprises/${id}/settings`, body);
  }

  // Settings (empresa activa)
  settings() {
    return this.http.get<EnterpriseSettings>(`${BASE}/settings`);
  }
  updateSettings(body: Partial<EnterpriseSettings>) {
    return this.http.patch<EnterpriseSettings>(`${BASE}/settings`, body);
  }

  // Users
  users() {
    return this.http.get<EnterpriseUser[]>(`${BASE}/users`);
  }
  createUser(body: { email: string; name: string; password: string; role: UserRole; driverId?: string; phone?: string }) {
    return this.http.post<EnterpriseUser>(`${BASE}/users`, body);
  }
  updateUser(id: string, body: { name?: string; role?: UserRole; isActive?: boolean; password?: string }) {
    return this.http.patch<EnterpriseUser>(`${BASE}/users/${id}`, body);
  }
  deleteUser(id: string) {
    return this.http.delete(`${BASE}/users/${id}`);
  }

  // Dashboard
  kpis(day?: string) {
    return this.http.get<Kpis>(`${BASE}/routes/kpis`, { params: params({ day }) });
  }

  series(days = 14) {
    return this.http.get<DashboardSeries>(`${BASE}/routes/series`, { params: params({ days }) });
  }

  // Routes
  routes(opts: { status?: RouteStatus; day?: string; all?: boolean } = {}) {
    return this.http.get<RouteSummary[]>(`${BASE}/routes`, {
      params: params({ status: opts.status, day: opts.day, all: opts.all ? 1 : undefined }),
    });
  }
  route(id: string) {
    return this.http.get<RouteDetail>(`${BASE}/routes/${id}`);
  }
  createRoute(body: {
    name: string;
    driverId?: string;
    vehicleId?: string;
    clientId?: string;
    templateId?: string;
    dateStart?: string;
    stopIds?: string[];
  }) {
    return this.http.post<RouteDetail>(`${BASE}/routes`, body);
  }
  duplicateRoute(id: string, body: { driverId?: string; vehicleId?: string; dateStart?: string }) {
    return this.http.post<RouteDetail>(`${BASE}/routes/${id}/duplicate`, body);
  }
  changeRouteStatus(id: string, status: RouteStatus) {
    return this.http.patch<RouteDetail>(`${BASE}/routes/${id}/status`, { status });
  }
  cancelRoute(id: string, reason?: string) {
    return this.http.post<RouteDetail>(`${BASE}/routes/${id}/cancel`, { reason });
  }
  approveChecklist(id: string) {
    return this.http.post<RouteDetail>(`${BASE}/routes/${id}/approve-checklist`, {});
  }
  approveEvent(routeId: string, eventId: string) {
    return this.http.post<RouteDetail>(`${BASE}/routes/${routeId}/events/${eventId}/approve`, {});
  }
  retryEvent(routeId: string, eventId: string) {
    return this.http.post<RouteDetail>(`${BASE}/routes/${routeId}/events/${eventId}/retry`, {});
  }
  updateEvent(routeId: string, eventId: string, body: { priority?: string; status?: string }) {
    return this.http.patch<RouteDetail>(`${BASE}/routes/${routeId}/events/${eventId}`, body);
  }
  reorderRoute(id: string, eventIds: string[]) {
    return this.http.patch<RouteDetail>(`${BASE}/routes/${id}/reorder`, { eventIds });
  }
  notifyDriver(id: string, message?: string) {
    return this.http.post<{ ok: boolean; link: string }>(`${BASE}/routes/${id}/notify-driver`, { message });
  }
  notifyClient(routeId: string, eventId: string) {
    return this.http.post<{ ok: boolean; link: string; to: string; message: string }>(
      `${BASE}/routes/${routeId}/events/${eventId}/notify-client`,
      {},
    );
  }
  expenseDone(routeId: string, expenseId: string) {
    return this.http.post<RouteDetail>(`${BASE}/routes/${routeId}/expenses/${expenseId}/done`, {});
  }
  incidents(day?: string) {
    return this.http.get<Incident[]>(`${BASE}/routes/incidents`, { params: params({ day }) });
  }
  deleteRoute(id: string) {
    return this.http.delete(`${BASE}/routes/${id}`);
  }

  // Templates
  templates() {
    return this.http.get<RouteTemplate[]>(`${BASE}/templates`);
  }
  createTemplate(body: { name: string; clientId?: string; stopIds: string[] }) {
    return this.http.post<RouteTemplate>(`${BASE}/templates`, body);
  }
  updateTemplate(id: string, body: { name: string; clientId?: string; stopIds: string[] }) {
    return this.http.patch<RouteTemplate>(`${BASE}/templates/${id}`, body);
  }
  deleteTemplate(id: string) {
    return this.http.delete(`${BASE}/templates/${id}`);
  }

  // Reports
  reportStops(from?: string, to?: string) {
    return this.http.get<StopsReport>(`${BASE}/reports/stops`, { params: params({ from, to }) });
  }
  reportOperations(from?: string, to?: string) {
    return this.http.get<OperationsReport>(`${BASE}/reports/operations`, { params: params({ from, to }) });
  }

  // Drivers
  drivers() {
    return this.http.get<Driver[]>(`${BASE}/drivers`);
  }
  createDriver(body: Partial<Driver>) {
    return this.http.post<Driver>(`${BASE}/drivers`, body);
  }
  updateDriver(id: string, body: Partial<Driver>) {
    return this.http.patch<Driver>(`${BASE}/drivers/${id}`, body);
  }
  deleteDriver(id: string) {
    return this.http.delete(`${BASE}/drivers/${id}`);
  }

  // Vehicles
  vehicles() {
    return this.http.get<Vehicle[]>(`${BASE}/vehicles`);
  }
  createVehicle(body: Partial<Vehicle>) {
    return this.http.post<Vehicle>(`${BASE}/vehicles`, body);
  }
  updateVehicle(id: string, body: Partial<Vehicle>) {
    return this.http.patch<Vehicle>(`${BASE}/vehicles/${id}`, body);
  }
  deleteVehicle(id: string) {
    return this.http.delete(`${BASE}/vehicles/${id}`);
  }

  // Clients
  clients() {
    return this.http.get<Client[]>(`${BASE}/clients`);
  }
  client(id: string) {
    return this.http.get<Client>(`${BASE}/clients/${id}`);
  }
  createClient(body: {
    name: string;
    contactName?: string;
    contactPhone?: string;
    pickupMinutes?: number;
    deliverMinutes?: number;
    checklistItems?: ChecklistItem[];
  }) {
    return this.http.post<Client>(`${BASE}/clients`, body);
  }
  deleteClient(id: string) {
    return this.http.delete(`${BASE}/clients/${id}`);
  }

  // Stops
  stops(opts: { clientId?: string; includeArchived?: boolean } = {}) {
    return this.http.get<Stop[]>(`${BASE}/stops`, {
      params: params({ clientId: opts.clientId, includeArchived: opts.includeArchived ? 1 : undefined }),
    });
  }
  createStop(body: Partial<Stop>) {
    return this.http.post<Stop>(`${BASE}/stops`, body);
  }
  updateStop(id: string, body: Partial<Stop>) {
    return this.http.patch<Stop>(`${BASE}/stops/${id}`, body);
  }
  deleteStop(id: string) {
    return this.http.delete(`${BASE}/stops/${id}`);
  }

  /** Geocoding gratis (geopy + Nominatim OSM). */
  geocode(query: string, country = 'mx') {
    return this.http.post<{ lat: number; lng: number; displayName: string; provider: string }>(`${BASE}/geocode`, {
      query,
      country,
    });
  }
}

export type { DeliverStatus, IncidentReason };
