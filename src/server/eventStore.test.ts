import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations, type DB } from './calendarDb';
import { createEventStore } from './eventStore';
import * as createEvents from './migrations/20260615120000_create-events';

// Apply the real events migration directly (vitest transforms the import) rather than
// loadMigrations()'s createRequire path — mirrors calendarDb.test.

let db: DB;
let store: ReturnType<typeof createEventStore>;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('journal_mode = MEMORY');
  runMigrations(db, [{ name: createEvents.name, up: createEvents.up }]);
  store = createEventStore(db);
});
afterEach(() => db.close());

describe('events migration', () => {
  it('creates the events table', () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='events'").get();
    expect(row).toBeTruthy();
  });
});

describe('createEventStore CRUD', () => {
  it('add → get round-trips and assigns an id, normalising optionals', () => {
    const created = store.add({ title: 'Martha', date: '2026-06-20', repeat: 'yearly' });
    expect(created.id).toBeGreaterThan(0);
    expect(created).toMatchObject({ title: 'Martha', date: '2026-06-20', repeat: 'yearly', time: null, description: null });
    expect(store.get(created.id)).toEqual(created);
  });

  it('lists events ordered by date', () => {
    store.add({ title: 'b', date: '2026-06-20', repeat: 'none' });
    store.add({ title: 'a', date: '2026-06-10', repeat: 'none' });
    expect(store.list().map((e) => e.date)).toEqual(['2026-06-10', '2026-06-20']);
    expect(store.count()).toBe(2);
  });

  it('update changes fields and returns the row; missing id → null', () => {
    const e = store.add({ title: 'X', date: '2026-06-20', repeat: 'none' });
    const updated = store.update(e.id, { title: 'Y', date: '2026-07-01', repeat: 'yearly', time: '10:00', description: 'd' });
    expect(updated).toMatchObject({ id: e.id, title: 'Y', date: '2026-07-01', repeat: 'yearly', time: '10:00', description: 'd' });
    expect(store.update(99999, { title: 'Z', date: '2026-06-20', repeat: 'none' })).toBeNull();
  });

  it('remove deletes; missing id → false', () => {
    const e = store.add({ title: 'X', date: '2026-06-20', repeat: 'none' });
    expect(store.remove(e.id)).toBe(true);
    expect(store.get(e.id)).toBeNull();
    expect(store.remove(e.id)).toBe(false);
  });

  it('upcoming returns next-N-days events resolved + closest-first', () => {
    store.add({ title: 'soon', date: '2026-06-16', repeat: 'none' });
    store.add({ title: 'bday', date: '1990-06-17', repeat: 'yearly' });
    store.add({ title: 'far', date: '2026-07-30', repeat: 'none' });
    const up = store.upcoming('2026-06-15', 3);
    expect(up.map((e) => e.title)).toEqual(['soon', 'bday']);
    expect(up[1]!.occursOn).toBe('2026-06-17');
  });
});
