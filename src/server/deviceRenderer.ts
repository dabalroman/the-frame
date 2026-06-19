import sharp from 'sharp';
import QRCode from 'qrcode';
import { processForEink } from './image/process';

// Generates a 1-bit PNG of the QR code at exactly 4px per module.
// Uses the same params as gen-qr.ts so it matches the printed asset.
export async function renderQrImage(url: string, invert = false): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: 'png',
    scale: 4,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: invert
      ? { dark: '#ffffff', light: '#000000' }
      : { dark: '#000000', light: '#ffffff' },
  });
}

const MARGIN = 40;
const QR_SIZE = 128;
const FONT = 'DejaVu Sans';
const FONT_SIZE = 34;
const LINE_HEIGHT = 50;
const MAX_LINES = 8;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Renders a Polish-language events screen as a dithered 1-bit PNG.
 * Lines are pre-formatted (from formatEventLine); QR is composited in the bottom-right corner.
 */
export async function renderEventsImage(
  lines: string[],
  qrPath: string,
  width: number,
  height: number,
): Promise<Buffer> {
  const visible = lines.slice(0, MAX_LINES);

  const textRows = visible.map((line, i) => {
    const y = MARGIN + FONT_SIZE + i * LINE_HEIGHT;
    return `<text x="${MARGIN}" y="${y}" font-size="${FONT_SIZE}" font-family="${FONT}" fill="black">${esc(line)}</text>`;
  }).join('\n  ');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="white"/>
  ${textRows}
</svg>`;

  const base = await sharp(Buffer.from(svg)).png().toBuffer();

  const qrSize = Math.min(QR_SIZE, width - MARGIN, height - MARGIN);
  const qrLeft = Math.max(0, width - qrSize - MARGIN);
  const qrTop = Math.max(0, height - qrSize - MARGIN);
  const qrBuf = await sharp(qrPath).resize(qrSize, qrSize, { fit: 'contain', background: '#ffffff' }).png().toBuffer();
  const withQr = await sharp(base)
    .composite([{ input: qrBuf, left: qrLeft, top: qrTop }])
    .png()
    .toBuffer();

  return processForEink(withQr, { width, height, contrast: 1.0 });
}
