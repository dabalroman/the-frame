// Runs before every test file. Redirects file-path env vars to fresh temp dirs
// so no test can read or write real user data (gallery, calendar DB).
// Tests needing their own FS state should create dirs via os.tmpdir().
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach } from 'vitest';

let tmpDir = '';

function createDirs() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'the-frame-test-'));
  process.env.FRAME_GALLERY_DIR = path.join(tmpDir, 'gallery');
  process.env.FRAME_CALENDAR_DB = path.join(tmpDir, 'calendar.db');
}

createDirs(); // initial assignment so module-load imports see valid paths

beforeEach(() => {
  createDirs();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
