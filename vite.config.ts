import 'dotenv/config';
import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnvInt, parseEnvFloat } from './src/server/envUtils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GALLERY_DIR = process.env.FRAME_GALLERY_DIR ?? path.join(__dirname, 'frame-gallery');
const CALENDAR_DB = process.env.FRAME_CALENDAR_DB ?? path.join(__dirname, 'frame-calendar.db');
const MAX_UPLOAD_BYTES = parseEnvInt(process.env.FRAME_MAX_UPLOAD_BYTES, 'FRAME_MAX_UPLOAD_BYTES', 26214400);
const DEFAULT_W = parseEnvInt(process.env.FRAME_DEFAULT_W, 'FRAME_DEFAULT_W', 800);
const DEFAULT_H = parseEnvInt(process.env.FRAME_DEFAULT_H, 'FRAME_DEFAULT_H', 480);
const DEFAULT_CONTRAST = parseEnvFloat(process.env.FRAME_DEFAULT_CONTRAST, 'FRAME_DEFAULT_CONTRAST', 1.2);
const PORT = parseEnvInt(process.env.PORT, 'PORT', 7375);

const frameApiOptions = {
  galleryDir: GALLERY_DIR,
  calendarDb: CALENDAR_DB,
  maxUploadBytes: MAX_UPLOAD_BYTES,
  defaultW: DEFAULT_W,
  defaultH: DEFAULT_H,
  defaultContrast: DEFAULT_CONTRAST,
};

// Mount the Frame API into Vite's dev middleware so dev (HMR) and prod (server.ts)
// share one router. Mirrors random-tools' einkApiPlugin pattern.
const frameApiPlugin: PluginOption = {
  name: 'frame-api',
  configureServer(server) {
    return import('./src/server/frameApiPlugin').then(({ mountFrameApi }) => {
      mountFrameApi(server.middlewares, frameApiOptions);
    });
  },
};

export default defineConfig({
  plugins: [react(), frameApiPlugin],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: { api: 'modern-compiler' },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', 'class-variance-authority', 'clsx', 'tailwind-merge', 'lucide-react'],
          'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'vendor-misc': ['sonner'],
        },
      },
    },
  },
  // Single app on 7375: Vite HMR now, swapped to `tsx server.ts` on the same port later.
  server: { port: PORT, host: true },
  preview: { port: PORT, host: true },
});
