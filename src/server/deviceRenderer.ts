import sharp from 'sharp';
import { processForEink } from './image/process';

// Returns the QR code as a dithered 1-bit PNG at its natural square size.
export async function renderQrImage(qrPath: string): Promise<Buffer> {
  const meta = await sharp(qrPath).metadata();
  const size = meta.width ?? 720;
  const png = await sharp(qrPath).resize(size, size).png().toBuffer();
  return processForEink(png, { width: size, height: size, contrast: 1.0 });
}
