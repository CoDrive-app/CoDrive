export type Tab = 'home' | 'plan' | 'drive' | 'costs';
export type ExpenseIcon = 'food' | 'snorkel' | 'stay' | 'treat' | 'gas';

export interface Crew {
  id: string;
  name: string;
  initial: string;
  color: string;
}

export interface Waypoint {
  id: string;
  title: string;
  detail: string;
  proposedBy: string;
  likes: number;
  liked: boolean;
  image: string;
  time: string;
  stop: string;
  pin: string;
  x: number;
  y: number;
  going: boolean;
}

export interface Expense {
  id: string;
  title: string;
  details: string;
  amount: number;
  icon: ExpenseIcon;
  photos?: string[];
}

export interface RestStop {
  place: string;
  distance: string;
  note: string;
}

export type JourneyStatus = 'planning' | 'live';

export interface Trip {
  id: string;
  shareCode?: string;
  title: string;
  routeName: string;
  dates: string;
  image: string;
  crew: Crew[];
  driverId: string;
  waypoints: Waypoint[];
  expenses: Expense[];
  budget: number;
  duration: string;
  leg: string;
  progress: number;
  rest: RestStop;
  status: JourneyStatus;
  createdBy: string;
}
