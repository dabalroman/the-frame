/**
 * Calendar event types — shared by server + client (#186).
 *
 * Events are stored in The Frame's own SQLite DB (separate from the image store).
 * Recurrence is intentionally minimal: one-off or yearly only (birthdays/anniversaries).
 */

export type Repeat = 'none' | 'yearly';

/** A stored event. `date` is 'YYYY-MM-DD'; for yearly only month+day recur. */
export type CalendarEvent = {
  id: number;
  title: string;
  date: string;
  time: string | null; // 'HH:MM' 24h, or null for all-day
  repeat: Repeat;
  description: string | null;
};

/** Payload accepted by create/update (no id; optional fields may be omitted). */
export type EventInput = {
  title: string;
  date: string;
  time?: string | null;
  repeat: Repeat;
  description?: string | null;
};

/** An event resolved to a concrete upcoming occurrence date. */
export type UpcomingEvent = CalendarEvent & {
  occursOn: string; // 'YYYY-MM-DD' resolved occurrence
  isToday: boolean;
};
