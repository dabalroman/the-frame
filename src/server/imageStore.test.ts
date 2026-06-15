import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
});
