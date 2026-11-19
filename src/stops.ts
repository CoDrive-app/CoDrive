import type { Spot } from './api';
import { IMG } from './data';
import type { StopRole, Trip, Waypoint } from './types';

/** A stop's name and location, if it has a location. */
export function spotOf(stop: Waypoint | undefined): Spot | null {
  if (!stop || typeof stop.latitude !== 'number' || typeof stop.longitude !== 'number') return null;
  return { name: stop.title, latitude: stop.latitude, longitude: stop.longitude };
}

/** The picked place, but only while the text still says what was picked. */
export function spotFor(text: string, place: Spot | null): Spot | null {
  return place && place.name === text ? place : null;
}

/** Coordinates to spread onto a stop. If the text changed without picking a place, the old coordinates are dropped. */
export function where(spot: Spot | null, previous?: Waypoint): { latitude?: number; longitude?: number } {
  if (spot) return { latitude: spot.latitude, longitude: spot.longitude };
  return previous ? { latitude: undefined, longitude: undefined } : {};
}

/** A stop's role. Stops made before roles existed are recognised by their detail text. */
export function roleOf(stop: Waypoint): StopRole | undefined {
  if (stop.role) return stop.role;
  if (stop.detail === 'Start') return 'start';
  if (stop.detail === 'Destination') return 'end';
  return undefined;
}

export function endpoint(trip: Trip, role: StopRole): Waypoint | undefined {
  return trip.waypoints.find((stop) => roleOf(stop) === role);
}

function setEndpoint(
  stops: Waypoint[],
  trip: Trip,
  role: StopRole,
  text: string,
  spot: Spot | null,
): Waypoint[] {
  const existing = stops.find((stop) => roleOf(stop) === role);
  if (!text) return stops.filter((stop) => stop !== existing);
  if (existing) {
    return stops.map((stop) =>
      stop === existing ? { ...stop, role, title: text, ...where(spot, existing) } : stop,
    );
  }
  const made: Waypoint =
    role === 'start'
      ? {
          id: `${trip.id}-start`,
          title: text,
          detail: 'Start',
          proposedBy: 'You',
          likes: 1,
          dislikes: 0,
          vote: 'up',
          image: IMG.coast,
          time: '9:00 AM',
          stop: 'Departure',
          pin: '#E26D5A',
          status: 'selected',
          role,
          ...where(spot),
        }
      : {
          id: `${trip.id}-end`,
          title: text,
          detail: 'Destination',
          proposedBy: 'You',
          likes: 1,
          dislikes: 0,
          vote: 'up',
          image: IMG.hills,
          time: '—',
          stop: 'Arrival',
          pin: '#5B7CFA',
          status: 'selected',
          role,
          ...where(spot),
        };
  return role === 'start' ? [made, ...stops] : [...stops, made];
}

/**
 * Sets the trip's Start and End stops from the Trip tab. Empty text removes that stop,
 * and a stop whose text changed without picking from the suggestions loses its location.
 */
export function applyEndpoints(
  trip: Trip,
  start: string,
  end: string,
  startSpot: Spot | null,
  endSpot: Spot | null,
): Waypoint[] {
  const withStart = setEndpoint(trip.waypoints, trip, 'start', start, startSpot);
  return setEndpoint(withStart, trip, 'end', end, endSpot);
}
