import { describe, it, expect } from 'vitest';
import { floydSteinberg } from './dither';

// Ported alongside eink-frame's pipeline — see #185.

describe('floydSteinberg', () => {
  it('returns one 0/1 byte per pixel', () => {
    const w = 8, h = 4;
    const gray = new Uint8Array(w * h).fill(128);
    const out = floydSteinberg(gray, w, h);
    expect(out).toHaveLength(w * h);
    for (const v of out) expect(v === 0 || v === 1).toBe(true);
  });

  it('maps pure white to 1 and pure black to 0', () => {
    const white = floydSteinberg(new Uint8Array(16).fill(255), 4, 4);
    expect([...white].every(v => v === 1)).toBe(true);
    const black = floydSteinberg(new Uint8Array(16).fill(0), 4, 4);
    expect([...black].every(v => v === 0)).toBe(true);
  });

  it('dithers a mid-gray field to a mix of black and white', () => {
    const out = floydSteinberg(new Uint8Array(64).fill(128), 8, 8);
    const ones = [...out].filter(v => v === 1).length;
    expect(ones).toBeGreaterThan(0);
    expect(ones).toBeLessThan(64);
  });
});
