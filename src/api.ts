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
  budget: number | null;
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

export type AddressSuggestion = {
  id: string;
  /** Short text for a form field, like "Ala Moana Center, Honolulu". */
  name: string;
  line1: string;
  line2: string;
  /** Full formatted address. */
  label: string;
  latitude: number;
  longitude: number;
};

export type Spot = { name: string; latitude: number; longitude: number };

/** Asks the CoDrive API for address suggestions. The API holds the Geoapify key, not the app. */
export function searchAddresses(text: string, near?: { latitude: number; longitude: number } | null) {
  const where = near ? `&lat=${near.latitude}&lon=${near.longitude}` : '';
  return request<{ results: AddressSuggestion[] }>(`/api/geo/autocomplete?text=${encodeURIComponent(text)}${where}`);
}

export type PlaceKind = 'food' | 'gas' | 'beach' | 'sights' | 'lodging';

/** Named places of one kind near a point, like gas stations or beaches. */
export function nearbyPlaces(kind: PlaceKind, near: { latitude: number; longitude: number }) {
  return request<{ results: AddressSuggestion[] }>(
    `/api/geo/places?category=${kind}&lat=${near.latitude}&lon=${near.longitude}`,
  );
}

export type RoutePlan = {
  distanceMeters: number;
  timeSeconds: number;
  legs: { distanceMeters: number; timeSeconds: number }[];
  /** The road line as [latitude, longitude] pairs. */
  path: [number, number][];
};

/** Driving route through the points, in order. */
export function fetchRoute(points: { latitude: number; longitude: number }[]) {
  return request<RoutePlan>('/api/geo/route', {
    method: 'POST',
    body: JSON.stringify({ points: points.map(({ latitude, longitude }) => ({ latitude, longitude })) }),
  });
}

/** The address of one map tile on the CoDrive API, which holds the Geoapify key. */
export function tileUrl(z: number, x: number, y: number) {
  return `${apiBaseUrl()}/api/geo/tile/osm-bright/${z}/${x}/${y}`;
}

export function listTrips() {
  return request<ApiTrip[]>('/api/trips');
}

export function getTrip(id: string) {
  return request<ApiTrip & { waypoints: ApiWaypoint[]; expenses: ApiExpense[] }>(`/api/trips/${id}`);
}

export function createTrip(title: string, budget?: number) {
  return request<ApiTrip>('/api/trips', {
    method: 'POST',
    body: JSON.stringify(budget === undefined ? { title } : { title, budget }),
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
  expense: { paid_by_user: string; amount: number; category: string; title: string; description: string; photos: string[] },
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
