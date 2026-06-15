import { upcomingEvents } from '../lib/recurrence';
import type { DB } from './calendarDb';
import type { CalendarEvent, EventInput, UpcomingEvent } from '@/types/event';

/**
 * The Frame event store (#186) — CRUD over the `events` table plus the `upcoming`
 * feed (delegates to the pure `upcomingEvents` helper). Takes an already-migrated DB
 * connection from `createCalendarStore`.
 */

type EventRow = {
  id: number;
  title: string;
  date: string;
  time: string | null;
  repeat: 'none' | 'yearly';
  description: string | null;
};

function toEvent(r: EventRow): CalendarEvent {
  return {
    id: r.id,
    title: r.title,
    date: r.date,
    time: r.time ?? null,
    repeat: r.repeat,
    description: r.description ?? null,
  };
}

export function createEventStore(db: DB) {
  const insertStmt = db.prepare(
    `INSERT INTO events (title, date, time, repeat, description)
     VALUES (@title, @date, @time, @repeat, @description)`,
  );
  const selectAll = db.prepare(
    `SELECT id, title, date, time, repeat, description FROM events ORDER BY date, time, title`,
  );
  const selectOne = db.prepare(
    `SELECT id, title, date, time, repeat, description FROM events WHERE id = ?`,
  );
  const updateStmt = db.prepare(
    `UPDATE events SET title=@title, date=@date, time=@time, repeat=@repeat,
       description=@description, updated_at=datetime('now')
     WHERE id=@id`,
  );
  const deleteStmt = db.prepare(`DELETE FROM events WHERE id = ?`);
  const countStmt = db.prepare(`SELECT COUNT(*) AS n FROM events`);

  function normalise(input: EventInput) {
    return {
      title: input.title,
      date: input.date,
      time: input.time ?? null,
      repeat: input.repeat,
      description: input.description ?? null,
    };
  }

  function list(): CalendarEvent[] {
    return (selectAll.all() as EventRow[]).map(toEvent);
  }

  function get(id: number): CalendarEvent | null {
    const r = selectOne.get(id) as EventRow | undefined;
    return r ? toEvent(r) : null;
  }

  function add(input: EventInput): CalendarEvent {
    const info = insertStmt.run(normalise(input));
    return get(Number(info.lastInsertRowid))!;
  }

  function update(id: number, input: EventInput): CalendarEvent | null {
    const info = updateStmt.run({ ...normalise(input), id });
    return info.changes > 0 ? get(id) : null;
  }

  function remove(id: number): boolean {
    return deleteStmt.run(id).changes > 0;
  }

  function count(): number {
    return (countStmt.get() as { n: number }).n;
  }

  function upcoming(today: string, days = 3): UpcomingEvent[] {
    return upcomingEvents(list(), today, days);
  }

  return { list, get, add, update, remove, count, upcoming };
}

export type EventStore = ReturnType<typeof createEventStore>;
