import type { Vote, Waypoint, WaypointStatus } from './types';

/** How many votes make a majority: more than half the group. A group of one decides on its own. */
export function majority(groupSize: number) {
  return Math.floor(Math.max(1, groupSize) / 2) + 1;
}

/**
 * A stop is selected once a majority of the group gives it a thumbs up, and vetoed once a majority gives it
 * a thumbs down. Until either happens it stays suggested.
 */
export function statusFor(likes: number, dislikes: number, groupSize: number): WaypointStatus {
  const needed = majority(groupSize);
  if (likes >= needed) return 'selected';
  if (dislikes >= needed) return 'vetoed';
  return 'suggested';
}

/**
 * Casts a vote, or takes it back if it is the same one again.
 * Switching from up to down moves your count across, so each stop always has at most one of your votes.
 */
export function castVote(stop: Waypoint, direction: 'up' | 'down', groupSize: number): Waypoint {
  const next: Vote = stop.vote === direction ? null : direction;
  let likes = stop.likes;
  let dislikes = stop.dislikes;
  if (stop.vote === 'up') likes -= 1;
  if (stop.vote === 'down') dislikes -= 1;
  if (next === 'up') likes += 1;
  if (next === 'down') dislikes += 1;
  return { ...stop, vote: next, likes, dislikes, status: statusFor(likes, dislikes, groupSize) };
}
