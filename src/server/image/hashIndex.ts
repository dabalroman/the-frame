import fs from 'node:fs';
import path from 'node:path';
import { dhash, hamming, hashToHex, hexToHash } from './dhash';

/**
 * Perceptual-hash index for duplicate detection. Owns `.metadata/hashes.json`.
 *
 * Ported verbatim from random-tools' eink-frame (src/server/eink/hashIndex.ts) — see #185.
 */

export type DupeHit = { name: string; dist: number };

export type HashIndex = {
  findDuplicate: (hash: bigint, threshold?: number) => DupeHit | null;
  addEntry: (name: string, hash: bigint) => void;
  removeEntry: (name: string) => void;
  ready: Promise<void>;
};

const DEFAULT_THRESHOLD = 10;

export function createHashIndex(galleryDir: string, metaDir: string): HashIndex {
  const indexPath = path.join(metaDir, 'hashes.json');
  const map = new Map<string, bigint>();

  if (fs.existsSync(indexPath)) {
    try {
      const raw = fs.readFileSync(indexPath, 'utf8');
      const obj = JSON.parse(raw) as Record<string, string>;
      for (const [name, hex] of Object.entries(obj)) {
        map.set(name, hexToHash(hex));
      }
    } catch {
      // Corrupt index — start fresh; backfill will repopulate.
    }
  }

  function persist(): void {
    const obj: Record<string, string> = {};
    for (const [name, hash] of map) obj[name] = hashToHex(hash);
    fs.writeFileSync(indexPath, JSON.stringify(obj), 'utf8');
  }

  function findDuplicate(hash: bigint, threshold = DEFAULT_THRESHOLD): DupeHit | null {
    let best: DupeHit | null = null;
    let bestMtime = -Infinity;
    for (const [name, stored] of map) {
      const dist = hamming(hash, stored);
      if (dist > threshold) continue;
      if (best === null || dist < best.dist) {
        best = { name, dist };
        bestMtime = mtimeOf(name);
        continue;
      }
      if (dist === best.dist) {
        const m = mtimeOf(name);
        if (m > bestMtime) {
          best = { name, dist };
          bestMtime = m;
        }
      }
    }
    return best;
  }

  function mtimeOf(name: string): number {
    try { return fs.statSync(path.join(galleryDir, name)).mtimeMs; }
    catch { return 0; }
  }

  function addEntry(name: string, hash: bigint): void {
    map.set(name, hash);
    persist();
  }

  function removeEntry(name: string): void {
    if (map.delete(name)) persist();
  }

  const ready = backfill();

  async function backfill(): Promise<void> {
    let added = 0;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(galleryDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isFile()) continue;
      if (e.name.startsWith('.')) continue;
      if (map.has(e.name)) continue;
      try {
        const h = await dhash(path.join(galleryDir, e.name));
        map.set(e.name, h);
        added++;
      } catch {
        // Skip unreadable / unsupported files; they'll be re-tried on next start.
      }
    }
    if (added > 0) {
      persist();
      console.log(`[the-frame] hashIndex: backfilled ${added} file(s)`);
    }
  }

  return { findDuplicate, addEntry, removeEntry, ready };
}
