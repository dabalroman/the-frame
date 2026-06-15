/**
 * Floyd-Steinberg error-diffusion dithering over an 8-bit grayscale buffer.
 * Returns a Uint8Array where each byte is 0 (black) or 1 (white).
 *
 * Ported verbatim from random-tools' eink-frame (src/server/eink/dither.ts) — see #185.
 */
export function floydSteinberg(
  gray: Buffer | Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const n = width * height;
  const work = new Int16Array(n);
  for (let i = 0; i < n; i++) work[i] = gray[i]!;

  const out = new Uint8Array(n);

  const diffuse = (idx: number, delta: number): void => {
    const v = work[idx]! + delta;
    work[idx] = v < -32768 ? -32768 : v > 32767 ? 32767 : v;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const old = work[i]!;
      const nw = old < 128 ? 0 : 255;
      out[i] = nw === 255 ? 1 : 0;
      const err = old - nw;

      // Round-to-nearest integer division by 16: (err * k + 8) >> 4 for err >= 0;
      // for negative err the +8 bias still gives correct round-to-nearest within ±1.
      if (x + 1 < width)
        diffuse(i + 1, (err * 7 + 8) >> 4);
      if (y + 1 < height) {
        if (x > 0) diffuse(i + width - 1, (err * 3 + 8) >> 4);
        diffuse(i + width, (err * 5 + 8) >> 4);
        if (x + 1 < width) diffuse(i + width + 1, (err + 8) >> 4);
      }
    }
  }

  return out;
}
