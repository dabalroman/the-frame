import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mountFrameApi } from './src/server/frameApiPlugin';
import { parseEnvInt, parseEnvFloat } from './src/server/envUtils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, 'dist');
const port = parseEnvInt(process.env.PORT, 'PORT', 7375);

const GALLERY_DIR = process.env.FRAME_GALLERY_DIR ?? path.join(__dirname, 'frame-gallery');
const CALENDAR_DB = process.env.FRAME_CALENDAR_DB ?? path.join(__dirname, 'frame-calendar.db');
const MAX_UPLOAD_BYTES = parseEnvInt(process.env.FRAME_MAX_UPLOAD_BYTES, 'FRAME_MAX_UPLOAD_BYTES', 26214400);
const DEFAULT_W = parseEnvInt(process.env.FRAME_DEFAULT_W, 'FRAME_DEFAULT_W', 800);
const DEFAULT_H = parseEnvInt(process.env.FRAME_DEFAULT_H, 'FRAME_DEFAULT_H', 480);
const DEFAULT_CONTRAST = parseEnvFloat(process.env.FRAME_DEFAULT_CONTRAST, 'FRAME_DEFAULT_CONTRAST', 1.2);


const app = express();
app.use(express.json());

mountFrameApi(app, {
  galleryDir: GALLERY_DIR,
  calendarDb: CALENDAR_DB,
  maxUploadBytes: MAX_UPLOAD_BYTES,
  defaultW: DEFAULT_W,
  defaultH: DEFAULT_H,
  defaultContrast: DEFAULT_CONTRAST,

});

app.use(express.static(dist, { index: 'index.html', maxAge: '1h' }));

// SPA fallback so deep links resolve to index.html (but never swallow /api).
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).end();
  res.sendFile(path.join(dist, 'index.html'));
});

app.listen(port, () => {
  console.log(`the-frame listening on http://localhost:${port}`);
});
