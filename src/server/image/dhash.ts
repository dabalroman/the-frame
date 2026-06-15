import sharp from 'sharp';

/**
 * 64-bit perceptual hash (dHash, horizontal gradient).
 * Downsizes to 9×8 grayscale, then encodes whether each pixel is brighter than its right neighbour.
 * `.rotate()` matches the upload pipeline's EXIF orientation handling so incoming-vs-stored hashes line up.
 *
 * Ported verbatim from random-tools' eink-frame (src/server/eink/dhash.ts) — see #185.
 */
export async function dhash(file: string): Promise<bigint> {
  const buf = await sharp(file)
    .rotate()
    .greyscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer();

  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits = (bits << 1n) | (buf[y * 9 + x]! > buf[y * 9 + x + 1]! ? 1n : 0n);
    }
  }
  return bits;
}

export function hamming(a: bigint, b: bigint): number {
  let n = a ^ b;
  let c = 0;
  while (n) {
    c += Number(n & 1n);
    n >>= 1n;
  }
  return c;
}

export function hashToHex(hash: bigint): string {
  return hash.toString(16).padStart(16, '0');
}

export function hexToHash(hex: string): bigint {
  return BigInt('0x' + hex);
}
