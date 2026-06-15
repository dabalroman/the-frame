import type { IncomingMessage, ServerResponse } from 'node:http';
import { validateEventInput } from '../lib/event';
import type { EventStore } from './eventStore';

/**
 * The Frame event HTTP handlers (#186). JSON in/out; thin wrappers over the store
 * with input validation at the boundary. Wired into `frameApiPlugin`'s dispatch.
 */

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Server-local 'YYYY-MM-DD' (the frame lives in one timezone; no UTC shift). */
function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function parseJson(req: IncomingMessage): Promise<unknown> {
  const raw = await readBody(req);
  return raw ? JSON.parse(raw) : null;
}

export function createEventApi(store: EventStore) {
  return {
    store,

    list(_req: IncomingMessage, res: ServerResponse): void {
      json(res, 200, store.list());
    },

    upcoming(req: IncomingMessage, res: ServerResponse): void {
      const raw = new URL(req.url ?? '/', 'http://x').searchParams.get('days');
      const parsed = raw === null ? 3 : Number(raw);
      const days = Number.isFinite(parsed) ? Math.min(366, Math.max(0, Math.trunc(parsed))) : 3;
      json(res, 200, store.upcoming(localToday(), days));
    },

    async create(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const result = validateEventInput(await parseJson(req));
        if (!result.ok) { json(res, 400, { error: result.error }); return; }
        json(res, 201, store.add(result.value));
      } catch {
        json(res, 400, { error: 'Invalid JSON' });
      }
    },

    async update(req: IncomingMessage, res: ServerResponse, id: number): Promise<void> {
      try {
        const result = validateEventInput(await parseJson(req));
        if (!result.ok) { json(res, 400, { error: result.error }); return; }
        const updated = store.update(id, result.value);
        if (!updated) { json(res, 404, { error: 'Not found' }); return; }
        json(res, 200, updated);
      } catch {
        json(res, 400, { error: 'Invalid JSON' });
      }
    },

    remove(_req: IncomingMessage, res: ServerResponse, id: number): void {
      if (store.remove(id)) json(res, 200, { ok: true });
      else json(res, 404, { error: 'Not found' });
    },
  };
}

export type EventApi = ReturnType<typeof createEventApi>;
