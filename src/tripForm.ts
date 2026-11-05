export const TRIP_NAME_MAX = 40;
export const PLACE_MAX = 48;
export const BUDGET_MAX = 50_000;
export const TRIP_LENGTH_DAYS = 31;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MONTH_INDEX: Record<string, number> = {};
for (const [index, month] of MONTHS.entries()) {
  MONTH_INDEX[month.toLowerCase()] = index;
}
for (const [index, month] of [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
].entries()) {
  MONTH_INDEX[month] = index;
}

export type TripDraft = {
  editing: boolean;
  name: string;
  start: string;
  end: string;
  startDate: string;
  endDate: string;
  budget: string;
};

export type TripField = 'name' | 'start' | 'end' | 'startDate' | 'endDate' | 'budget';

export function today(): Date {
  return startOfDay(new Date());
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function addYears(date: Date, years: number): Date {
  return new Date(date.getFullYear() + years, date.getMonth(), date.getDate());
}

export function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromIso(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return date;
}

export function formatLong(iso: string): string {
  const date = fromIso(iso);
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  return `${MONTHS[date.getMonth()]} ${day}, ${date.getFullYear()}`;
}

export function formatTripDates(startIso: string, endIso: string): string {
  const start = fromIso(startIso);
  const end = fromIso(endIso);
  if (!start || !end) return '';
  const startMonth = MONTHS[start.getMonth()];
  const endMonth = MONTHS[end.getMonth()];
  const startDay = String(start.getDate()).padStart(2, '0');
  const endDay = String(end.getDate()).padStart(2, '0');
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${startMonth} ${startDay} – ${endDay}, ${start.getFullYear()}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${start.getFullYear()}`;
  }
  return `${formatLong(startIso)} – ${formatLong(endIso)}`;
}

export function parseStoredDates(value: string): { start: string; end: string } {
  const trimmed = value.trim();
  const parts = trimmed.split(/\s+[\u2013\u2014-]\s+/);
  if (parts.length === 2) {
    const year = parts[1].match(/\d{4}/)?.[0];
    let start = '';
    let end = '';
    if (/\d{4}/.test(parts[0]) && year) {
      start = parseSingleDate(parts[0]);
      end = parseSingleDate(parts[1]);
    } else if (year) {
      const endWithoutYear = parts[1].replace(/,?\s*\d{4}/, '').trim();
      const endHasMonth = /[A-Za-z]/.test(endWithoutYear);
      const startMonth = parts[0].match(/[A-Za-z]+/)?.[0] ?? '';
      start = parseSingleDate(`${parts[0]}, ${year}`);
      end = parseSingleDate(endHasMonth ? `${endWithoutYear}, ${year}` : `${startMonth} ${endWithoutYear}, ${year}`);
    }
    if (start && end && start > end) {
      const startDate = fromIso(start);
      if (startDate) {
        const rolled = toIso(new Date(startDate.getFullYear() - 1, startDate.getMonth(), startDate.getDate()));
        if (rolled <= end) start = rolled;
      }
    }
    return { start, end };
  }
  return { start: parseSingleDate(trimmed), end: '' };
}

export function tidyLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function sanitizeLabel(value: string, max: number): { value: string; rejected: string | null } {
  const normalized = value.replace(/[‘’ʻʼ]/g, "'").replace(/[–—]/g, '-');
  let rejected: string | null = null;
  if (/[^\p{L}\p{N} '&.,-]/u.test(normalized)) {
    rejected = 'Use letters, numbers, spaces, and simple punctuation only.';
  }
  let cleaned = normalized.replace(/[^\p{L}\p{N} '&.,-]/gu, '').replace(/^\s+/, '').replace(/ {2,}/g, ' ');
  if (cleaned.length > max) {
    rejected = `Keep it to ${max} characters.`;
    cleaned = cleaned.slice(0, max);
  }
  return { value: cleaned, rejected };
}

export function sanitizeTripName(value: string) {
  return sanitizeLabel(value, TRIP_NAME_MAX);
}

export function sanitizePlace(value: string) {
  return sanitizeLabel(value, PLACE_MAX);
}

export function sanitizeBudget(value: string): { value: string; rejected: string | null } {
  const withoutMoney = value.replace(/[$,\s]/g, '');
  const extraDot = (withoutMoney.match(/\./g) ?? []).length > 1;
  const invalidChar = /[^\d.]/.test(withoutMoney);
  const decimal = withoutMoney.split('.')[1] ?? '';
  let rejected: string | null = null;
  if (invalidChar || extraDot) rejected = 'Enter a number like 500 or 42.50.';
  else if (decimal.length > 2) rejected = 'Use at most two decimal places.';

  const dot = withoutMoney.indexOf('.');
  let whole = (dot === -1 ? withoutMoney : withoutMoney.slice(0, dot)).replace(/[^\d]/g, '');
  const fraction = dot === -1 ? null : withoutMoney.slice(dot + 1).replace(/[^\d]/g, '').slice(0, 2);
  whole = whole.replace(/^0+(?=\d)/, '');
  if (whole.length > 6) {
    rejected = 'Keep the budget at $50,000 or less.';
    whole = whole.slice(0, 6);
  }
  if (fraction === null) return { value: whole, rejected };
  return { value: `${whole || '0'}.${fraction}`, rejected };
}

export function tidyBudget(value: string): string {
  return value.endsWith('.') ? value.slice(0, -1) : value;
}

export function samePlace(start: string, end: string): boolean {
  const left = tidyLabel(start).toLowerCase();
  const right = tidyLabel(end).toLowerCase();
  return left.length > 0 && left === right;
}

export function tripNameIssue(value: string): string | null {
  const name = tidyLabel(value);
  if (!name) return 'Enter a trip name.';
  if (name.length < 2) return 'Use at least 2 characters.';
  if (name.length > TRIP_NAME_MAX) return `Keep it to ${TRIP_NAME_MAX} characters.`;
  if (!/^(?:[\p{L}\p{N}]|'\p{L})/u.test(name)) return 'Start the name with a letter or number.';
  if (!/\p{L}/u.test(name)) return 'Include at least one letter.';
  if (/[&'.,-]{2,}/.test(name)) return 'Use single punctuation marks.';
  if (!/[\p{L}\p{N}.]$/u.test(name)) return 'End the name with a letter or number.';
  return null;
}

export function placeIssue(value: string, kind: 'start' | 'end', required: boolean): string | null {
  const place = tidyLabel(value);
  const noun = kind === 'start' ? 'starting place' : 'destination';
  if (!place) return required ? `Enter a ${noun}.` : null;
  if (place.length < 2) return `Use at least 2 characters for the ${noun}.`;
  if (place.length > PLACE_MAX) return `Keep it to ${PLACE_MAX} characters.`;
  if (!/^(?:[\p{L}\p{N}]|'\p{L})/u.test(place)) return `Start the ${noun} with a letter or number.`;
  if (!/\p{L}/u.test(place)) return `Include a letter in the ${noun}.`;
  if (/[&'.,-]{2,}/.test(place)) return 'Use single punctuation marks.';
  if (!/[\p{L}\p{N}.]$/u.test(place)) return `End the ${noun} with a letter or number.`;
  return null;
}

export function startDateBounds(editing: boolean): { min: Date; max: Date } {
  const now = today();
  return {
    min: editing ? addYears(now, -5) : now,
    max: addYears(now, 2),
  };
}

export function endDateBounds(editing: boolean, startIso: string): { min: Date; max: Date } {
  const now = today();
  const latest = addYears(now, 2);
  const start = fromIso(startIso);
  if (start) return { min: start, max: earlierDate(addDays(start, TRIP_LENGTH_DAYS - 1), latest) };
  if (editing) return { min: addYears(now, -5), max: latest };
  return { min: now, max: addDays(now, TRIP_LENGTH_DAYS - 1) };
}

export function startDateIssue(iso: string, editing: boolean): string | null {
  if (!iso.trim()) return 'Choose a start date.';
  const date = fromIso(iso);
  if (!date) return 'Choose a start date.';
  const now = today();
  if (date > addYears(now, 2)) return 'Choose a start date within the next 2 years.';
  if (!editing && date < now) return 'Choose today or a later day.';
  if (editing && date < addYears(now, -5)) return 'Choose a start date from the last 5 years.';
  return null;
}

export function endDateIssue(endIso: string, startIso: string, editing: boolean): string | null {
  if (!endIso.trim()) return 'Choose an end date.';
  const end = fromIso(endIso);
  if (!end) return 'Choose an end date.';
  const now = today();
  if (end > addYears(now, 2)) return 'Choose an end date within the next 2 years.';
  if (!editing && end < now) return 'Choose today or a later day.';
  const start = fromIso(startIso);
  if (start && end < start) return 'End on the start date or a later day.';
  if (start && daysBetween(start, end) > TRIP_LENGTH_DAYS - 1) return 'End within 31 days of the start.';
  return null;
}

export function budgetIssue(value: string): string | null {
  const raw = tidyBudget(value.trim());
  if (!raw) return 'Enter a budget.';
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return 'Enter a number like 500 or 42.50.';
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter more than $0.';
  if (amount > BUDGET_MAX) return 'Keep the budget at $50,000 or less.';
  return null;
}

export function budgetAmount(value: string): number | null {
  if (budgetIssue(value)) return null;
  return Number(tidyBudget(value.trim()));
}

export function tripIssues(draft: TripDraft): Record<TripField, string | null> {
  const start = placeIssue(draft.start, 'start', !draft.editing);
  const end = placeIssue(draft.end, 'end', !draft.editing);
  return {
    name: tripNameIssue(draft.name),
    start,
    end: end ?? (samePlace(draft.start, draft.end) ? 'Choose a destination different from the start.' : null),
    startDate: startDateIssue(draft.startDate, draft.editing),
    endDate: endDateIssue(draft.endDate, draft.startDate, draft.editing),
    budget: budgetIssue(draft.budget),
  };
}

export function tripFormReady(draft: TripDraft): boolean {
  return Object.values(tripIssues(draft)).every((issue) => issue === null);
}

export function daysBetween(start: Date, end: Date): number {
  const ms = startOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.round(ms / 86_400_000);
}

function earlierDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

function parseSingleDate(value: string): string {
  const trimmed = value.trim();
  if (fromIso(trimmed)) return trimmed;
  const match = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(trimmed);
  if (!match) return '';
  const month = MONTH_INDEX[match[1].toLowerCase()];
  if (month === undefined) return '';
  const year = Number(match[3]);
  const day = Number(match[2]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return '';
  return toIso(date);
}
