import type { Trip, Waypoint } from './types';

export type JourneyCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

const CREW_COLORS = ['#E26D5A', '#3AA99A', '#E2B045', '#5B7CFA', '#8B6CC4'];

export function journeyChecks(trip: Trip): JourneyCheck[] {
  const start = trip.waypoints.find((stop) => stop.detail === 'Start' || stop.stop === 'Departure');
  const end = trip.waypoints.find((stop) => stop.detail === 'Destination' || stop.stop === 'Arrival');
  const hasRoute = Boolean(start && end) || trip.waypoints.length >= 2;
  const from = start?.title ?? trip.waypoints[0]?.title;
  const to = end?.title ?? trip.waypoints[trip.waypoints.length - 1]?.title;
  const datesReady = trip.dates.trim().length > 0 && trip.dates !== 'Dates TBD';

  return [
    {
      id: 'route',
      label: 'Route',
      ok: hasRoute,
      detail: hasRoute && from && to ? `${from} to ${to}` : 'Add a start and a destination',
    },
    {
      id: 'crew',
      label: 'Crew',
      ok: trip.crew.length > 0,
      detail: trip.crew.length > 0 ? `${trip.crew.length} ${trip.crew.length === 1 ? 'person' : 'people'} on the trip` : 'Add someone to the crew',
    },
    {
      id: 'dates',
      label: 'Dates',
      ok: datesReady,
      detail: datesReady ? trip.dates : 'Choose travel dates',
    },
    {
      id: 'budget',
      label: 'Budget',
      ok: trip.budget > 0,
      detail: trip.budget > 0 ? `$${trip.budget} to split` : 'Set a budget above $0',
    },
  ];
}

export function journeyReady(trip: Trip) {
  return journeyChecks(trip).every((check) => check.ok);
}

export function isTripCreator(trip: Trip) {
  return trip.createdBy === 'you';
}

export function currentDriver(trip: Trip) {
  return trip.crew.find((person) => person.id === trip.driverId) ?? trip.crew[0];
}

export function isRouteEnd(stop: Pick<Waypoint, 'detail' | 'stop'>) {
  return (
    stop.detail === 'Start' ||
    stop.detail === 'Destination' ||
    stop.stop === 'Departure' ||
    stop.stop === 'Arrival'
  );
}

export function crewFromName(name: string, taken: number) {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return {
    id: `crew-${Date.now()}`,
    name: trimmed,
    initial: trimmed[0]!.toUpperCase(),
    color: CREW_COLORS[taken % CREW_COLORS.length]!,
  };
}
