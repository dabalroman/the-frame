import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createCalendarStore } from './calendarDb';
import { createEventStore } from './eventStore';
import { createDeviceApi } from './deviceApi';
import type { ImageApi } from './imageApi';

function stubImageApi(): ImageApi {
  return {
    store: {
      randomImagePath: () => null,
      readMeta: () => ({ width: 800, height: 480 }),
      readCropFor: () => null,
      list: () => [],
    },
  } as unknown as ImageApi;
}

function makeApi(tmpDir: string) {
  const dbPath = path.join(tmpDir, 'test.db');
  const { db } = createCalendarStore({ dbPath });
  const eventStore = createEventStore(db);
  return {
    api: createDeviceApi({
      imageApi: stubImageApi(),
      eventStore,
      qrUrl: 'http://localhost:7375',
      defaultW: 800,
      defaultH: 480,
      defaultContrast: 1.2,
    }),
    eventStore,
  };
}

type FakeRes = {
  statusCode: number;
  setHeader(k: string, v: string): void;
  end(s?: string | Buffer): void;
  readonly body: string;
};

function fakeRes(): FakeRes {
  let body = '';
  return {
    statusCode: 0,
    setHeader(_k: string, _v: string) {},
    end(s?: string | Buffer) { body = s == null ? '' : typeof s === 'string' ? s : s.toString('binary'); },
    get body() { return body; },
  } as FakeRes;
}

function fakeReq(url: string): IncomingMessage {
  return { url, method: 'GET' } as unknown as IncomingMessage;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function futureDateIso(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let tmpDir: string;
beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'device-api-test-')); });
afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

describe('deviceApi events', () => {
  it('returns today event with label "Dziś" (default pl)', () => {
    const { api, eventStore } = makeApi(tmpDir);
    eventStore.add({ title: 'Martha', date: todayIso(), time: null, repeat: 'none', description: null });
    const res = fakeRes();
    api.events(fakeReq('/api/device/events?days=7'), res as unknown as ServerResponse);
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body) as { title: string; date: string; today: boolean; label: string }[];
    expect(data[0]?.today).toBe(true);
    expect(data[0]?.label).toBe('Dzisiaj');
  });

  it('returns today event with label "Today" (lang=en)', () => {
    const { api, eventStore } = makeApi(tmpDir);
    eventStore.add({ title: 'Martha', date: todayIso(), time: null, repeat: 'none', description: null });
    const res = fakeRes();
    api.events(fakeReq('/api/device/events?days=7&lang=en'), res as unknown as ServerResponse);
    const data = JSON.parse(res.body) as { label: string }[];
    expect(data[0]?.label).toBe('Today');
  });

  it('returns tomorrow event with label "Jutro"', () => {
    const { api, eventStore } = makeApi(tmpDir);
    eventStore.add({ title: 'Rocznica', date: futureDateIso(1), time: null, repeat: 'none', description: null });
    const res = fakeRes();
    api.events(fakeReq('/api/device/events?days=7'), res as unknown as ServerResponse);
    const data = JSON.parse(res.body) as { label: string }[];
    expect(data[0]?.label).toMatch(/^Jutro$/i);
  });

  it('returns tomorrow event with label "Tomorrow" (lang=en)', () => {
    const { api, eventStore } = makeApi(tmpDir);
    eventStore.add({ title: 'Rocznica', date: futureDateIso(1), time: null, repeat: 'none', description: null });
    const res = fakeRes();
    api.events(fakeReq('/api/device/events?days=7&lang=en'), res as unknown as ServerResponse);
    const data = JSON.parse(res.body) as { label: string }[];
    expect(data[0]?.label).toBe('Tomorrow');
  });

  it('returns upcoming event with Polish weekday name', () => {
    const { api, eventStore } = makeApi(tmpDir);
    const future = futureDateIso(3);
    eventStore.add({ title: 'Rocznica', date: future, time: null, repeat: 'none', description: null });
    const res = fakeRes();
    api.events(fakeReq('/api/device/events?days=7'), res as unknown as ServerResponse);
    const data = JSON.parse(res.body) as { title: string; date: string; today: boolean; label: string }[];
    expect(data[0]?.today).toBe(false);
    expect(data[0]?.date).toBe(future);
    const polishDays = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
    expect(polishDays).toContain(data[0]?.label?.toLowerCase());
  });

  it('returns multiple events in order', () => {
    const { api, eventStore } = makeApi(tmpDir);
    eventStore.add({ title: 'First', date: futureDateIso(1), time: null, repeat: 'none', description: null });
    eventStore.add({ title: 'Second', date: futureDateIso(2), time: null, repeat: 'none', description: null });
    const res = fakeRes();
    api.events(fakeReq('/api/device/events?days=7'), res as unknown as ServerResponse);
    const data = JSON.parse(res.body) as { title: string }[];
    expect(data).toHaveLength(2);
    expect(data[0]?.title).toBe('First');
    expect(data[1]?.title).toBe('Second');
  });

  it('returns empty array when no events', () => {
    const { api } = makeApi(tmpDir);
    const res = fakeRes();
    api.events(fakeReq('/api/device/events?days=7'), res as unknown as ServerResponse);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  describe('time-of-day cutoff (clock fixed at 12:00 local)', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 5, 19, 12, 0, 0)); });
    afterEach(() => { vi.useRealTimers(); });

    it("filters today's timed events whose time has passed; keeps upcoming, exact-now, and all-day", () => {
      const { api, eventStore } = makeApi(tmpDir);
      eventStore.add({ title: 'Past', date: todayIso(), time: '09:00', repeat: 'none', description: null });
      eventStore.add({ title: 'Now', date: todayIso(), time: '12:00', repeat: 'none', description: null });
      eventStore.add({ title: 'Later', date: todayIso(), time: '15:00', repeat: 'none', description: null });
      eventStore.add({ title: 'AllDay', date: todayIso(), time: null, repeat: 'none', description: null });
      const res = fakeRes();
      api.events(fakeReq('/api/device/events?days=7'), res as unknown as ServerResponse);
      const titles = (JSON.parse(res.body) as { title: string }[]).map(e => e.title);
      expect(titles).not.toContain('Past');
      expect(titles).toContain('Now');
      expect(titles).toContain('Later');
      expect(titles).toContain('AllDay');
    });

    it('keeps future-day timed events even when their time is earlier than now', () => {
      const { api, eventStore } = makeApi(tmpDir);
      eventStore.add({ title: 'EarlyTomorrow', date: futureDateIso(1), time: '06:00', repeat: 'none', description: null });
      const res = fakeRes();
      api.events(fakeReq('/api/device/events?days=7'), res as unknown as ServerResponse);
      const titles = (JSON.parse(res.body) as { title: string }[]).map(e => e.title);
      expect(titles).toContain('EarlyTomorrow');
    });
  });
});
