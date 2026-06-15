import { describe, it, expect } from 'vitest';
import { addDays, occursOnDate, eventsOnDate, nextOccurrence, upcomingEvents, agenda } from './recurrence';
import type { CalendarEvent } from '@/types/event';

function ev(p: Partial<CalendarEvent> & { date: string }): CalendarEvent {
  return { id: 1, title: 't', time: null, repeat: 'none', description: null, ...p };
}

describe('addDays', () => {
  it('steps across month/year boundaries', () => {
    expect(addDays('2026-06-15', 3)).toBe('2026-06-18');
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('occursOnDate', () => {
  it('one-off matches its exact date only', () => {
    const e = ev({ date: '2026-06-20', repeat: 'none' });
    expect(occursOnDate(e, '2026-06-20')).toBe(true);
    expect(occursOnDate(e, '2027-06-20')).toBe(false);
  });
  it('yearly matches the same month/day in any year', () => {
    const e = ev({ date: '2000-06-20', repeat: 'yearly' });
    expect(occursOnDate(e, '2026-06-20')).toBe(true);
    expect(occursOnDate(e, '2031-06-20')).toBe(true);
    expect(occursOnDate(e, '2026-06-21')).toBe(false);
  });
  it('yearly Feb 29 falls on Feb 28 in non-leap years, Feb 29 in leap years', () => {
    const e = ev({ date: '2024-02-29', repeat: 'yearly' });
    expect(occursOnDate(e, '2026-02-28')).toBe(true); // 2026 non-leap
    expect(occursOnDate(e, '2026-02-29')).toBe(false);
    expect(occursOnDate(e, '2028-02-29')).toBe(true); // 2028 leap
  });
});

describe('eventsOnDate', () => {
  it('returns every event occurring on the date', () => {
    const list = [ev({ id: 1, date: '2026-06-20', repeat: 'none' }), ev({ id: 2, date: '1990-06-20', repeat: 'yearly' }), ev({ id: 3, date: '2026-06-21' })];
    expect(eventsOnDate(list, '2026-06-20').map((e) => e.id)).toEqual([1, 2]);
  });
});

describe('nextOccurrence', () => {
  it('one-off: future returns the date, past returns null', () => {
    expect(nextOccurrence(ev({ date: '2026-06-20' }), '2026-06-15')).toBe('2026-06-20');
    expect(nextOccurrence(ev({ date: '2026-06-20' }), '2026-06-20')).toBe('2026-06-20'); // today inclusive
    expect(nextOccurrence(ev({ date: '2026-06-10' }), '2026-06-15')).toBeNull();
  });
  it('yearly: this year if still upcoming, else next year', () => {
    const e = ev({ date: '1990-06-20', repeat: 'yearly' });
    expect(nextOccurrence(e, '2026-06-15')).toBe('2026-06-20');
    expect(nextOccurrence(e, '2026-06-25')).toBe('2027-06-20');
  });
  it('yearly Feb 29 clamps to Feb 28 in the resolved non-leap year', () => {
    const e = ev({ date: '2024-02-29', repeat: 'yearly' });
    expect(nextOccurrence(e, '2026-03-01')).toBe('2027-02-28');
  });
});

describe('upcomingEvents', () => {
  const today = '2026-06-15';
  const list = [
    ev({ id: 1, title: 'b', date: '2026-06-18', repeat: 'none' }),
    ev({ id: 2, title: 'a', date: '2026-06-18', repeat: 'none', time: '09:00' }),
    ev({ id: 3, title: 'past', date: '2026-06-10', repeat: 'none' }),
    ev({ id: 4, title: 'yearly', date: '1990-06-16', repeat: 'yearly' }),
    ev({ id: 5, title: 'out', date: '2026-06-30', repeat: 'none' }),
  ];
  it('keeps events within [today, today+days] inclusive, closest-first', () => {
    const up = upcomingEvents(list, today, 3); // window 06-15..06-18
    expect(up.map((e) => e.id)).toEqual([4, 1, 2]); // 06-16 yearly; on 06-18 all-day (id1) sorts before timed (id2)
    expect(up[0]!.occursOn).toBe('2026-06-16');
    expect(up.every((e) => e.occursOn >= today && e.occursOn <= '2026-06-18')).toBe(true);
  });
  it('excludes past one-offs and out-of-window events', () => {
    const ids = upcomingEvents(list, today, 3).map((e) => e.id);
    expect(ids).not.toContain(3);
    expect(ids).not.toContain(5);
  });
  it('flags isToday', () => {
    const up = upcomingEvents([ev({ id: 9, date: today })], today, 3);
    expect(up[0]!.isToday).toBe(true);
  });
});

describe('agenda', () => {
  it('future closest-first, past one-offs appended last', () => {
    const today = '2026-06-15';
    const list = [
      ev({ id: 1, date: '2026-06-20', repeat: 'none' }),
      ev({ id: 2, date: '2026-06-10', repeat: 'none' }), // past
      ev({ id: 3, date: '1990-06-16', repeat: 'yearly' }), // 2026-06-16
    ];
    expect(agenda(list, today).map((e) => e.id)).toEqual([3, 1, 2]);
  });
});
