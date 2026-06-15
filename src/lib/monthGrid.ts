/**
 * Pure month-grid layout (#186) — no DOM. Returns the calendar matrix for a month as
 * 'YYYY-MM-DD' strings, **Monday-first** (PL-first convention), padded with leading/
 * trailing spill days from the adjacent months so every row has 7 cells. Always 6 rows
 * for a stable layout. UTC math, leap-aware.
 */

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** `month` is 1-12. */
export function monthGrid(year: number, month: number): string[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  // JS getUTCDay: Sun=0..Sat=6 → shift to Mon=0..Sun=6.
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(1 - mondayOffset);

  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: string[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start);
      cur.setUTCDate(start.getUTCDate() + w * 7 + d);
      row.push(fmt(cur));
    }
    weeks.push(row);
  }
  return weeks;
}

/** Whether a date string belongs to the given month (1-12) — for dimming spill cells. */
export function inMonth(dateStr: string, year: number, month: number): boolean {
  return dateStr.slice(0, 7) === `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}
