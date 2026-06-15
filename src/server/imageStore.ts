import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileTypeFromFile } from 'file-type';
import { dhash } from './image/dhash';
import { createHashIndex } from './image/hashIndex';
import { cropWithWhiteFill } from './image/process';
import { autoCrop, detectOrientation, orientedFrame } from '../lib/crop';
import type { Crop, Crops, FrameImage, Orientation } from '@/types/image';

/**
 * The Frame image store — on-disk blobs + JSON sidecar metadata (no SQL).
 *
 * Ported from random-tools' eink-frame (src/server/einkStore.ts) — see #185. Logic is
 * identical; only the names (eink → image/frame) and the warm-app branding differ.
 *
 * Layout under `galleryDir`:
 *   <uuid>.jpg            image blobs
 *   .metadata/<stem>.json sidecar metadata ({ width, height, crops })
 *   .thumbs/              cached 300×180 thumbnails
 *   .trash/               soft-deleted blobs
 */

// Keep memory bounded under concurrent uploads — Sharp's libvips operation cache
// would otherwise hold decoded buffers indefinitely.
sharp.cache(false);
sharp.concurrency(1);

const MAX_INPUT_DIM = 12000;

// `crop` is the legacy single-crop field; read-only back-compat (→ crops.horizontal).
type SidecarMeta = { crop?: Crop; crops?: Crops; width?: number; height?: number };

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif']);
const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
]);
// SVG is explicitly excluded even if sniffed as image (XSS risk)
const BLOCKED_MIMES = new Set(['image/svg+xml']);

export type SaveResult =
  | { ok: true; name: string }
  | { ok: false; duplicate: true; matchedName: string; status: 409 }
  | { ok: false; error: string; status: number };

export type SaveOptions = { force?: boolean };

export type ImageStoreOptions = {
  galleryDir: string;
  maxUploadBytes?: number;
  defaultW?: number;
  defaultH?: number;
};

export function createImageStore({ galleryDir, defaultW = 800, defaultH = 480 }: ImageStoreOptions) {
  fs.mkdirSync(galleryDir, { recursive: true });
  const trashDir = path.join(galleryDir, '.trash');
  const thumbsDir = path.join(galleryDir, '.thumbs');
  const metaDir = path.join(galleryDir, '.metadata');
  fs.mkdirSync(trashDir, { recursive: true });
  fs.mkdirSync(thumbsDir, { recursive: true });
  fs.mkdirSync(metaDir, { recursive: true });

  const hashIndex = createHashIndex(galleryDir, metaDir);

  // Compute the auto-crop for an orientation given source dims, locked to the panel aspect.
  function autoCropFor(o: Orientation, srcW: number, srcH: number): Crop {
    const { fw, fh } = orientedFrame(o, defaultW, defaultH);
    return autoCrop(srcW, srcH, fw, fh);
  }

  function metaPath(name: string): string {
    return path.join(metaDir, `${path.basename(name, path.extname(name))}.json`);
  }

  function readMeta(name: string): SidecarMeta {
    try {
      const raw = fs.readFileSync(metaPath(name), 'utf8');
      return JSON.parse(raw) as SidecarMeta;
    } catch {
      return {};
    }
  }

  function writeMeta(name: string, meta: SidecarMeta): void {
    const mp = metaPath(name);
    const hasCrops = meta.crops !== undefined && (meta.crops.horizontal !== undefined || meta.crops.vertical !== undefined);
    const hasData = meta.crop !== undefined || hasCrops || (meta.width !== undefined && meta.height !== undefined);
    if (!hasData) {
      fs.rmSync(mp, { force: true });
    } else {
      fs.writeFileSync(mp, JSON.stringify(meta), 'utf8');
    }
  }

  // Read crops with lazy back-compat: an old single `crop` reads as crops.horizontal.
  function readCrops(name: string): Crops {
    const m = readMeta(name);
    if (m.crops) return m.crops;
    if (m.crop) return { horizontal: m.crop };
    return {};
  }

  function readCropFor(name: string, o: Orientation): Crop | undefined {
    return readCrops(name)[o];
  }

  // Set (crop) or clear (null) one orientation's crop, normalising the sidecar to the
  // new `crops` shape (drops the legacy `crop` field on write).
  function writeCrop(name: string, o: Orientation, crop: Crop | null): void {
    const current = readMeta(name);
    const next: Crops = { ...readCrops(name) };
    if (crop === null) delete next[o];
    else next[o] = crop;
    const crops = (next.horizontal || next.vertical) ? next : undefined;
    writeMeta(name, { width: current.width, height: current.height, ...(crops ? { crops } : {}) });
    invalidateThumb(name);
  }

  function list(): FrameImage[] {
    return fs.readdirSync(galleryDir, { withFileTypes: true })
      .filter(e => e.isFile() && ALLOWED_EXTS.has(path.extname(e.name).toLowerCase()))
      .map(e => {
        const stat = fs.statSync(path.join(galleryDir, e.name));
        return { name: e.name, size: stat.size, mtime: stat.mtimeMs, crops: readCrops(e.name) };
      })
      .sort((a, b) => b.mtime - a.mtime);
  }

  async function save(tempPath: string, originalName: string, opts: SaveOptions = {}): Promise<SaveResult> {
    try {
      const ft = await fileTypeFromFile(tempPath);

      if (!ft || BLOCKED_MIMES.has(ft.mime) || !ALLOWED_MIMES.has(ft.mime)) {
        fs.rmSync(tempPath, { force: true });
        return { ok: false, error: 'Unsupported file type', status: 415 };
      }

      const meta = await sharp(tempPath).metadata();
      if ((meta.width ?? 0) > MAX_INPUT_DIM || (meta.height ?? 0) > MAX_INPUT_DIM) {
        fs.rmSync(tempPath, { force: true });
        return { ok: false, error: `Image dimensions exceed ${MAX_INPUT_DIM}×${MAX_INPUT_DIM}`, status: 413 };
      }

      const incomingHash = await dhash(tempPath);
      if (!opts.force) {
        await hashIndex.ready;
        const hit = hashIndex.findDuplicate(incomingHash);
        if (hit) {
          fs.rmSync(tempPath, { force: true });
          return { ok: false, duplicate: true, matchedName: hit.name, status: 409 };
        }
      }

      const targetExt = ft.mime === 'image/webp' ? '.webp' : '.jpg';
      const finalName = `${crypto.randomUUID()}${targetExt}`;
      const destPath = path.join(galleryDir, finalName);

      const dims = await resizeAndSave(tempPath, destPath, ft.mime);
      fs.rmSync(tempPath, { force: true });
      // Seed the auto-crop in the image's natural (longest-edge) orientation, so a fresh
      // upload is immediately available in that orientation; the other slot stays empty.
      const o = detectOrientation(dims.width, dims.height);
      const crops: Crops = {};
      crops[o] = autoCropFor(o, dims.width, dims.height);
      writeMeta(finalName, { ...dims, crops });
      hashIndex.addEntry(finalName, incomingHash);

      return { ok: true, name: finalName };
    } catch (err) {
      fs.rmSync(tempPath, { force: true });
      throw err;
    }
  }

  function remove(name: string): void {
    const src = resolveSafe(galleryDir, name);
    const dest = path.join(trashDir, path.basename(name));
    fs.renameSync(src, dest);
    hashIndex.removeEntry(name);
  }

  async function restore(name: string): Promise<void> {
    const dest = resolveSafe(galleryDir, name, false);
    const src = resolveTrashSafe(trashDir, name);
    if (!fs.existsSync(src)) throw Object.assign(new Error('Not in trash'), { status: 404 });
    fs.renameSync(src, dest);
    try {
      hashIndex.addEntry(name, await dhash(dest));
    } catch {
      // Index will recover on next backfill.
    }
  }

  function purge(name: string): void {
    const src = resolveTrashSafe(trashDir, name);
    fs.rmSync(src, { force: true });
    fs.rmSync(metaPath(name), { force: true });
  }

  // Strict: an image is only eligible for an orientation if it has a crop there. Images
  // with no crop for the requested orientation (or none at all) are simply ignored.
  function randomImagePath(orientation: Orientation = 'horizontal'): string | null {
    const images = list().filter(i => i.crops?.[orientation]);
    if (images.length === 0) return null;
    const idx = Math.floor(Math.random() * images.length);
    return path.join(galleryDir, images[idx]!.name);
  }

  function getImagePath(name: string): string {
    return resolveSafe(galleryDir, name);
  }

  // Per-orientation thumbnail: 300×180 (horizontal) or 180×300 (vertical). Uses the saved
  // crop for that orientation, or the auto-crop (cover) as a fallback — so every image has a
  // preview in BOTH orientations even before a crop is saved there. Cached one file per
  // orientation (`<stem>.<orientation>.jpg`).
  async function getThumbPath(name: string, orientation: Orientation = 'horizontal'): Promise<string> {
    const srcPath = resolveSafe(galleryDir, name);
    const stem = path.basename(name, path.extname(name));
    const thumbPath = path.join(thumbsDir, `${stem}.${orientation}.jpg`);
    if (!fs.existsSync(thumbPath)) {
      const meta = readMeta(name);
      let sw = meta.width;
      let sh = meta.height;
      if (sw === undefined || sh === undefined) {
        const sharpMeta = await sharp(srcPath).rotate().metadata();
        sw = sharpMeta.width ?? 1;
        sh = sharpMeta.height ?? 1;
      }
      // Saved crop, or the auto-crop seed for this orientation. Oversize-safe crop + white-fill
      // (#184): a raw extract would throw on out-of-[0,1] crops.
      const crop = readCropFor(name, orientation) ?? autoCropFor(orientation, sw, sh);
      const pipeline = await cropWithWhiteFill(sharp(srcPath).rotate(), crop, sw, sh);
      const [tw, th] = orientation === 'vertical' ? [180, 300] : [300, 180];
      await pipeline
        .resize(tw, th, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 75 })
        .toFile(thumbPath);
    }
    return thumbPath;
  }

  // Invalidate BOTH cached orientation thumbs when a file's crop changes / it's removed.
  function invalidateThumb(name: string): void {
    const stem = path.basename(name, path.extname(name));
    fs.rmSync(path.join(thumbsDir, `${stem}.horizontal.jpg`), { force: true });
    fs.rmSync(path.join(thumbsDir, `${stem}.vertical.jpg`), { force: true });
  }

  function removeWithThumb(name: string): void {
    remove(name);
    invalidateThumb(name);
  }

  return {
    galleryDir, metaDir, thumbsDir, trashDir,
    list, save, remove: removeWithThumb, restore, purge,
    randomImagePath, getImagePath, getThumbPath,
    readMeta, readCrops, readCropFor, writeCrop,
  };
}

export type ImageStore = ReturnType<typeof createImageStore>;

// ── helpers ──────────────────────────────────────────────────────────────────

const MAX_DIM = 4096;

async function resizeAndSave(tempPath: string, destPath: string, mime: string): Promise<{ width: number; height: number }> {
  const pipeline = sharp(tempPath).rotate().resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true });

  let info: sharp.OutputInfo;
  if (mime === 'image/webp') {
    info = await pipeline.webp({ quality: 85 }).toFile(destPath);
  } else {
    // JPEG, PNG, HEIC, GIF, and anything else all go to JPEG
    info = await pipeline.jpeg({ quality: 90 }).toFile(destPath);
  }
  return { width: info.width, height: info.height };
}

function resolveSafe(dir: string, name: string, mustExist = true): string {
  const resolved = path.resolve(dir, name);
  if (path.dirname(resolved) !== path.resolve(dir)) {
    throw Object.assign(new Error('Invalid filename'), { status: 400 });
  }
  if (mustExist && !fs.existsSync(resolved)) {
    throw Object.assign(new Error('Not found'), { status: 404 });
  }
  return resolved;
}

function resolveTrashSafe(trashDir: string, name: string): string {
  const resolved = path.resolve(trashDir, name);
  if (path.dirname(resolved) !== path.resolve(trashDir)) {
    throw Object.assign(new Error('Invalid filename'), { status: 400 });
  }
  return resolved;
}
