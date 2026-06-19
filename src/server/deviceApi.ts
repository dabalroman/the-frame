import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { processForEink } from './image/process';
import { renderQrImage } from './deviceRenderer';
import type { ImageApi } from './imageApi';
import type { EventStore } from './eventStore';

export type DeviceApiOpts = {
  imageApi: ImageApi;
  eventStore: EventStore;
  qrUrl: string;
  defaultW: number;
  defaultH: number;
  defaultContrast: number;
};

type Lang = 'pl' | 'en';

function parseLang(v: string | null): Lang {
  return v === 'en' ? 'en' : 'pl';
}

function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function eventLabel(occursOn: string, isToday: boolean, lang: Lang): string {
  const locale = lang === 'en' ? 'en-GB' : 'pl-PL';
  const date = new Date(`${occursOn}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000);

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (isToday || diffDays === 0) {
    return cap(new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'day'));
  }
  if (diffDays === 1) {
    return cap(new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(1, 'day'));
  }
  return cap(new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date));
}

function shortDate(occursOn: string, lang: Lang): string {
  const date = new Date(`${occursOn}T12:00:00`);
  if (lang === 'pl') {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
  }
  return new Intl.DateTimeFormat('en-GB').format(date); // DD/MM/YYYY
}

function longDate(occursOn: string, lang: Lang): string {
  const locale = lang === 'en' ? 'en-GB' : 'pl-PL';
  const date = new Date(`${occursOn}T12:00:00`);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
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
    invert = false,
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
        width: w, height: h, contrast, invert,
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
      let w = Math.max(1, parseInt(qs.get('w') ?? String(dw), 10) || dw);
      let h = Math.max(1, parseInt(qs.get('h') ?? String(dh), 10) || dh);
      // Client always sends landscape dims (800×480); swap them for portrait requests.
      if (orientation === 'vertical' && w > h) [w, h] = [h, w];
      const contrast = parseFloat(qs.get('contrast') ?? String(defaultContrast)) || defaultContrast;
      const invert = qs.get('invert') === '1';
      await servePhoto(res, orientation, w, h, contrast, invert);
    },

    events(req: IncomingMessage, res: ServerResponse): void {
      const qs = new URL(req.url ?? '/', 'http://x').searchParams;
      const rawDays = qs.get('days');
      const parsedDays = rawDays === null ? 3 : Number(rawDays);
      const days = Number.isFinite(parsedDays) ? Math.min(366, Math.max(0, Math.trunc(parsedDays))) : 3;
      const lang = parseLang(qs.get('lang'));
      const today = localToday();
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const raw = eventStore.upcoming(today, days);
      const upcoming = raw.filter(ev => {
        if (!ev.isToday || ev.time === null) return true;
        const [h, m] = ev.time.split(':').map(Number) as [number, number];
        return h * 60 + m >= currentMinutes;
      });
      const body = JSON.stringify(upcoming.map(ev => ({
        title: ev.title,
        date: ev.occursOn,
        today: ev.isToday,
        label: eventLabel(ev.occursOn, ev.isToday, lang),
        shortDate: shortDate(ev.occursOn, lang),
        longDate: longDate(ev.occursOn, lang),
        time: ev.time,
        description: ev.description,
      })));
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(body);
    },

    async qr(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const qs = new URL(req.url ?? '/', 'http://x').searchParams;
        const invert = qs.get('invert') === '1';
        const png = await renderQrImage(opts.qrUrl, invert);
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
