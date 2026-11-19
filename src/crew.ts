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

/** Someone added by name on the Trip tab, rather than an account that joined with the share code. */
export function isGuest(member: Crew) {
  return member.id.startsWith('crew-');
}

/** Accounts leave a trip from Home, so only people added by name can be removed here. The last person always stays. */
export function crewMemberLocked(crew: Crew[], member: Crew) {
  return !isGuest(member) || crew.length <= 1;
}
