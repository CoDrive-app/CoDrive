import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * A root `.env` value `EXPO_PUBLIC_API_URL` points Expo at the hosted API.
 * Leave it unset to keep the local API: web and the iOS Simulator use
 * http://localhost:3000, the Android emulator uses http://10.0.2.2:3000 when
 * Expo has no LAN host, and a physical phone uses http://<this computer's LAN address>:3000.
 */
export function apiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (configured) return configured;

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

export type ApiUser = { id: string; email: string; name: string };

export type ApiMember = { id: string; name: string; role: 'owner' | 'member' };

export type ApiTrip = {
  id: string;
  title: string;
  share_code: string;
  budget: number | null;
  created_at: string;
  /** Your role on this trip. The owner can delete it; members can leave it. */
  role: 'owner' | 'member';
  members: ApiMember[];
  /** YYYY-MM-DD, or null when not set. */
  start_date: string | null;
  end_date: string | null;
  /** An https URL or an image data URL. null means the default picture. */
  image: string | null;
  drivers: { crewId: string; limitMinutes: number }[];
  /** Crew members without an account. */
  guests: { id: string; name: string }[];
};

export type ApiTripDetail = ApiTrip & { waypoints: ApiWaypoint[]; expenses: ApiExpense[] };

export type ApiPlace = { name: string; latitude?: number; longitude?: number };

/** Fields for `updateTrip`. Leave one out to keep it as it is. */
export type TripPatch = {
  title?: string;
  budget?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  image?: string | null;
  drivers?: ApiTrip['drivers'];
  guests?: ApiTrip['guests'];
  /** null removes the stop. */
  start?: ApiPlace | null;
  end?: ApiPlace | null;
};

let authToken: string | null = null;
let onSignedOut: (() => void) | null = null;

/** Every request after this carries the token. Pass null after signing out. */
export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Called when the API says the session has ended, so the app can go back to sign-in. */
export function onSessionEnded(handler: (() => void) | null) {
  onSignedOut = handler;
}

export function signUp(name: string, email: string, password: string) {
  return request<{ token: string; user: ApiUser }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export function signIn(email: string, password: string) {
  return request<{ token: string; user: ApiUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function signOut() {
  return request<void>('/api/auth/logout', { method: 'POST' });
}

export function currentUser() {
  return request<{ user: ApiUser }>('/api/auth/me');
}

export type ApiWaypoint = {
  id: string;
  trip_id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  sequence_order: number;
  role: 'start' | 'end' | null;
  note: string;
  /** What kind of place it is, or null when unknown. */
  category: PlaceKind | null;
  /** The name of whoever suggested it, or null if their account is gone. */
  proposed_by: string | null;
  /** The account id of whoever suggested it, so the app knows whose suggestion it is. */
  proposed_by_id: string | null;
  likes: number;
  dislikes: number;
  my_vote: 'up' | 'down' | null;
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
  /** What kind of place it is, when Geoapify says it is one the app has pictures for. */
  category: PlaceKind | null;
};

export type Spot = { name: string; latitude: number; longitude: number; category?: PlaceKind | null };

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
  return request<ApiTripDetail>(`/api/trips/${id}`);
}

export function updateTrip(id: string, patch: TripPatch) {
  return request<ApiTripDetail>(`/api/trips/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** Makes a stop the fixed Start or End, or null to stop it being one. Only the trip owner can. */
export function setStopRole(tripId: string, waypointId: string, role: 'start' | 'end' | null) {
  return request<ApiTripDetail>(`/api/trips/${tripId}/waypoints/${waypointId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
}

export function voteWaypoint(tripId: string, waypointId: string, vote: 'up' | 'down' | null) {
  return request<ApiWaypoint>(`/api/trips/${tripId}/waypoints/${waypointId}/vote`, {
    method: 'PUT',
    body: JSON.stringify({ vote }),
  });
}

export function createTrip(title: string, budget?: number) {
  return request<ApiTrip>('/api/trips', {
    method: 'POST',
    body: JSON.stringify(budget === undefined ? { title } : { title, budget }),
  });
}

export function joinTrip(shareCode: string) {
  return request<ApiTrip>('/api/trips/join', {
    method: 'POST',
    body: JSON.stringify({ share_code: shareCode }),
  });
}

/** Removes a stop and its votes for everyone on the trip. Only your own suggestions, unless you own the trip. */
export function removeWaypoint(tripId: string, waypointId: string) {
  return request<void>(`/api/trips/${tripId}/waypoints/${waypointId}`, { method: 'DELETE' });
}

/** Deletes the trip if you own it, or takes you off it if you joined it. */
export function removeTrip(id: string) {
  return request<void>(`/api/trips/${id}`, { method: 'DELETE' });
}

export function addWaypoint(
  tripId: string,
  stop: ApiPlace & { note?: string; sequence_order?: number; category?: PlaceKind | null },
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
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error('Cannot reach the CoDrive API. Check that it is running.');
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    if (response.status === 401 && authToken) onSignedOut?.();
    throw new Error(data.error ?? 'Request failed');
  }
  return data as T;
}
