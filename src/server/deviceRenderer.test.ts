import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { renderQrImage, renderEventsImage } from './deviceRenderer';

let tmpDir: string;
let qrPath: string;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'device-renderer-test-'));
  qrPath = path.join(tmpDir, 'qr.png');
  // Create a minimal 10×10 white PNG as a stand-in for the QR image
  await sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .png()
    .toFile(qrPath);
});

afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

describe('renderEventsImage', () => {
  it('returns a 1-bit PNG at the requested dimensions', async () => {
    const buf = await renderEventsImage(['★ Martha — dziś', '• Rocznica — sob. 21 cze.'], qrPath, 400, 200);
    expect(buf).toBeInstanceOf(Buffer);
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(200);
  });

  it('handles an empty lines array without throwing', async () => {
    const buf = await renderEventsImage([], qrPath, 400, 200);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('handles Polish diacritics in event titles', async () => {
    const lines = ['★ Łódź — dziś', '• Ćwiczenia — śr. 18 cze.'];
    const buf = await renderEventsImage(lines, qrPath, 400, 200);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });
});

describe('renderQrImage', () => {
  it('returns a non-empty PNG buffer', async () => {
    const buf = await renderQrImage(qrPath);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('output is square (natural QR dimensions)', async () => {
    const buf = await renderQrImage(qrPath);
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(meta.height);
  });
});
