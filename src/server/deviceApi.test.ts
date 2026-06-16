import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
      qrPath: path.join(tmpDir, 'qr.png'),
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
  end(s?: string): void;
  readonly body: string;
};

function fakeRes(): FakeRes {
  let body = '';
  return {
    statusCode: 0,
    setHeader(_k: string, _v: string) {},
    end(s?: string) { body = s ?? ''; },
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
  it('formats today event with ★ prefix', () => {
    const { api, eventStore } = makeApi(tmpDir);
    eventStore.add({ title: 'Martha', date: todayIso(), time: null, repeat: 'none', description: null });
    const res = fakeRes();
    api.events(fakeReq('/api/device/events?days=7'), res as unknown as ServerResponse);
    expect(res.body).toMatch(/^★ Martha — dziś/);
    expect(res.statusCode).toBe(200);
  });

  it('formats upcoming event with • prefix and Polish date', () => {
    const { api, eventStore } = makeApi(tmpDir);
    eventStore.add({ title: 'Rocznica', date: futureDateIso(3), time: null, repeat: 'none', description: null });
    const res = fakeRes();
    api.events(fakeReq('/api/device/events?days=7'), res as unknown as ServerResponse);
    expect(res.body).toMatch(/^• Rocznica —/);
  });

  it('returns multiple events, one per line', () => {
    const { api, eventStore } = makeApi(tmpDir);
    eventStore.add({ title: 'First', date: futureDateIso(1), time: null, repeat: 'none', description: null });
    eventStore.add({ title: 'Second', date: futureDateIso(2), time: null, repeat: 'none', description: null });
    const res = fakeRes();
    api.events(fakeReq('/api/device/events?days=7'), res as unknown as ServerResponse);
    const lines = res.body.split('\n');
    expect(lines.length).toBe(2);
    expect(lines[0]).toMatch(/First/);
    expect(lines[1]).toMatch(/Second/);
  });

  it('returns empty body when no events', () => {
    const { api } = makeApi(tmpDir);
    const res = fakeRes();
    api.events(fakeReq('/api/device/events?days=7'), res as unknown as ServerResponse);
    expect(res.body).toBe('');
    expect(res.statusCode).toBe(200);
  });
});
