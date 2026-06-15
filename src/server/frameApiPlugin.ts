import type { IncomingMessage, ServerResponse } from 'node:http';
import { createFrameApi, type FrameApiOptions, type FrameApi } from './frameApi';

type Next = (err?: unknown) => void;
type Handler = (req: IncomingMessage, res: ServerResponse, next?: Next) => void;

/** Minimal surface shared by Vite's connect stack and an Express app. */
export type MiddlewareStack = { use: (path: string, handler: Handler) => void };

/**
 * Mount the Frame API on a connect/express middleware stack under `/api`.
 * Used by both the Vite dev plugin (vite.config.ts) and the prod server
 * (server.ts), so dev and prod share one router.
 *
 * The gallery routes are ported from eink-frame's einkRouter dispatch (#185).
 * The device photo path lives at `/photo` + `/photo/:name` (not a bare `/:name`
 * catch-all) so it never shadows `/health` or future calendar routes (#186) on
 * the shared `/api` namespace.
 */
export function mountFrameApi(stack: MiddlewareStack, opts: FrameApiOptions): void {
  const api = createFrameApi(opts);

  const handle: Handler = (req, res, next) => {
    // req.url is already prefix-stripped by connect/express `use('/api', …)`.
    const pathname = new URL(req.url ?? '/', 'http://x').pathname;
    const method = req.method ?? 'GET';

    if (method === 'GET' && pathname === '/health') return api.health(req, res);

    void dispatch(pathname, method, req, res, next, api.image);
  };

  stack.use('/api', handle);
}

async function dispatch(
  pathname: string,
  method: string,
  req: IncomingMessage,
  res: ServerResponse,
  next: Next | undefined,
  image: FrameApi['image'],
): Promise<void> {
  try {
    if (method === 'GET' && pathname === '/config') {
      return image.config(req, res);
    }

    if (method === 'GET' && pathname === '/images') {
      return image.list(req, res);
    }

    if (method === 'POST' && pathname === '/images') {
      return await image.uploadFiles(req, res);
    }

    const thumbMatch = pathname.match(/^\/images\/([^/]+)\/thumb$/);
    if (thumbMatch) {
      const name = decodeURIComponent(thumbMatch[1]!);
      if (method === 'GET') return await image.thumb(req, res, name);
    }

    const restoreMatch = pathname.match(/^\/images\/([^/]+)\/restore$/);
    if (restoreMatch) {
      const name = decodeURIComponent(restoreMatch[1]!);
      if (method === 'POST') return image.restore(req, res, name);
    }

    const cropMatch = pathname.match(/^\/images\/([^/]+)\/crop$/);
    if (cropMatch) {
      const name = decodeURIComponent(cropMatch[1]!);
      if (method === 'GET') return image.getCrop(req, res, name);
      if (method === 'PUT') return await image.putCrop(req, res, name);
      if (method === 'DELETE') return image.deleteCrop(req, res, name);
    }

    const imgMatch = pathname.match(/^\/images\/([^/]+)$/);
    if (imgMatch) {
      const name = decodeURIComponent(imgMatch[1]!);
      if (method === 'GET') return image.serve(req, res, name);
      if (method === 'DELETE') return image.remove(req, res, name);
    }

    const trashMatch = pathname.match(/^\/trash\/([^/]+)$/);
    if (trashMatch) {
      const name = decodeURIComponent(trashMatch[1]!);
      if (method === 'DELETE') return image.purge(req, res, name);
    }

    if (method === 'GET' && pathname === '/photo') {
      return await image.random(req, res);
    }

    const photoMatch = pathname.match(/^\/photo\/([^/]+)$/);
    if (photoMatch) {
      const name = decodeURIComponent(photoMatch[1]!);
      if (method === 'GET') return await image.named(req, res, name);
    }

    if (next) return next();
    res.statusCode = 404;
    res.end('Not found');
  } catch (err: unknown) {
    console.error('[frame-api]', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}
