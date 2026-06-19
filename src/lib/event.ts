import type { EventInput, Repeat } from '@/types/event';

/**
 * Pure event-input validation (#186) — shared boundary checks for the API. Keeps the
 * HTTP handler thin and the rules unit-testable. Trims the title; normalises empty
 * optional fields to null.
 */

export const TITLE_MAX = 32;
export const DESCRIPTION_MAX = 128;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const REPEATS: Repeat[] = ['none', 'yearly'];

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** 'YYYY-MM-DD' with a real calendar date (rejects 2026-13-40, 2026-02-30, …). */
export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1) return false;
  const daysInMonth = [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= daysInMonth[m - 1]!;
}

/** 'HH:MM' 24h, or null/undefined for all-day. */
export function isValidTime(s: unknown): boolean {
  if (s === null || s === undefined) return true;
  if (typeof s !== 'string' || !TIME_RE.test(s)) return false;
  const [h, min] = s.split(':').map(Number) as [number, number];
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

export type ValidationResult =
  | { ok: true; value: EventInput }
  | { ok: false; error: string };

/** Validate + normalise a raw JSON body into an EventInput, or return an error message. */
export function validateEventInput(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Invalid body' };
  const r = raw as Record<string, unknown>;

  const title = typeof r.title === 'string' ? r.title.trim() : '';
  if (!title) return { ok: false, error: 'Title is required' };
  if (title.length > TITLE_MAX) return { ok: false, error: `Title must be ${TITLE_MAX} characters or fewer` };

  if (!isValidDate(r.date)) return { ok: false, error: 'Invalid date (expected YYYY-MM-DD)' };

  const time = r.time === undefined || r.time === '' ? null : r.time;
  if (!isValidTime(time)) return { ok: false, error: 'Invalid time (expected HH:MM)' };

  const repeat = r.repeat;
  if (typeof repeat !== 'string' || !REPEATS.includes(repeat as Repeat)) {
    return { ok: false, error: "Invalid repeat (expected 'none' or 'yearly')" };
  }

  let description: string | null = null;
  if (r.description !== undefined && r.description !== null) {
    if (typeof r.description !== 'string') return { ok: false, error: 'Invalid description' };
    const trimmed = r.description.trim();
    if (trimmed.length > DESCRIPTION_MAX) return { ok: false, error: `Description must be ${DESCRIPTION_MAX} characters or fewer` };
    description = trimmed === '' ? null : trimmed;
  }

  return {
    ok: true,
    value: {
      title,
      date: r.date as string,
      time: (time as string | null),
      repeat: repeat as Repeat,
      description,
    },
  };
}
