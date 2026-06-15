import { describe, it, expect } from 'vitest';
import { detectOrientation, orientedFrame, aspectH, autoCrop, clampCrop } from './crop';

// Ported from random-tools' eink-frame (src/lib/einkCrop.test.ts) — see #185.

describe('detectOrientation', () => {
  it('landscape → horizontal', () => {
    expect(detectOrientation(1920, 1080)).toBe('horizontal');
  });
  it('portrait → vertical', () => {
    expect(detectOrientation(1080, 1920)).toBe('vertical');
  });
  it('square → horizontal (tiebreak)', () => {
    expect(detectOrientation(500, 500)).toBe('horizontal');
  });
});

describe('orientedFrame', () => {
  it('horizontal keeps frame dims', () => {
    expect(orientedFrame('horizontal', 800, 480)).toEqual({ fw: 800, fh: 480 });
  });
  it('vertical swaps frame dims', () => {
    expect(orientedFrame('vertical', 800, 480)).toEqual({ fw: 480, fh: 800 });
  });
});

describe('autoCrop', () => {
  it('frame wider than image → full width, centred vertically', () => {
    const c = autoCrop(1000, 1000, 800, 480);
    expect(c.x).toBe(0);
    expect(c.w).toBe(1);
    expect(c.h).toBeCloseTo(0.6, 5); // 480/800
    expect(c.y).toBeCloseTo(0.2, 5); // (1 - 0.6) / 2
  });

  it('frame taller than image → full height, centred horizontally', () => {
    const c = autoCrop(1000, 1000, 480, 800);
    expect(c.y).toBe(0);
    expect(c.h).toBe(1);
    expect(c.w).toBeCloseTo(0.6, 5);
    expect(c.x).toBeCloseTo(0.2, 5);
  });

  it('matching aspect → full image', () => {
    const c = autoCrop(800, 480, 800, 480);
    expect(c).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('stays within image bounds in both cases', () => {
    for (const [iw, ih] of [[1600, 900], [900, 1600], [1000, 1000]] as const) {
      for (const [fw, fh] of [[800, 480], [480, 800]] as const) {
        const c = autoCrop(iw, ih, fw, fh);
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.x + c.w).toBeLessThanOrEqual(1.0001);
        expect(c.y + c.h).toBeLessThanOrEqual(1.0001);
        expect((c.w * iw) / (c.h * ih)).toBeCloseTo(fw / fh, 4);
      }
    }
  });
});

describe('aspectH', () => {
  it('derives crop height preserving frame aspect', () => {
    expect(aspectH(1, 1000, 1000, 800, 480)).toBeCloseTo(0.6, 5);
  });
});

describe('clampCrop', () => {
  // square image, landscape 800:480 frame → K = imgH·fw / imgW·fh = 800/480 ≈ 1.667.
  // Cover-fit width = min(1,K) = 1; contain-fit width = max(1,K) = K (the zoom-out max).
  const K = 800 / 480;

  it('clamps zoom-out at contain-fit (max(1,K)), not cover-fit, preserving aspect', () => {
    const c = clampCrop({ x: -0.5, y: 0, w: 2, h: 2 }, 1000, 1000, 800, 480);
    expect(c.w).toBeCloseTo(K, 5);
    expect(c.h).toBeCloseTo(1, 5);
    expect((c.w * 1000) / (c.h * 1000)).toBeCloseTo(800 / 480, 4);
  });

  it('lets oversize crop coords go outside [0,1]', () => {
    const c = clampCrop({ x: -0.5, y: 0, w: 2, h: 2 }, 1000, 1000, 800, 480);
    expect(c.x).toBeLessThan(0);
    expect(c.x).toBeGreaterThanOrEqual(1 - c.w - 1e-9);
  });

  it('pins the covered axis flush so the image touches 2 edges at contain-fit', () => {
    const c = clampCrop({ x: 0.3, y: 0.9, w: K, h: 1 }, 1000, 1000, 800, 480);
    expect(c.y).toBeCloseTo(0, 6);
    expect(c.y + c.h).toBeCloseTo(1, 6);
  });

  it('edge-flush pan on the white axis: image slides between flush-left and flush-right (w>1)', () => {
    const right = clampCrop({ x: 9, y: 0, w: K, h: 1 }, 1000, 1000, 800, 480);
    expect(right.x).toBeCloseTo(0, 6);
    const left = clampCrop({ x: -9, y: 0, w: K, h: 1 }, 1000, 1000, 800, 480);
    expect(left.x).toBeCloseTo(1 - K, 6);
    expect(left.x).toBeLessThan(0);
  });

  it('never allows white on all four sides (≥2-edge invariant) across the zoom range', () => {
    const dims = [[1600, 900], [900, 1600], [1000, 1000], [200, 2000]] as const;
    const frames = [[800, 480], [480, 800]] as const;
    const E = 1e-6;
    for (const [iw, ih] of dims) {
      for (const [fw, fh] of frames) {
        for (const w of [0.1, 0.5, 1, 1.4, 50]) {
          const c = clampCrop({ x: 0.4, y: 0.4, w, h: w }, iw, ih, fw, fh);
          const xCovers = c.w <= 1 + E && c.x >= -E && c.x + c.w <= 1 + E;
          const yCovers = c.h <= 1 + E && c.y >= -E && c.y + c.h <= 1 + E;
          expect(xCovers || yCovers).toBe(true);
        }
      }
    }
  });

  it('enforces a minimum width of 0.1', () => {
    const c = clampCrop({ x: 0.4, y: 0.4, w: 0.001, h: 0.001 }, 1000, 1000, 800, 480);
    expect(c.w).toBeGreaterThanOrEqual(0.1);
  });
});
