# The Frame

> Keep your loved ones close and never miss a special day — a living picture frame you fill straight from your phone.

The Frame turns an ordinary wooden picture frame into the warm heart of your home. It gently
cycles through your favourite photos and quietly remembers every birthday and anniversary, so
you never miss the moments that matter. Adding a new memory or date couldn't be easier — scan
the little code beside the frame and you're in, right from your phone. No apps to install,
nothing to fuss over.

## Under the hood

Mobile-first web app. Vite + React 18 + TypeScript + SCSS + Tailwind/shadcn, Express (via
`tsx`), SQLite (calendar) + on-disk image store. Runs as a single app on **port 7375**.

## Develop

```bash
npm install          # also registers the git pre-commit hook
npm run dev          # Vite + HMR on http://localhost:7375
```

Visit `http://localhost:7375` (or `http://<lan-ip>:7375` from a phone on the same network).

Other scripts:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest run
npm run build        # typecheck + vite build → dist/
npm run verify       # lint + typecheck + test + build (pre-commit gate)
```

## Run with pm2

```bash
pm2 start ecosystem.config.cjs   # single app `the-frame` (Vite dev) on :7375
pm2 logs the-frame
```

Later, to serve the built app in production on the same port, swap to the commented
prod block in `ecosystem.config.cjs` (`tsx server.ts`, needs `npm run build` first).

## QR code

Generate the printable LAN-URL QR (host comes from env — no auto-detection):

```bash
FRAME_LAN_HOST=192.168.1.50 npm run qr
# or: npm run qr -- 192.168.1.50
```

Outputs `public/frame-qr.png`, `frame-qr.svg`, and `frame-qr.html` (print this one).

## Configuration

Copy `.env.example` to `.env` and edit. Vars: `PORT` (7375), `FRAME_GALLERY_DIR`,
`FRAME_CALENDAR_DB`, `FRAME_LAN_HOST`.
