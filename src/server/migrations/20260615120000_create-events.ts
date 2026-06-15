import type { DB } from '../calendarDb';

// First real calendar migration (#186): the events table.
// One-off or yearly events; `date` is 'YYYY-MM-DD' (yearly recurs on month+day),
// `time` optional 'HH:MM', `description` app-only. See src/types/event.ts.

export const name = '20260615120000_create-events';

export function up(db: DB): void {
  db.exec(`
    CREATE TABLE events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      date        TEXT NOT NULL,
      time        TEXT,
      repeat      TEXT NOT NULL DEFAULT 'none' CHECK (repeat IN ('none','yearly')),
      description TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_events_date ON events(date);
  `);
}
