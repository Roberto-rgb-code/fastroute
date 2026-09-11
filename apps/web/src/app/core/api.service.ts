import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  ChecklistItem,
  Client,
  ClientConfig,
  Driver,
  Enterprise,
  Kpis,
  RouteDetail,
  RouteStatus,
  RouteSummary,
  Stop,
  Vehicle,
} from './models';

const BASE = '/api/v1';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // Config
  clientConfig() {
    return this.http.get<ClientConfig>(`${BASE}/config/client`);
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

  // Dashboard
  kpis() {
    return this.http.get<Kpis>(`${BASE}/routes/kpis`);
  }

  // Routes
  routes(status?: RouteStatus) {
    const q = status ? `?status=${status}` : '';
    return this.http.get<RouteSummary[]>(`${BASE}/routes${q}`);
  }
  route(id: string) {
    return this.http.get<RouteDetail>(`${BASE}/routes/${id}`);
  }
  createRoute(body: {
    name: string;
    driverId?: string;
    vehicleId?: string;
    clientId?: string;
    stopIds: string[];
  }) {
    return this.http.post<RouteDetail>(`${BASE}/routes`, body);
  }
  changeRouteStatus(id: string, status: RouteStatus) {
    return this.http.patch<RouteDetail>(`${BASE}/routes/${id}/status`, { status });
  }
  deleteRoute(id: string) {
    return this.http.delete(`${BASE}/routes/${id}`);
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
    deliverMinutes?: number;
    checklistItems?: ChecklistItem[];
  }) {
    return this.http.post<Client>(`${BASE}/clients`, body);
  }
  deleteClient(id: string) {
    return this.http.delete(`${BASE}/clients/${id}`);
  }

  // Stops
  stops(clientId?: string) {
    const q = clientId ? `?clientId=${clientId}` : '';
    return this.http.get<Stop[]>(`${BASE}/stops${q}`);
  }
  createStop(body: Partial<Stop>) {
    return this.http.post<Stop>(`${BASE}/stops`, body);
  }
  deleteStop(id: string) {
    return this.http.delete(`${BASE}/stops/${id}`);
  }
}
