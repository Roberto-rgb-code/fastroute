import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** Android emulator reaches host machine via 10.0.2.2; iOS Simulator uses localhost. */
function resolveApiUrl(): string {
  const configured = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (configured && !configured.includes('localhost')) {
    return configured;
  }
  const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${host}:3000/api/v1`;
}

const API_URL = resolveApiUrl();

const TOKEN_KEY = 'fastroute_token';

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Types (subset shared with backend)
export type RouteStatus =
  | 'PENDING'
  | 'CHECKLIST'
  | 'CHECKLIST_PENDING'
  | 'ENROUTE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FINISHED'
  | 'CANCELLED';

export interface Stop {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}
export interface RouteEvent {
  id: string;
  position: number;
  status: string;
  deliverStatus: string;
  priority: string;
  comment?: string;
  stop: Stop;
}
export interface ChecklistEvent {
  id: string;
  label: string;
  required: boolean;
  photo: boolean;
  done: boolean;
}
export type DeliverStatus = 'PENDING' | 'DELIVERED' | 'PARTIAL' | 'NOTDELIVERED';
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
export interface Expense {
  id: string;
  concept: string;
  paymentType: string;
  amount: number;
  comment?: string | null;
  imageUrl: string;
  status: string;
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
}
export interface RouteDetail {
  id: string;
  name: string;
  status: RouteStatus;
  totalDistance?: number;
  totalDuration?: number;
  kmInitial?: number | null;
  gasInitial?: number | null;
  driver?: { name: string } | null;
  vehicle?: { plate: string } | null;
  client?: { name: string } | null;
  events: RouteEvent[];
  checklist: ChecklistEvent[];
  expenses?: Expense[];
  incidents?: Incident[];
}
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  enterpriseId: string | null;
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
export interface ClientConfig {
  mapbox: { token: string; styleUrl: string };
  googleMaps: { apiKey: string };
  pusher: { key: string; cluster: string };
}

export const api = {
  async login(email: string, password: string) {
    const res = await request<{ accessToken: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await setToken(res.accessToken);
    return res;
  },
  me() {
    return request<AuthUser>('/auth/me');
  },
  myRoutes() {
    return request<RouteDetail[]>('/routes/mine');
  },
  route(id: string) {
    return request<RouteDetail>(`/routes/${id}`);
  },
  changeStatus(id: string, status: RouteStatus) {
    return request<RouteDetail>(`/routes/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
  toggleChecklist(routeId: string, itemId: string, done: boolean, photoUrl?: string) {
    return request<RouteDetail>(`/routes/${routeId}/checklist/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ done, photoUrl }),
    });
  },
  completeStop(routeId: string, eventId: string, body: { deliverStatus: string; comment?: string; evLat?: number; evLng?: number }) {
    return request<RouteDetail>(`/routes/${routeId}/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'COMPLETED', ...body }),
    });
  },
  // ── Checklist de salida: km/gas inicial (+ evidencias) ──
  startRoute(
    routeId: string,
    body: {
      kmInitial: number;
      gasInitial: number;
      lat?: number;
      lng?: number;
      checklist?: { itemId: string; done?: boolean; photoUrl?: string }[];
    },
  ) {
    return request<RouteDetail>(`/routes/${routeId}/start`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  // ── Evidencia de parada (fotos + estado + firma opcional) ──
  submitEvidence(
    routeId: string,
    eventId: string,
    body: {
      images: string[];
      deliverStatus: DeliverStatus;
      comment?: string;
      evLat?: number;
      evLng?: number;
      signatureUrl?: string;
    },
  ) {
    return request<RouteDetail>(`/routes/${routeId}/events/${eventId}/evidence`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  // ── Cierre del destino con km/gas final (+ firma/foto) ──
  closeDestination(
    routeId: string,
    body: { kmFinal: number; gasFinal: number; finalImg?: string; finalLat?: number; finalLng?: number },
  ) {
    return request<RouteDetail>(`/routes/${routeId}/close`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  // ── Gastos ──
  saveExpense(
    routeId: string,
    body: { concept: string; paymentType: string; amount: number; comment?: string; imageUrl: string },
  ) {
    return request<RouteDetail>(`/routes/${routeId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  // ── Incidencias (máx 5 fotos) ──
  addIncident(
    routeId: string,
    body: { reason: IncidentReason; comment?: string; photos?: string[]; lat?: number; lng?: number },
  ) {
    return request<RouteDetail>(`/routes/${routeId}/incidents`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  publishLocation(body: { lat: number; lng: number; routeId?: string }) {
    return request<unknown>('/tracking/location', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  clientConfig() {
    return request<ClientConfig>('/config/client');
  },
  // Chat por ruta (driver ↔ central)
  messages(routeId: string) {
    return request<Message[]>(`/routes/${routeId}/messages`);
  },
  sendMessage(routeId: string, body: string) {
    return request<Message>(`/routes/${routeId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },
  markMessagesRead(routeId: string) {
    return request<{ ok: boolean }>(`/routes/${routeId}/messages/read`, { method: 'POST' });
  },
};
