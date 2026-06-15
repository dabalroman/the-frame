/**
 * Build-time QR generator. Encodes The Frame's LAN URL into a static printable
 * asset placed beside the physical frame — NOT generated at runtime in the app.
 *
 * The LAN host is configured explicitly (no network auto-detection):
 *   FRAME_LAN_HOST=192.168.1.50 npm run qr
 *   npm run qr -- 192.168.1.50      # explicit host as CLI arg
 *
 * Outputs to public/: frame-qr.png, frame-qr.svg, frame-qr.html (printable).
 */
import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { resolveLanHost, frameUrl } from '../src/server/lanHost';
import { parseEnvInt } from '../src/server/envUtils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

async function main() {
  const cliHost = process.argv[2];
  const host = resolveLanHost(cliHost ?? process.env.FRAME_LAN_HOST);
  const port = parseEnvInt(process.env.PORT, 'PORT', 7375);
  const url = frameUrl(host, port);

  fs.mkdirSync(publicDir, { recursive: true });
  const pngPath = path.join(publicDir, 'frame-qr.png');
  const svgPath = path.join(publicDir, 'frame-qr.svg');
  const htmlPath = path.join(publicDir, 'frame-qr.html');

  await QRCode.toFile(pngPath, url, { width: 720, margin: 2, errorCorrectionLevel: 'M' });
  const svg = await QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' });
  fs.writeFileSync(svgPath, svg, 'utf8');

  fs.writeFileSync(htmlPath, printableHtml(url, svg), 'utf8');

  console.log(`QR → ${url}`);
  console.log(`  ${pngPath}`);
  console.log(`  ${svgPath}`);
  console.log(`  ${htmlPath}`);
}

function printableHtml(url: string, svg: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>The Frame — Scan to open</title>
<style>
  @page { margin: 24mm; }
  body { font-family: Georgia, serif; color: #2a2018; text-align: center; padding: 48px; }
  h1 { font-size: 28px; margin: 0 0 8px; }
  p { color: #6b6256; margin: 0 0 32px; }
  .qr { width: 320px; height: 320px; margin: 0 auto; }
  .qr svg { width: 100%; height: 100%; }
  code { font-family: ui-monospace, monospace; font-size: 16px; color: #c0512e; }
</style>
</head>
<body>
  <h1>The Frame</h1>
  <p>Scan to open on your phone</p>
  <div class="qr">${svg}</div>
  <p><code>${url}</code></p>
</body>
</html>
`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
