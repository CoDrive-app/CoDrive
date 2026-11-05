import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Web and the iOS Simulator use http://localhost:3000.
 * The Android emulator uses http://10.0.2.2:3000 when Expo has no LAN host.
 * A physical phone uses http://<this computer's LAN address>:3000 from the Expo packager.
 */
export function apiBaseUrl(): string {
  const host = packagerHost();
  if (host && Platform.OS !== 'web') {
    return `http://${host}:3000`;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
}

export function isServerTrip(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export type ApiTrip = {
  id: string;
  title: string;
  share_code: string;
  budget: number;
  created_at: string;
};

export type ApiWaypoint = {
  id: string;
  trip_id: string;
  name: string;
  latitude: number;
  longitude: number;
  sequence_order: number;
};

export type ApiExpense = {
  id: string;
  trip_id: string;
  paid_by_user: string;
  amount: number;
  category: string;
  title: string;
  description: string;
  photos: string[];
};

export function listTrips() {
  return request<ApiTrip[]>('/api/trips');
}

export function getTrip(id: string) {
  return request<ApiTrip & { waypoints: ApiWaypoint[]; expenses: ApiExpense[] }>(`/api/trips/${id}`);
}

export function createTrip(title: string, budget: number) {
  return request<ApiTrip>('/api/trips', {
    method: 'POST',
    body: JSON.stringify({ title, budget }),
  });
}

export function addWaypoint(
  tripId: string,
  stop: { name: string; latitude: number; longitude: number; sequence_order?: number },
) {
  return request<ApiWaypoint>(`/api/trips/${tripId}/waypoints`, {
    method: 'POST',
    body: JSON.stringify(stop),
  });
}

export function logExpense(
  tripId: string,
  expense: {
    paid_by_user: string;
    amount: number;
    category: string;
    title: string;
    description: string;
    photos: string[];
  },
) {
  return request<ApiExpense>(`/api/trips/${tripId}/expenses`, {
    method: 'POST',
    body: JSON.stringify(expense),
  });
}

function packagerHost() {
  const expoGo = Constants.expoGoConfig as { debuggerHost?: string } | null;
  const raw = Constants.expoConfig?.hostUri ?? expoGo?.debuggerHost;
  const host = raw?.split(':')[0];
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error('Cannot reach the CoDrive API. Check that it is running.');
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? 'Request failed');
  }
  return data as T;
}
