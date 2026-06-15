import type { Crop, Orientation } from '@/types/image';

// Pure crop / orientation geometry shared by the server (upload seeding, fetch) and the
// client (CropEditor). No node / sharp / DOM dependencies — the server imports this by
// relative path (no runtime `@/` alias), the client via `@/lib/crop`.
//
// Crop rects are normalized image coords: x,y,w,h ∈ [0,1]. An orientation's crop locks
// to a frame aspect (fw:fh). For a landscape panel W×H, horizontal uses (W,H) and
// vertical uses the swapped (H,W) — the same physical panel rotated 90°.
//
// Ported verbatim from random-tools' eink-frame (src/lib/einkCrop.ts) — see #185.

/** Natural orientation by longest edge. Square ties to horizontal (frame default). */
export function detectOrientation(w: number, h: number): Orientation {
  return w >= h ? 'horizontal' : 'vertical';
}

/** Frame aspect dims for an orientation: horizontal (fw,fh), vertical swapped (fh,fw). */
export function orientedFrame(
  orientation: Orientation,
  frameW: number,
  frameH: number,
): { fw: number; fh: number } {
  return orientation === 'vertical'
    ? { fw: frameH, fh: frameW }
    : { fw: frameW, fh: frameH };
}

/**
 * Crop height (normalized) that keeps the frame aspect for a given crop width:
 *   (w·imgW) / (h·imgH) = fw / fh  →  h = w·imgW·fh / (imgH·fw)
 */
export function aspectH(w: number, imgW: number, imgH: number, fw: number, fh: number): number {
  return (w * imgW * fh) / (imgH * fw);
}

/**
 * Auto-crop = the largest rect of aspect fw:fh that fits inside the image, centered.
 * Touches the image from inside on the constraining axis, so it fills the screen
 * edge-to-edge with no white. Matches the server's no-crop cover-resize visually.
 */
export function autoCrop(imgW: number, imgH: number, fw: number, fh: number): Crop {
  const h = aspectH(1, imgW, imgH, fw, fh);
  if (h <= 1) {
    // Frame wider than image (relative) → full width, centred vertically.
    return { x: 0, y: (1 - h) / 2, w: 1, h };
  }
  // Frame taller than image (relative) → full height, centred horizontally.
  const w = (imgH * fw) / (imgW * fh);
  return { x: (1 - w) / 2, y: 0, w, h: 1 };
}

/**
 * Clamp a crop rect to the frame aspect ratio and the legal zoom/pan range.
 *
 * Zoom-out reaches CONTAIN-fit (`maxW = max(1, K)`, K = imgH·fw / imgW·fh) — the
 * smallest frame-aspect rect that fully *contains* the image — so the rect may grow
 * past the image and its coords go outside `[0,1]` (white fills the gap). Zoom-in
 * floor is `minW = 0.1`.
 *
 * Pan obeys one invariant: the image always touches ≥2 screen edges (never white on
 * all four sides). The origin range collapses to a single symmetric formula covering
 * both regimes: `w ≤ 1` → `[0, 1-w]` (crop inside image); `w > 1` → `[1-w, 0]` (image
 * inside crop, sliding flush from one edge to the other). At contain-fit one axis is
 * exactly 1 → pinned flush → that axis covers 2 edges, so the invariant holds free.
 *
 * Re-centres on the midpoint of the INPUT rect so a clamped width stays put.
 */
export function clampCrop(c: Crop, imgW: number, imgH: number, fw: number, fh: number): Crop {
  const maxW = Math.max(1, (imgH * fw) / (imgW * fh));
  const w = Math.max(0.1, Math.min(maxW, c.w));
  const h = aspectH(w, imgW, imgH, fw, fh);
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  const xLo = Math.min(0, 1 - w), xHi = Math.max(0, 1 - w);
  const yLo = Math.min(0, 1 - h), yHi = Math.max(0, 1 - h);
  return {
    w,
    h,
    x: Math.max(xLo, Math.min(xHi, cx - w / 2)),
    y: Math.max(yLo, Math.min(yHi, cy - h / 2)),
  };
}
