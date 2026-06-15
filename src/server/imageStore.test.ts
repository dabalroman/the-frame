import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createImageStore } from './imageStore';

let dir = '';
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'the-frame-imgstore-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('createImageStore', () => {
  it('creates the gallery + sidecar/thumb/trash subdirs on init', () => {
    const galleryDir = path.join(dir, 'gallery');
    const store = createImageStore({ galleryDir });
    expect(fs.existsSync(galleryDir)).toBe(true);
    expect(fs.existsSync(store.metaDir)).toBe(true);
    expect(fs.existsSync(store.thumbsDir)).toBe(true);
    expect(fs.existsSync(store.trashDir)).toBe(true);
  });

  it('lists nothing for an empty gallery', () => {
    const store = createImageStore({ galleryDir: path.join(dir, 'gallery') });
    expect(store.list()).toEqual([]);
  });

  it('lists image files and reads crops from sidecar metadata', () => {
    const galleryDir = path.join(dir, 'gallery');
    const store = createImageStore({ galleryDir });
    fs.writeFileSync(path.join(galleryDir, 'photo.jpg'), 'not-a-real-jpeg');
    fs.writeFileSync(path.join(galleryDir, 'ignore.txt'), 'nope');
    fs.writeFileSync(
      path.join(store.metaDir, 'photo.json'),
      JSON.stringify({ width: 100, height: 80, crops: { horizontal: { x: 0, y: 0, w: 1, h: 1 } } }),
    );

    const list = store.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe('photo.jpg');
    expect(store.readCrops('photo.jpg').horizontal).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('back-compat: a legacy single `crop` sidecar reads as crops.horizontal', () => {
    const galleryDir = path.join(dir, 'gallery');
    const store = createImageStore({ galleryDir });
    fs.writeFileSync(path.join(galleryDir, 'legacy.jpg'), 'x');
    fs.writeFileSync(
      path.join(store.metaDir, 'legacy.json'),
      JSON.stringify({ width: 10, height: 10, crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 } }),
    );
    expect(store.readCropFor('legacy.jpg', 'horizontal')).toEqual({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 });
    expect(store.readCropFor('legacy.jpg', 'vertical')).toBeUndefined();
  });
});

// ── pipeline (save / dedupe / crop / random / trash lifecycle) ──────────────────

/** A real JPEG (raw RGB → sharp), so file-type magic-byte detection passes. */
async function jpegBuffer(w: number, h: number, seed = 0): Promise<Buffer> {
  const data = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const v = ((i % w) / w) * 255; // smooth horizontal gradient
    data[i * 3] = (v + seed) % 256;
    data[i * 3 + 1] = v;
    data[i * 3 + 2] = (255 - v + seed) % 256;
  }
  return sharp(data, { raw: { width: w, height: h, channels: 3 } }).jpeg().toBuffer();
}

describe('createImageStore — pipeline', () => {
  let scratch = '';
  beforeEach(() => { scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'the-frame-scratch-')); });
  afterEach(() => { fs.rmSync(scratch, { recursive: true, force: true }); });

  function writeTemp(buf: Buffer, tag: string): string {
    const p = path.join(scratch, `up-${tag}-${Math.random().toString(36).slice(2)}.jpg`);
    fs.writeFileSync(p, buf);
    return p;
  }

  it('saves a landscape image, writes the sidecar, and auto-seeds a horizontal crop', async () => {
    const store = createImageStore({ galleryDir: path.join(dir, 'gallery') });
    const buf = await jpegBuffer(1200, 800);
    const res = await store.save(writeTemp(buf, 'a'), 'a.jpg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const list = store.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe(res.name);

    const meta = store.readMeta(res.name);
    expect(meta.width).toBeGreaterThan(0);
    expect(meta.height).toBeGreaterThan(0);
    // Landscape (w ≥ h) seeds the horizontal slot only.
    expect(store.readCropFor(res.name, 'horizontal')).toBeDefined();
    expect(store.readCropFor(res.name, 'vertical')).toBeUndefined();
  });

  it('rejects a perceptual duplicate with a 409 + matchedName, unless force', async () => {
    const store = createImageStore({ galleryDir: path.join(dir, 'gallery') });
    const buf = await jpegBuffer(1000, 700, 1);
    const first = await store.save(writeTemp(buf, 'first'), 'first.jpg');
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const dup = await store.save(writeTemp(buf, 'dup'), 'dup.jpg');
    expect(dup).toMatchObject({ ok: false, duplicate: true, matchedName: first.name, status: 409 });

    const forced = await store.save(writeTemp(buf, 'forced'), 'forced.jpg', { force: true });
    expect(forced.ok).toBe(true);
    expect(store.list()).toHaveLength(2);
  });

  it('rejects a non-image file (magic-byte check)', async () => {
    const store = createImageStore({ galleryDir: path.join(dir, 'gallery') });
    const res = await store.save(writeTemp(Buffer.from('hello, not an image'), 'txt'), 'notes.txt');
    expect(res).toMatchObject({ ok: false, status: 415 });
  });

  it('writes and clears per-orientation crops independently', async () => {
    const store = createImageStore({ galleryDir: path.join(dir, 'gallery') });
    const res = await store.save(writeTemp(await jpegBuffer(1200, 800), 'c'), 'c.jpg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    store.writeCrop(res.name, 'vertical', { x: 0.2, y: 0, w: 0.6, h: 1 });
    expect(store.readCropFor(res.name, 'vertical')).toEqual({ x: 0.2, y: 0, w: 0.6, h: 1 });

    store.writeCrop(res.name, 'horizontal', null);
    expect(store.readCropFor(res.name, 'horizontal')).toBeUndefined();
    // Vertical survives clearing horizontal.
    expect(store.readCropFor(res.name, 'vertical')).toBeDefined();
  });

  it('randomImagePath filters strictly by orientation crop', async () => {
    const store = createImageStore({ galleryDir: path.join(dir, 'gallery') });
    const res = await store.save(writeTemp(await jpegBuffer(1200, 800), 'r'), 'r.jpg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Seeded horizontal only.
    expect(store.randomImagePath('horizontal')).toContain(res.name);
    expect(store.randomImagePath('vertical')).toBeNull();

    store.writeCrop(res.name, 'vertical', { x: 0.2, y: 0, w: 0.6, h: 1 });
    expect(store.randomImagePath('vertical')).toContain(res.name);
  });

  it('remove → restore round-trips through the trash', async () => {
    const store = createImageStore({ galleryDir: path.join(dir, 'gallery') });
    const res = await store.save(writeTemp(await jpegBuffer(900, 600), 'd'), 'd.jpg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    store.remove(res.name);
    expect(store.list()).toHaveLength(0);
    expect(fs.existsSync(path.join(store.trashDir, res.name))).toBe(true);

    await store.restore(res.name);
    expect(store.list().map(i => i.name)).toContain(res.name);
    expect(fs.existsSync(path.join(store.trashDir, res.name))).toBe(false);
  });

  it('generates a separate thumbnail per orientation (landscape vs portrait)', async () => {
    const store = createImageStore({ galleryDir: path.join(dir, 'gallery') });
    const res = await store.save(writeTemp(await jpegBuffer(1200, 800), 't'), 't.jpg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const hp = await store.getThumbPath(res.name, 'horizontal');
    const vp = await store.getThumbPath(res.name, 'vertical');
    expect(hp).not.toBe(vp);
    expect(fs.existsSync(hp)).toBe(true);
    expect(fs.existsSync(vp)).toBe(true);

    const hMeta = await sharp(hp).metadata();
    const vMeta = await sharp(vp).metadata();
    expect([hMeta.width, hMeta.height]).toEqual([300, 180]);
    // Vertical thumb renders even though only the horizontal crop was auto-seeded (auto-crop fallback).
    expect([vMeta.width, vMeta.height]).toEqual([180, 300]);
  });

  it('purge hard-deletes from the trash', async () => {
    const store = createImageStore({ galleryDir: path.join(dir, 'gallery') });
    const res = await store.save(writeTemp(await jpegBuffer(900, 600), 'p'), 'p.jpg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    store.remove(res.name);
    store.purge(res.name);
    expect(fs.existsSync(path.join(store.trashDir, res.name))).toBe(false);
    expect(store.list()).toHaveLength(0);
  });
});
