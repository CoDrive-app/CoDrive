import type { Crew } from './types';

const CREW_COLORS = ['#E26D5A', '#3AA99A', '#E2B045', '#5B7CFA', '#8B6CC4'];

/** A crew member from a typed name. `taken` picks the next avatar color. */
export function crewFromName(name: string, taken: number): Crew | null {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return {
    id: `crew-${Date.now()}-${taken}`,
    name: trimmed,
    initial: trimmed[0]!.toUpperCase(),
    color: CREW_COLORS[taken % CREW_COLORS.length]!,
  };
}

/** The trip creator, and the last remaining person, stay on the trip. */
export function crewMemberLocked(crew: Crew[], member: Crew) {
  return member.id === 'you' || crew.length <= 1;
}
