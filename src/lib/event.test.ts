import { describe, it, expect } from 'vitest';
import { isValidDate, isValidTime, validateEventInput } from './event';

describe('isValidDate', () => {
  it('accepts real calendar dates', () => {
    expect(isValidDate('2026-06-15')).toBe(true);
    expect(isValidDate('2024-02-29')).toBe(true); // leap
  });
  it('rejects malformed or impossible dates', () => {
    expect(isValidDate('2026-13-40')).toBe(false);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-02-29')).toBe(false); // non-leap
    expect(isValidDate('2026-6-1')).toBe(false);
    expect(isValidDate(42)).toBe(false);
  });
});

describe('isValidTime', () => {
  it('accepts HH:MM and null', () => {
    expect(isValidTime('09:30')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime(null)).toBe(true);
    expect(isValidTime(undefined)).toBe(true);
  });
  it('rejects out-of-range or malformed', () => {
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('9:30')).toBe(false);
    expect(isValidTime('12:60')).toBe(false);
  });
});

describe('validateEventInput', () => {
  it('accepts and normalises a valid event', () => {
    const r = validateEventInput({ title: '  Martha  ', date: '2026-06-20', repeat: 'yearly', time: '', description: '  ' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({ title: 'Martha', date: '2026-06-20', time: null, repeat: 'yearly', description: null });
    }
  });

  it('keeps non-empty optional fields', () => {
    const r = validateEventInput({ title: 'X', date: '2026-06-20', repeat: 'none', time: '08:00', description: 'note' });
    expect(r.ok && r.value.time).toBe('08:00');
    expect(r.ok && r.value.description).toBe('note');
  });

  it('rejects empty title, bad date, bad time, bad repeat', () => {
    expect(validateEventInput({ title: '   ', date: '2026-06-20', repeat: 'none' }).ok).toBe(false);
    expect(validateEventInput({ title: 'X', date: '2026-13-40', repeat: 'none' }).ok).toBe(false);
    expect(validateEventInput({ title: 'X', date: '2026-06-20', repeat: 'none', time: '99:99' }).ok).toBe(false);
    expect(validateEventInput({ title: 'X', date: '2026-06-20', repeat: 'weekly' }).ok).toBe(false);
    expect(validateEventInput(null).ok).toBe(false);
  });
});
