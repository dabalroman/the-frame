import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mountFrameApi } from './src/server/frameApiPlugin';
import { parseEnvInt } from './src/server/envUtils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, 'dist');
const port = parseEnvInt(process.env.PORT, 'PORT', 7375);

const GALLERY_DIR = process.env.FRAME_GALLERY_DIR ?? path.join(__dirname, 'frame-gallery');
const CALENDAR_DB = process.env.FRAME_CALENDAR_DB ?? path.join(__dirname, 'frame-calendar.db');

const app = express();
app.use(express.json());

mountFrameApi(app, { galleryDir: GALLERY_DIR, calendarDb: CALENDAR_DB });

app.use(express.static(dist, { index: 'index.html', maxAge: '1h' }));

// SPA fallback so deep links resolve to index.html (but never swallow /api).
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).end();
  res.sendFile(path.join(dist, 'index.html'));
});

app.listen(port, () => {
  console.log(`the-frame listening on http://localhost:${port}`);
});
