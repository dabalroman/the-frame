/** Date/label formatting for the calendar UI (localized via the active i18n language). */

function locale(lang: string): string {
  return lang.startsWith('pl') ? 'pl' : 'en-GB';
}

/** Server-/client-local 'YYYY-MM-DD' (no UTC shift — the frame lives in one timezone). */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function asDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

/** "June 2026" / "czerwiec 2026". `month` is 1-12. */
export function monthLabel(year: number, month: number, lang: string): string {
  return new Intl.DateTimeFormat(locale(lang), { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

/** Seven short weekday names, Monday-first. */
export function weekdayLabels(lang: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale(lang), { weekday: 'short', timeZone: 'UTC' });
  // 2024-01-01 is a Monday.
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(2024, 0, 1 + i));
    return fmt.format(d);
  });
}

/** "Mon 15 Jun" / "pon., 15 cze" — compact date for event rows. */
export function formatEventDate(dateStr: string, lang: string): string {
  return new Intl.DateTimeFormat(locale(lang), { weekday: 'short', day: 'numeric', month: 'short' }).format(asDate(dateStr));
}

/** "Monday, 15 June 2026" — full date for the day sheet heading. */
export function formatFullDate(dateStr: string, lang: string): string {
  return new Intl.DateTimeFormat(locale(lang), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(asDate(dateStr));
}
