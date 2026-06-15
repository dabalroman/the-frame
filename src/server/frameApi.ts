import type { IncomingMessage, ServerResponse } from 'node:http';
import { createImageApi, type ImageApiOptions } from './imageApi';
import { createCalendarStore } from './calendarDb';
import { createEventStore } from './eventStore';
import { createEventApi } from './eventApi';
// Relative (not '@/') so server modules resolve outside Vite's alias — they're
// bundled into vite.config and run under tsx, neither of which applies the alias.
import { VERSION } from '../version';

export type FrameApiOptions = ImageApiOptions & {
  calendarDb: string;
};

/**
 * Builds The Frame's HTTP API. The gallery handlers (#185) are exposed under
 * `image`; the calendar handlers (#186) under `events`; `health` reports both
 * stores. Both halves share this one factory.
 */
export function createFrameApi(opts: FrameApiOptions) {
  const image = createImageApi(opts);
  const calendar = createCalendarStore({ dbPath: opts.calendarDb });
  const events = createEventApi(createEventStore(calendar.db));

  function json(res: ServerResponse, status: number, body: unknown): void {
    const payload = JSON.stringify(body);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(payload);
  }

  function health(_req: IncomingMessage, res: ServerResponse): void {
    json(res, 200, {
      ok: true,
      version: VERSION,
      gallery: { images: image.store.list().length },
      calendar: { ready: calendar.db.open, events: events.store.count() },
    });
  }

  return { health, image, events };
}

export type FrameApi = ReturnType<typeof createFrameApi>;
