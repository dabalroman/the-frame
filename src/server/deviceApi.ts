import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { processForEink } from './image/process';
import { renderEventsImage, renderQrImage } from './deviceRenderer';
import type { ImageApi } from './imageApi';
import type { EventStore } from './eventStore';
import type { UpcomingEvent } from '@/types/event';

export type DeviceApiOpts = {
  imageApi: ImageApi;
  eventStore: EventStore;
  qrPath: string;
  defaultW: number;
  defaultH: number;
  defaultContrast: number;
};

const PL_DAYS = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'];
const PL_MONTHS = ['sty.', 'lut.', 'mar.', 'kwi.', 'maj', 'cze.', 'lip.', 'sie.', 'wrz.', 'paź.', 'lis.', 'gru.'];

function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatEventLine(ev: UpcomingEvent): string {
  if (ev.isToday) {
    return `★ ${ev.title} — dziś`;
  }
  const d = new Date(`${ev.occursOn}T12:00:00`);
  const dayName = PL_DAYS[d.getDay()] ?? '';
  const dayNum = d.getDate();
  const monthName = PL_MONTHS[d.getMonth()] ?? '';
  return `• ${ev.title} — ${dayName} ${dayNum} ${monthName}`;
}

function parseOrientation(v: string | null): 'horizontal' | 'vertical' {
  return v === 'vertical' ? 'vertical' : 'horizontal';
}

export function createDeviceApi(opts: DeviceApiOpts) {
  const { imageApi, eventStore, defaultW, defaultH, defaultContrast } = opts;

  async function servePhoto(
    res: ServerResponse,
    orientation: 'horizontal' | 'vertical',
    w: number,
    h: number,
    contrast: number,
  ): Promise<void> {
    const imgPath = imageApi.store.randomImagePath(orientation);
    if (!imgPath) {
      res.statusCode = 404;
      res.end('No images available');
      return;
    }
    try {
      const imgName = path.basename(imgPath);
      const imgMeta = imageApi.store.readMeta(imgName);
      const crop = imageApi.store.readCropFor(imgName, orientation);
      const png = await processForEink(imgPath, {
        width: w, height: h, contrast,
        crop: crop ?? undefined,
        srcWidth: imgMeta.width, srcHeight: imgMeta.height,
      });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-store');
      res.end(png);
    } catch (err) {
      console.error('[device-api] photo error', err);
      res.statusCode = 500;
      res.end('Processing error');
    }
  }

  return {
    async photo(req: IncomingMessage, res: ServerResponse): Promise<void> {
      const qs = new URL(req.url ?? '/', 'http://x').searchParams;
      const orientation = parseOrientation(qs.get('orientation'));
      const [dw, dh] = orientation === 'vertical' ? [defaultH, defaultW] : [defaultW, defaultH];
      const w = Math.max(1, parseInt(qs.get('w') ?? String(dw), 10) || dw);
      const h = Math.max(1, parseInt(qs.get('h') ?? String(dh), 10) || dh);
      const contrast = parseFloat(qs.get('contrast') ?? String(defaultContrast)) || defaultContrast;
      await servePhoto(res, orientation, w, h, contrast);
    },

    /**
     * Server-side dispatch: returns either a rendered events image or a random photo.
     * The server rolls the X% chance so the device is fully dumb (just displays whatever it gets).
     * Query params: orientation, w, h, days (default 3), chance (default 30), contrast.
     */
    async frame(req: IncomingMessage, res: ServerResponse): Promise<void> {
      const qs = new URL(req.url ?? '/', 'http://x').searchParams;
      const orientation = parseOrientation(qs.get('orientation'));
      const [dw, dh] = orientation === 'vertical' ? [defaultH, defaultW] : [defaultW, defaultH];
      const w = Math.max(1, parseInt(qs.get('w') ?? String(dw), 10) || dw);
      const h = Math.max(1, parseInt(qs.get('h') ?? String(dh), 10) || dh);
      const contrast = parseFloat(qs.get('contrast') ?? String(defaultContrast)) || defaultContrast;
      const days = Math.max(0, Math.min(366, parseInt(qs.get('days') ?? '3', 10) || 3));
      const chance = Math.max(0, Math.min(100, parseInt(qs.get('chance') ?? '30', 10) || 30));

      const today = localToday();
      const upcoming = eventStore.upcoming(today, days);
      const showEvents = upcoming.length > 0 && Math.random() * 100 < chance;

      if (showEvents) {
        const lines = upcoming.map(formatEventLine);
        try {
          const png = await renderEventsImage(lines, opts.qrPath, w, h);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'no-store');
          res.end(png);
        } catch (err) {
          console.error('[device-api] events render error', err);
          await servePhoto(res, orientation, w, h, contrast);
        }
        return;
      }

      await servePhoto(res, orientation, w, h, contrast);
    },

    events(req: IncomingMessage, res: ServerResponse): void {
      const qs = new URL(req.url ?? '/', 'http://x').searchParams;
      const rawDays = qs.get('days');
      const parsedDays = rawDays === null ? 3 : Number(rawDays);
      const days = Number.isFinite(parsedDays) ? Math.min(366, Math.max(0, Math.trunc(parsedDays))) : 3;
      const today = localToday();
      const upcoming = eventStore.upcoming(today, days);
      const body = upcoming.map(formatEventLine).join('\n');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(body);
    },

    async qr(_req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const png = await renderQrImage(opts.qrPath);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-store');
        res.end(png);
      } catch (err) {
        console.error('[device-api] qr error', err);
        res.statusCode = 500;
        res.end('QR processing error');
      }
    },
  };
}

export type DeviceApi = ReturnType<typeof createDeviceApi>;
