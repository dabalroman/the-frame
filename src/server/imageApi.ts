import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import multer from 'multer';
import { processForEink } from './image/process';
import { createImageStore } from './imageStore';
import { clampCrop, orientedFrame } from '../lib/crop';
import type { Crop, Orientation } from '@/types/image';

/**
 * The Frame image HTTP handlers. Ported from random-tools' eink-frame
 * (src/server/einkApi.ts) — see #185. Logic is identical; only names differ.
 */

export type ImageApiOptions = {
  galleryDir: string;
  maxUploadBytes: number;
  defaultW: number;
  defaultH: number;
  defaultContrast: number;
};

function parseOrientation(v: string | null): Orientation {
  return v === 'vertical' ? 'vertical' : 'horizontal';
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function runMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  fn: (req: ExpressRequest, res: ExpressResponse, next: (err?: unknown) => void) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    fn(req as ExpressRequest, res as ExpressResponse, (err?: unknown) => (err ? reject(err) : resolve()));
  });
}

export function createImageApi(opts: ImageApiOptions) {
  const store = createImageStore(opts);
  const { defaultW, defaultH, defaultContrast } = opts;

  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, _file, cb) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = req as any;
        r.__scratchDir ??= fs.mkdtempSync(path.join(os.tmpdir(), 'the-frame-'));
        cb(null, r.__scratchDir as string);
      },
      filename: (_req, _file, cb) =>
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    }),
    limits: { fileSize: opts.maxUploadBytes, files: 20 },
  });

  return {
    store,

    async random(req: IncomingMessage, res: ServerResponse): Promise<void> {
      const qs = new URL(req.url ?? '/', 'http://x').searchParams;
      const orientation = parseOrientation(qs.get('orientation'));
      // Vertical = same panel rotated 90°; default w/h swap so the aspect matches the crop.
      const [dw, dh] = orientation === 'vertical' ? [defaultH, defaultW] : [defaultW, defaultH];
      const w = Math.max(1, parseInt(qs.get('w') ?? String(dw), 10) || dw);
      const h = Math.max(1, parseInt(qs.get('h') ?? String(dh), 10) || dh);
      const contrast = parseFloat(qs.get('contrast') ?? String(defaultContrast)) || defaultContrast;
      const invert = ['1', 'true', 'yes'].includes(qs.get('invert') ?? '');

      const imgPath = store.randomImagePath(orientation);
      if (!imgPath) { res.statusCode = 404; res.end('No images available'); return; }

      try {
        const imgName = path.basename(imgPath);
        const imgMeta = store.readMeta(imgName);
        const crop = store.readCropFor(imgName, orientation);
        const png = await processForEink(imgPath, { width: w, height: h, contrast, invert, crop, srcWidth: imgMeta.width, srcHeight: imgMeta.height });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-store');
        res.end(png);
      } catch (err) {
        console.error('[the-frame] process error', err);
        res.statusCode = 500;
        res.end('Processing error');
      }
    },

    async named(req: IncomingMessage, res: ServerResponse, name: string): Promise<void> {
      const qs = new URL(req.url ?? '/', 'http://x').searchParams;
      const orientation = parseOrientation(qs.get('orientation'));
      const [dw, dh] = orientation === 'vertical' ? [defaultH, defaultW] : [defaultW, defaultH];
      const w = Math.max(1, parseInt(qs.get('w') ?? String(dw), 10) || dw);
      const h = Math.max(1, parseInt(qs.get('h') ?? String(dh), 10) || dh);
      const contrast = parseFloat(qs.get('contrast') ?? String(defaultContrast)) || defaultContrast;
      const invert = ['1', 'true', 'yes'].includes(qs.get('invert') ?? '');

      try {
        const imgPath = store.getImagePath(name);
        // Strict: no crop for the requested orientation → not available (404). The client
        // only offers a preview when a crop exists, so this is never hit from the UI.
        const crop = store.readCropFor(name, orientation);
        if (!crop) { res.statusCode = 404; res.end('No crop for orientation'); return; }
        const imgMeta = store.readMeta(name);
        const png = await processForEink(imgPath, { width: w, height: h, contrast, invert, crop, srcWidth: imgMeta.width, srcHeight: imgMeta.height });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-store');
        res.end(png);
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        res.statusCode = e.status ?? 500;
        res.end(e.message ?? 'Error');
      }
    },

    list(_req: IncomingMessage, res: ServerResponse): void {
      json(res, 200, store.list());
    },

    serve(_req: IncomingMessage, res: ServerResponse, name: string): void {
      try {
        const filePath = store.getImagePath(name);
        const ext = path.extname(name).toLowerCase();
        const ct =
          ext === '.png' ? 'image/png' :
          ext === '.webp' ? 'image/webp' :
          ext === '.gif' ? 'image/gif' :
          'image/jpeg';
        res.statusCode = 200;
        res.setHeader('Content-Type', ct);
        res.setHeader('Cache-Control', 'max-age=3600');
        fs.createReadStream(filePath).pipe(res);
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        json(res, e.status ?? 500, { error: e.message ?? 'Error' });
      }
    },

    async thumb(req: IncomingMessage, res: ServerResponse, name: string): Promise<void> {
      try {
        const orientation = parseOrientation(new URL(req.url ?? '/', 'http://x').searchParams.get('orientation'));
        const thumbPath = await store.getThumbPath(name, orientation);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'max-age=86400');
        fs.createReadStream(thumbPath).pipe(res);
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        json(res, e.status ?? 500, { error: e.message ?? 'Error' });
      }
    },

    async uploadFiles(req: IncomingMessage, res: ServerResponse): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reqAny = req as any;
      try {
        try {
          await runMiddleware(req, res, upload.array('files', 20));
        } catch (err: unknown) {
          const e = err as { code?: string; message?: string };
          if (e.code === 'LIMIT_FILE_SIZE') { json(res, 413, { error: 'File too large' }); return; }
          json(res, 500, { error: e.message ?? 'Upload error' });
          return;
        }

        const files = reqAny.files as Array<{ path: string; originalname: string }> | undefined;
        if (!files || files.length === 0) { json(res, 400, { error: 'No files' }); return; }

        const qs = new URL(req.url ?? '/', 'http://x').searchParams;
        const force = qs.get('force') === '1';

        const results = await Promise.all(
          files.map(async f => {
            try {
              return await store.save(f.path, f.originalname, { force });
            } catch (err) {
              const e = err as { message?: string; status?: number };
              return { ok: false as const, error: e.message ?? 'Save failed', status: (e.status as number | undefined) ?? 500 };
            }
          }),
        );
        json(res, 207, results);
      } finally {
        const scratchDir = reqAny.__scratchDir as string | undefined;
        if (scratchDir) fs.rmSync(scratchDir, { recursive: true, force: true });
      }
    },

    remove(_req: IncomingMessage, res: ServerResponse, name: string): void {
      try {
        store.remove(name);
        json(res, 200, { ok: true });
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        json(res, e.status ?? 500, { error: e.message });
      }
    },

    async restore(_req: IncomingMessage, res: ServerResponse, name: string): Promise<void> {
      try {
        await store.restore(name);
        json(res, 200, { ok: true });
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        json(res, e.status ?? 500, { error: e.message });
      }
    },

    purge(_req: IncomingMessage, res: ServerResponse, name: string): void {
      try {
        store.purge(name);
        json(res, 200, { ok: true });
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        json(res, e.status ?? 500, { error: e.message });
      }
    },

    getCrop(req: IncomingMessage, res: ServerResponse, name: string): void {
      try {
        resolveSafePublic(opts.galleryDir, name);
        const orientation = parseOrientation(new URL(req.url ?? '/', 'http://x').searchParams.get('orientation'));
        const crop = store.readCropFor(name, orientation);
        json(res, 200, { crop: crop ?? null });
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        json(res, e.status ?? 500, { error: e.message });
      }
    },

    async putCrop(req: IncomingMessage, res: ServerResponse, name: string): Promise<void> {
      try {
        resolveSafePublic(opts.galleryDir, name);
        const orientation = parseOrientation(new URL(req.url ?? '/', 'http://x').searchParams.get('orientation'));
        const body = await readBody(req);
        const parsed = JSON.parse(body) as { crop?: Crop | null };
        const crop = parsed.crop ?? null;
        if (crop !== null) {
          const { x, y, w, h } = crop;
          if (
            !Number.isFinite(x) || !Number.isFinite(y) ||
            !Number.isFinite(w) || !Number.isFinite(h) ||
            w <= 0 || h <= 0
          ) {
            json(res, 400, { error: 'Invalid crop values' });
            return;
          }
          // Oversize crops (#184) may go outside [0,1], but must stay within the legal
          // zoom/pan envelope — otherwise process.ts would extend a huge white canvas
          // (DoS). Validate against the same shared clamp: reject anything the clamp would
          // move. This enforces min-size, contain-fit max, AND the ≥2-edge invariant.
          const meta = store.readMeta(name);
          let iw = meta.width;
          let ih = meta.height;
          if (iw === undefined || ih === undefined) {
            const m = await sharp(store.getImagePath(name)).rotate().metadata();
            iw = m.width ?? 1;
            ih = m.height ?? 1;
          }
          const { fw, fh } = orientedFrame(orientation, defaultW, defaultH);
          const clamped = clampCrop(crop, iw, ih, fw, fh);
          const EPS = 0.01;
          if (
            Math.abs(clamped.x - x) > EPS || Math.abs(clamped.y - y) > EPS ||
            Math.abs(clamped.w - w) > EPS || Math.abs(clamped.h - h) > EPS
          ) {
            json(res, 400, { error: 'Invalid crop values' });
            return;
          }
        }
        store.writeCrop(name, orientation, crop);
        json(res, 200, { ok: true });
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        json(res, e.status ?? 500, { error: e.message });
      }
    },

    deleteCrop(req: IncomingMessage, res: ServerResponse, name: string): void {
      try {
        resolveSafePublic(opts.galleryDir, name);
        const orientation = parseOrientation(new URL(req.url ?? '/', 'http://x').searchParams.get('orientation'));
        // Removal is always allowed; an image left with no crops is simply ignored by the frame.
        store.writeCrop(name, orientation, null);
        json(res, 200, { ok: true });
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        json(res, e.status ?? 500, { error: e.message });
      }
    },

    config(_req: IncomingMessage, res: ServerResponse): void {
      json(res, 200, { width: defaultW, height: defaultH });
    },
  };
}

function resolveSafePublic(dir: string, name: string): void {
  const resolved = path.resolve(dir, name);
  if (path.dirname(resolved) !== path.resolve(dir)) {
    throw Object.assign(new Error('Invalid filename'), { status: 400 });
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export type ImageApi = ReturnType<typeof createImageApi>;
