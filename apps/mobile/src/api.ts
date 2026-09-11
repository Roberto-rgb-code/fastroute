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
export interface RouteDetail {
  id: string;
  name: string;
  status: RouteStatus;
  totalDistance?: number;
  totalDuration?: number;
  driver?: { name: string } | null;
  vehicle?: { plate: string } | null;
  client?: { name: string } | null;
  events: RouteEvent[];
  checklist: ChecklistEvent[];
}
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  enterpriseId: string | null;
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
  toggleChecklist(routeId: string, itemId: string, done: boolean) {
    return request<RouteDetail>(`/routes/${routeId}/checklist/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ done }),
    });
  },
  completeStop(routeId: string, eventId: string, body: { deliverStatus: string; comment?: string; evLat?: number; evLng?: number }) {
    return request<RouteDetail>(`/routes/${routeId}/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'COMPLETED', ...body }),
    });
  },
  publishLocation(body: { lat: number; lng: number; routeId?: string }) {
    return request<unknown>('/tracking/location', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};
