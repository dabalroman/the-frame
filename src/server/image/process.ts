import sharp from 'sharp';
import { floydSteinberg } from './dither';
import type { Crop } from '@/types/image';

/**
 * E-ink image pipeline + oversize-crop white fill.
 *
 * Ported verbatim from random-tools' eink-frame (src/server/eink/process.ts) — see #185.
 */

export interface ProcessOptions {
  width?: number;
  height?: number;
  contrast?: number;
  invert?: boolean;
  crop?: Crop;
  srcWidth?: number;
  srcHeight?: number;
}

/**
 * Apply a (possibly oversize, #184) crop to an already-rotated pipeline, filling regions of the
 * crop rect that fall outside the image with pure white. Returns a pipeline ready for a
 * subsequent resize. `sw`/`sh` are the rotated source dims.
 *
 * Oversize crops have coords outside [0,1], so a raw `extract` throws — instead we extract the
 * in-image intersection and `extend` the missing margins with white. The extend is materialised
 * into its own buffer because sharp applies `extend` AFTER `resize` within a single pipeline
 * (fixed internal op order); a second sharp() forces the white fill to land before the caller's
 * resize. White enters in RGB, so it survives grayscale → normalise → linear → dither as 255.
 */
export async function cropWithWhiteFill(
  base: sharp.Sharp,
  crop: Crop,
  sw: number,
  sh: number,
): Promise<sharp.Sharp> {
  const L = crop.x * sw, T = crop.y * sh, W = crop.w * sw, H = crop.h * sh;
  const ix0 = Math.min(sw - 1, Math.max(0, Math.round(L)));
  const iy0 = Math.min(sh - 1, Math.max(0, Math.round(T)));
  const ix1 = Math.max(ix0 + 1, Math.min(sw, Math.round(L + W)));
  const iy1 = Math.max(iy0 + 1, Math.min(sh, Math.round(T + H)));
  let pipeline = base.extract({ left: ix0, top: iy0, width: ix1 - ix0, height: iy1 - iy0 });

  const ext = {
    left:   Math.max(0, Math.round(-L)),
    top:    Math.max(0, Math.round(-T)),
    right:  Math.max(0, Math.round(L + W - sw)),
    bottom: Math.max(0, Math.round(T + H - sh)),
  };
  if (ext.left || ext.top || ext.right || ext.bottom) {
    const { data, info } = await pipeline
      .extend({ ...ext, background: { r: 255, g: 255, b: 255 } })
      .raw()
      .toBuffer({ resolveWithObject: true });
    pipeline = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  }
  return pipeline;
}

/**
 * E-ink pipeline:
 *   EXIF rotate → cover resize → grayscale → normalise → contrast scale → [invert] → FS dither → PNG
 *
 * Order rationale: normalise first stretches the histogram to a known 0-255 baseline so that
 * linear(contrast, 0) clips a predictable fraction of tones to white/black.
 * Reversed order (linear then normalise) caused normalise to undo the scaling on most images,
 * making the contrast knob have no visible effect.
 * contrast=1.0 → autolevels only; contrast=1.3 → clips top ~23 % of tones to white.
 */
export async function processForEink(
  input: Buffer | string,
  opts: ProcessOptions = {},
): Promise<Buffer> {
  const { width = 800, height = 480, contrast = 1.3, invert = false, crop, srcWidth, srcHeight } = opts;

  let pipeline = sharp(input).rotate();

  if (crop) {
    let sw = srcWidth;
    let sh = srcHeight;
    if (sw === undefined || sh === undefined) {
      const meta = await sharp(input).rotate().metadata();
      sw = meta.width ?? 1;
      sh = meta.height ?? 1;
    }
    pipeline = await cropWithWhiteFill(pipeline, crop, sw, sh);
  }

  pipeline = pipeline
    .resize(width, height, { fit: 'cover', position: 'center' })
    .grayscale()
    .normalise()                                                  // stretch histogram to 0-255 baseline
    .linear(contrast, 0);                                         // clip tones by contrast factor (1.0 = no clip)

  if (invert) pipeline = pipeline.negate({ alpha: false });

  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });

  const dithered = floydSteinberg(data, info.width, info.height);

  // Map 0/1 back to 0/255 for PNG output
  const gray255 = Buffer.allocUnsafe(dithered.length);
  for (let i = 0; i < dithered.length; i++) gray255[i] = dithered[i]! * 255;

  return sharp(gray255, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .png({ compressionLevel: 9, palette: true, colours: 2, dither: 0 })
    .toBuffer();
}
