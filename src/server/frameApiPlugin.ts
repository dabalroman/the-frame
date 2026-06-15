import type { IncomingMessage, ServerResponse } from 'node:http';
import { createFrameApi, type FrameApiOptions } from './frameApi';

type Next = (err?: unknown) => void;
type Handler = (req: IncomingMessage, res: ServerResponse, next?: Next) => void;

/** Minimal surface shared by Vite's connect stack and an Express app. */
export type MiddlewareStack = { use: (path: string, handler: Handler) => void };

/**
 * Mount the Frame API on a connect/express middleware stack under `/api`.
 * Used by both the Vite dev plugin (vite.config.ts) and the prod server
 * (server.ts), so dev and prod share one router.
 */
export function mountFrameApi(stack: MiddlewareStack, opts: FrameApiOptions): void {
  const api = createFrameApi(opts);

  const handle: Handler = (req, res, next) => {
    // req.url is already prefix-stripped by connect/express `use('/api', …)`.
    const pathname = new URL(req.url ?? '/', 'http://x').pathname;
    const method = req.method ?? 'GET';

    if (method === 'GET' && pathname === '/health') return api.health(req, res);

    if (next) return next();
    res.statusCode = 404;
    res.end();
  };

  stack.use('/api', handle);
}
