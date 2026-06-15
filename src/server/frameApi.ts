import type { IncomingMessage, ServerResponse } from 'node:http';
import { createImageStore } from './imageStore';
import { createCalendarStore } from './calendarDb';
// Relative (not '@/') so server modules resolve outside Vite's alias — they're
// bundled into vite.config and run under tsx, neither of which applies the alias.
import { VERSION } from '../version';

export type FrameApiOptions = {
  galleryDir: string;
  calendarDb: string;
};

/**
 * Builds The Frame's HTTP API. Scaffold scope (#183): initialises both stores
 * (proving the wiring) and exposes a single `health` handler. The gallery
 * (#185) and calendar (#186) endpoints hang off this same factory later.
 */
export function createFrameApi(opts: FrameApiOptions) {
  const images = createImageStore({ galleryDir: opts.galleryDir });
  const calendar = createCalendarStore({ dbPath: opts.calendarDb });

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
      gallery: { images: images.list().length },
      calendar: { ready: calendar.db.open },
    });
  }

  return { health };
}

export type FrameApi = ReturnType<typeof createFrameApi>;
