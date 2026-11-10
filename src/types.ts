export type Tab = 'home' | 'trip' | 'plan' | 'drive' | 'costs';
export type ExpenseType = 'food' | 'housing' | 'recreation' | 'gas' | 'retail' | 'necessities' | 'other';

export interface Crew {
  id: string;
  name: string;
  initial: string;
  color: string;
}

/** A trip's first and last stops, set on the Trip tab. */
export type StopRole = 'start' | 'end';

export type WaypointStatus = 'suggested' | 'selected' | 'vetoed';

/** Your vote on a stop: thumbs up selects it, thumbs down vetoes it, no vote leaves it suggested. */
export type Vote = 'up' | 'down' | null;

export interface Waypoint {
  id: string;
  title: string;
  detail: string;
  /** Optional note from whoever suggested the stop; shown in place of `detail`. */
  note?: string;
  proposedBy: string;
  likes: number;
  dislikes: number;
  vote: Vote;
  image: string;
  time: string;
  stop: string;
  pin: string;
  status: WaypointStatus;
  /** Where the stop is. Stops without a location are left off the map and the route. */
  latitude?: number;
  longitude?: number;
  /** Marks the trip's Start and End. Other stops have no role. */
  role?: StopRole;
}

export interface Expense {
  id: string;
  title: string;
  paidBy: string[];
  notes: string;
  amount: number;
  type: ExpenseType;
  photos?: string[];
}

/** A crew member who can drive, and the longest they should drive without a rest. */
export interface Driver {
  crewId: string;
  limitMinutes: number;
}

export interface RestStop {
  place: string;
  distance: string;
  note: string;
}

export interface Trip {
  id: string;
  shareCode?: string;
  title: string;
  routeName: string;
  dates: string;
  image: string;
  crew: Crew[];
  waypoints: Waypoint[];
  expenses: Expense[];
  /** 0 means no budget has been set. */
  budget: number;
  /** Optional trip dates as YYYY-MM-DD. Older sample trips only have the `dates` text. */
  startDate?: string;
  endDate?: string;
  drivers: Driver[];
  duration: string;
  leg: string;
  rest: RestStop;
}
