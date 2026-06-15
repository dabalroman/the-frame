import { describe, it, expect } from 'vitest';
import { resolveLanHost, frameUrl } from './lanHost';

describe('resolveLanHost', () => {
  it('returns the explicit override, trimmed', () => {
    expect(resolveLanHost('192.168.1.50')).toBe('192.168.1.50');
    expect(resolveLanHost('  10.0.0.4  ')).toBe('10.0.0.4');
  });

  it('throws when no host is configured', () => {
    expect(() => resolveLanHost(undefined)).toThrow(/FRAME_LAN_HOST/);
    expect(() => resolveLanHost('   ')).toThrow(/FRAME_LAN_HOST/);
  });
});

describe('frameUrl', () => {
  it('builds the http URL', () => {
    expect(frameUrl('192.168.1.50', 7375)).toBe('http://192.168.1.50:7375');
  });
});
