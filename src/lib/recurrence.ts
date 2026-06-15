import type { CalendarEvent, UpcomingEvent } from '@/types/event';

/**
 * Pure event-occurrence logic (#186) — no DOM, no SQL. All dates are 'YYYY-MM-DD'
 * strings, compared lexicographically (valid for that format) and stepped via UTC
 * math so results never depend on the host timezone. Callers inject `today` (the
 * server-/client-local date) so every function here stays pure and unit-testable.
 *
 * Recurrence model: one-off (`none`) or yearly. Yearly events recur on their
 * month+day; a Feb 29 event falls on Feb 28 in non-leap years.
 */

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function toUTC(date: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Add `n` days to a 'YYYY-MM-DD' date (n may be negative). */
export function addDays(date: string, n: number): string {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

/** Resolve an 'MM-DD' to a concrete date in `year`, clamping Feb 29 → Feb 28 in non-leap years. */
function resolveMonthDay(year: number, monthDay: string): string {
  const clamped = monthDay === '02-29' && !isLeap(year) ? '02-28' : monthDay;
  return `${String(year).padStart(4, '0')}-${clamped}`;
}

/** Does this event occur on the given calendar date? (one-off: exact; yearly: month/day, Feb 29 clamp). */
export function occursOnDate(ev: CalendarEvent, dateStr: string): boolean {
  if (ev.repeat === 'none') return ev.date === dateStr;
  const year = Number(dateStr.slice(0, 4));
  return resolveMonthDay(year, ev.date.slice(5)) === dateStr;
}

/** All events that occur on the given date. */
export function eventsOnDate(events: CalendarEvent[], dateStr: string): CalendarEvent[] {
  return events.filter((ev) => occursOnDate(ev, dateStr));
}

/**
 * Next occurrence on or after `today`. One-off events in the past return null.
 * Yearly events return this year's month/day if still upcoming, else next year's.
 */
export function nextOccurrence(ev: CalendarEvent, today: string): string | null {
  if (ev.repeat === 'none') return ev.date >= today ? ev.date : null;
  const monthDay = ev.date.slice(5);
  const startYear = Number(today.slice(0, 4));
  for (let year = startYear; year <= startYear + 1; year++) {
    const cand = resolveMonthDay(year, monthDay);
    if (cand >= today) return cand;
  }
  return resolveMonthDay(startYear + 1, monthDay); // unreachable safety
}

function compareOccurrence(a: UpcomingEvent, b: UpcomingEvent): number {
  if (a.occursOn !== b.occursOn) return a.occursOn < b.occursOn ? -1 : 1;
  const at = a.time ?? '';
  const bt = b.time ?? '';
  if (at !== bt) return at < bt ? -1 : 1;
  return a.title.localeCompare(b.title);
}

/**
 * Events occurring within [today, today+days] inclusive, resolved + sorted closest-first.
 * This is the data set the eink events view (#188) consumes (default days = 3).
 */
export function upcomingEvents(events: CalendarEvent[], today: string, days = 3): UpcomingEvent[] {
  const end = addDays(today, days);
  const out: UpcomingEvent[] = [];
  for (const ev of events) {
    const occ = nextOccurrence(ev, today);
    if (occ && occ >= today && occ <= end) {
      out.push({ ...ev, occursOn: occ, isToday: occ === today });
    }
  }
  return out.sort(compareOccurrence);
}

/**
 * Full agenda for the stream view: every event by next occurrence ascending (closest
 * first), with past one-offs (no future occurrence) appended last, most-recent first.
 */
export function agenda(events: CalendarEvent[], today: string): UpcomingEvent[] {
  const future: UpcomingEvent[] = [];
  const past: UpcomingEvent[] = [];
  for (const ev of events) {
    const occ = nextOccurrence(ev, today);
    if (occ) future.push({ ...ev, occursOn: occ, isToday: occ === today });
    else past.push({ ...ev, occursOn: ev.date, isToday: false });
  }
  future.sort(compareOccurrence);
  past.sort((a, b) => (a.occursOn === b.occursOn ? 0 : a.occursOn > b.occursOn ? -1 : 1));
  return [...future, ...past];
}
