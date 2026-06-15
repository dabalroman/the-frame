import type { IncomingMessage, ServerResponse } from 'node:http';
import { createImageApi, type ImageApiOptions } from './imageApi';
import { createCalendarStore } from './calendarDb';
// Relative (not '@/') so server modules resolve outside Vite's alias — they're
// bundled into vite.config and run under tsx, neither of which applies the alias.
import { VERSION } from '../version';

export type FrameApiOptions = ImageApiOptions & {
  calendarDb: string;
};

/**
 * Builds The Frame's HTTP API. The gallery handlers (#185) are ported from
 * eink-frame and exposed under `image`; `health` reports both stores. The
 * calendar (#186) endpoints hang off this same factory later.
 */
export function createFrameApi(opts: FrameApiOptions) {
  const image = createImageApi(opts);
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
      gallery: { images: image.store.list().length },
      calendar: { ready: calendar.db.open },
    });
  }

  return { health, image };
}

export type FrameApi = ReturnType<typeof createFrameApi>;
