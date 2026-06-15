import { describe, it, expect } from 'vitest';
import { monthGrid, inMonth } from './monthGrid';

function utcDow(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // Sun=0..Sat=6
}

describe('monthGrid', () => {
  it('returns 6 rows of 7 days', () => {
    const g = monthGrid(2026, 6);
    expect(g).toHaveLength(6);
    for (const row of g) expect(row).toHaveLength(7);
  });

  it('every row starts on a Monday', () => {
    for (const row of monthGrid(2026, 6)) {
      expect(utcDow(row[0]!)).toBe(1); // Monday
    }
  });

  it('contains every day of the target month', () => {
    const g = monthGrid(2026, 6).flat();
    for (let d = 1; d <= 30; d++) {
      expect(g).toContain(`2026-06-${String(d).padStart(2, '0')}`);
    }
  });

  it('includes leading/trailing spill days from adjacent months', () => {
    // July 2026 starts on a Wednesday, so the grid spills into both June and August.
    const g = monthGrid(2026, 7).flat();
    expect(g.some((d) => d.startsWith('2026-06'))).toBe(true);
    expect(g.some((d) => d.startsWith('2026-08'))).toBe(true);
  });

  it('handles a leap February (2024-02-29 present)', () => {
    expect(monthGrid(2024, 2).flat()).toContain('2024-02-29');
  });

  it('inMonth distinguishes in-month from spill cells', () => {
    expect(inMonth('2026-06-01', 2026, 6)).toBe(true);
    expect(inMonth('2026-05-31', 2026, 6)).toBe(false);
  });
});
