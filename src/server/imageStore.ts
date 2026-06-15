import fs from 'node:fs';
import path from 'node:path';
import type { Crops, FrameImage, SidecarMeta } from '@/types/image';

/**
 * The Frame image store — on-disk blobs + JSON sidecar metadata (no SQL).
 *
 * Scaffold scope (#183): establishes the directory convention and the sidecar
 * read path. The upload / crop / thumbnail / dedupe pipeline is ported from
 * eink-frame in #185 — do not add it here.
 *
 * Layout under `galleryDir`:
 *   <uuid>.jpg            image blobs
 *   .metadata/<stem>.json sidecar metadata ({ width, height, crops })
 *   .thumbs/              cached thumbnails (populated by #185)
 *   .trash/               soft-deleted blobs (populated by #185)
 */

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif']);

export type ImageStoreOptions = { galleryDir: string };

export function createImageStore({ galleryDir }: ImageStoreOptions) {
  fs.mkdirSync(galleryDir, { recursive: true });
  const metaDir = path.join(galleryDir, '.metadata');
  const thumbsDir = path.join(galleryDir, '.thumbs');
  const trashDir = path.join(galleryDir, '.trash');
  fs.mkdirSync(metaDir, { recursive: true });
  fs.mkdirSync(thumbsDir, { recursive: true });
  fs.mkdirSync(trashDir, { recursive: true });

  function metaPath(name: string): string {
    return path.join(metaDir, `${path.basename(name, path.extname(name))}.json`);
  }

  function readMeta(name: string): SidecarMeta {
    try {
      return JSON.parse(fs.readFileSync(metaPath(name), 'utf8')) as SidecarMeta;
    } catch {
      return {};
    }
  }

  function readCrops(name: string): Crops {
    return readMeta(name).crops ?? {};
  }

  function list(): FrameImage[] {
    return fs
      .readdirSync(galleryDir, { withFileTypes: true })
      .filter((e) => e.isFile() && ALLOWED_EXTS.has(path.extname(e.name).toLowerCase()))
      .map((e) => {
        const stat = fs.statSync(path.join(galleryDir, e.name));
        return { name: e.name, size: stat.size, mtime: stat.mtimeMs, crops: readCrops(e.name) };
      })
      .sort((a, b) => b.mtime - a.mtime);
  }

  return { galleryDir, metaDir, thumbsDir, trashDir, list, readMeta, readCrops };
}

export type ImageStore = ReturnType<typeof createImageStore>;
