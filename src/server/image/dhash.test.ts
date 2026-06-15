import { describe, it, expect } from 'vitest';
import { hamming, hashToHex, hexToHash } from './dhash';

// dhash() itself decodes an image via sharp; here we cover the pure helpers that the
// dedupe index relies on. (Ported alongside eink-frame's pipeline — see #185.)

describe('hamming', () => {
  it('is 0 for identical hashes', () => {
    expect(hamming(0xabcdef1234567890n, 0xabcdef1234567890n)).toBe(0);
  });
  it('counts differing bits', () => {
    expect(hamming(0b0000n, 0b1011n)).toBe(3);
    expect(hamming(0n, 0xffffffffffffffffn)).toBe(64);
  });
});

describe('hashToHex / hexToHash', () => {
  it('round-trips a 64-bit value, zero-padded to 16 hex chars', () => {
    const h = 0x00000000000000ffn;
    const hex = hashToHex(h);
    expect(hex).toHaveLength(16);
    expect(hex).toBe('00000000000000ff');
    expect(hexToHash(hex)).toBe(h);
  });
  it('round-trips a full-width value', () => {
    const h = 0xdeadbeefcafef00dn;
    expect(hexToHash(hashToHex(h))).toBe(h);
  });
});
