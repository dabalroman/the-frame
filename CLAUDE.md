# CLAUDE.md — The Frame

Guidance for Claude Code when working in this repository.

## What this is

**The Frame** is a standalone, cozy, light-mode photo-gallery + custom-calendar app for a
physical wooden picture frame. A phone opens it by scanning a printed QR placed beside the
frame; an e-ink device (separate project) fetches photos + an events screen hourly.

This is its **own git repo**, deliberately **separate** from `random-tools` and the existing
`eink-frame` tool — no shared package, no shared data. The image pipeline is **copied/ported**
from eink-frame (in task #185), not imported.

Tasks for this project are tracked in **random-tools' `tasks.db`** under scope `the-frame`
(epic #181). There is no task-manager MCP in this repo.

## Design system — intentional exception

The Frame **opts OUT of random-tools' dark/terminal universal style rules** on purpose. It has
its own **warm, comfy, light** visual language ("sunlit linen"): warm cream surfaces, espresso
ink, a soft terracotta accent + calm sage secondary, warm-tinted (not gray) shadows, generous
16px rounding, `Fraunces` (display) + `Nunito` (body) fonts. Aesthetic produced via the
`frontend-design` skill — keep new UI consistent with it.

- Tokens are HSL CSS variables in `src/styles.scss` (`:root`); `tailwind.config.js` consumes
  them. **To restyle, edit the variables, not the components.**
- Tailwind scale here is **rem-based and relaxed** — tuned for a native mobile feel. It is NOT
  random-tools' `em`/4px-grid contract; don't import those rules.
- Components use Tailwind + local shadcn primitives in `src/components/ui/` (Button, Card,
  Input, Sonner). Buttons are rounded-full and tactile (`active:scale`); cards are `rounded-2xl`
  with `shadow-card`. Colors via semantic tokens only (`bg-card`, `text-primary`, …).
- Mobile-first; design for 360px width up.

## Stack & runtime

- Vite + React 18 + react-router-dom, TypeScript (strict + `noUncheckedIndexedAccess`), SCSS,
  Tailwind + shadcn/ui, Express via `tsx` (no server build step), vitest, ESLint 9 flat config.
- **Single pm2 app `the-frame` on port 7375.** During build-out it runs **dev (Vite HMR)**;
  later it swaps to **prod (`tsx server.ts`)** on the **same** port — no dev/prod port split
  (unlike random-tools' 5174/7373). The prod swap is the commented block in
  `ecosystem.config.cjs` and needs `npm run build` first.
- `npm run verify` (lint + typecheck + test + build) is the pre-commit gate, wired via
  `simple-git-hooks` on `npm install`. Bypass with `SKIP_SIMPLE_GIT_HOOKS=1` (don't habituate).
- Path alias `@/` → `src/` (vite.config.ts, tsconfig.json, vitest.config.ts).

## API — one router, two mounts

`src/server/frameApi.ts` builds the API (`createFrameApi`) and `src/server/frameApiPlugin.ts`
mounts it under `/api` on any connect/express stack. **Both** the Vite dev plugin
(`vite.config.ts`) and the prod server (`server.ts`) call `mountFrameApi`, so dev and prod
share one router. The SPA fallback in `server.ts` 404s `/api/*` so it never swallows API paths.

`frameApiPlugin.ts` dispatches by `pathname`/method (ported from eink-frame's `einkRouter`):
`health` is matched first, everything else delegates to the image handlers. Calendar (#186)
endpoints hang off the same factory.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | `{ ok, version, gallery, calendar }` |
| GET | `/api/config` | `{ width, height }` (panel defaults) |
| GET | `/api/images` | list (name, size, mtime, crops), newest first |
| POST | `/api/images[?force=1]` | multipart upload; 207 per-file results; `force` bypasses dedupe |
| GET/DELETE | `/api/images/:name` | serve original / soft-delete to trash |
| GET | `/api/images/:name/thumb?orientation=` | per-orientation thumb (300×180 / 180×300) |
| GET/PUT/DELETE | `/api/images/:name/crop?orientation=` | get/set/clear one orientation's crop |
| POST | `/api/images/:name/restore` | restore from trash (async, re-hashes) |
| DELETE | `/api/trash/:name` | hard-delete |
| GET | `/api/photo?orientation=&w=&h=` | **device path** — random orientation-filtered 1-bit PNG |
| GET | `/api/photo/:name?orientation=` | named 1-bit PNG (crop-editor preview) |

**Why `/photo` (not eink's bare `/:name` catch-all):** the shared `/api` namespace also carries
`/health` and will carry calendar routes (#186), so the device path is explicitly prefixed to
avoid shadowing them. The `/photo` endpoints keep **strict** per-orientation availability (404
when the image has no crop for the requested orientation — no cross-orientation fallback); this
is intentionally stricter than the gallery thumbnails (see Gallery below).

## Storage

Two **separate, independent** stores, both starting empty:

- **Images** — on-disk blobs + **JSON sidecar metadata** (no SQL), `src/server/imageStore.ts`.
  Layout under `FRAME_GALLERY_DIR`: `<uuid>.jpg` blobs, `.metadata/<stem>.json` sidecars
  (`{ width, height, crops: { horizontal?, vertical? } }`) + `.metadata/hashes.json` (dHash
  index), `.thumbs/<stem>.<orientation>.jpg`, `.trash/`. The full upload/crop/thumb/dedupe
  pipeline (ported from eink-frame in **#185**) lives here — see **Gallery** below.
- **Calendar** — **SQLite** (better-sqlite3), `src/server/calendarDb.ts`, file at
  `FRAME_CALENDAR_DB`. **`journal_mode = DELETE`** (not WAL — WAL's mmap'd shm isn't coherent
  across bind mounts). Migrations live in `src/server/migrations/` as
  `YYYYMMDDHHMMSS_slug.ts` exporting `name` (must equal the filename stem) + `up(db)`. The
  runner records applied names in `schema_migrations` (idempotent, with a downgrade guard) and
  keeps `PRAGMA user_version` in sync. **The folder is empty in the scaffold** — opening the DB
  only creates `schema_migrations`. The events table is **#186**'s first migration.
  - Server runs via `tsx`, never compiled, so `.ts` migrations are loaded at runtime via
    `createRequire`. Test the runner by passing a `Migration[]` to `runMigrations` directly
    (see `calendarDb.test.ts`) rather than relying on filesystem loading.

## Gallery (#185 — ported from eink-frame)

The image half is a **copy/port** of random-tools' eink-frame (no shared package). Backend logic
is near-verbatim; only names (`eink`→`image`), the `/api` prefix, and the warm UI differ. When
fixing a pipeline bug, check whether eink-frame has the same bug. The reverse port (this feature
back to eink-frame) is tracked as **#189**.

- **Pipeline** (`src/server/image/`): `dither` (Floyd-Steinberg, `Int16Array` — keep it),
  `process` (`processForEink`: rotate→cover-resize→grayscale→**normalise before linear**→dither→
  2-colour PNG; `cropWithWhiteFill` for oversize crops), `dhash` (perceptual hash), `hashIndex`
  (`.metadata/hashes.json`, Hamming ≤10 dedupe). Geometry is `src/lib/crop.ts` (shared with the
  client `CropEditor`; pure, no DOM/sharp).
- **Per-orientation crops:** each image carries up to two independent crops (horizontal locked to
  the panel W:H, vertical to the swapped H:W). Upload auto-seeds only the natural (longest-edge)
  orientation. Sidecar back-compat: a legacy single `crop` reads as `crops.horizontal`.
- **Oversize crops (#184):** a crop may zoom out past the image to contain-fit; coords legitimately
  go **outside `[0,1]`** (white fills the gap). `clampCrop` is the keystone (contain-fit max +
  ≥2-edge invariant); `putCrop` validates by re-clamping (rejects what the clamp would move) — this
  doubles as a DoS guard. Every consumer must tolerate out-of-`[0,1]` coords.
- **Thumbnails are per orientation:** `getThumbPath(name, orientation)` → 300×180 (h) or 180×300
  (v), using that orientation's saved crop **or the auto-crop fallback**, so every image previews
  in **both** orientations even with only one crop saved. Cached as `<stem>.<orientation>.jpg`;
  `invalidateThumb` clears **both** on any crop change. This is looser than the device `/photo`
  path on purpose (gallery = manage/preview; device = only serve what's actually been cropped).
- **Gallery view orientation** (`useGalleryOrientation`): a persisted toggle (localStorage
  `the-frame-gallery-orientation`, default horizontal). It re-renders the **whole** grid in one
  orientation (uniform aspect, no per-image mixing) and seeds the crop modal's initial tab
  (`CropEditor` `initialOrientation`).
- **CropEditor is canvas-based.** Scene math (`computeLayout`), pan/pinch/wheel, and the ≥2-edge
  invariant are ported verbatim. Canvas can't read CSS vars, so theme colors are hardcoded hex
  (`PRIMARY` terracotta `#e56943`, `CANVAS_BG` parchment `#e9e2d6`, `DIM` warm scrim) — keep these
  in sync if the tokens change. The canvas area is measured via a **callback ref** (Radix mounts
  the dialog portal after effects run, so an empty-deps ResizeObserver would miss the node).
- **Mobile UX:** the crop modal is `dvh`-sized (`h-[90dvh]` — `vh` overflows behind mobile browser
  chrome); hints/“not set” render as bottom overlays on the image; footer actions are a 2-col grid
  (primary spans full width on odd counts) collapsing to a right-aligned row on `sm+`. Upload is a
  floating FAB on mobile (`UploadButton floating`, safe-area inset), an inline header button on
  desktop. The orientation toggle is an iOS-style segmented control.
- **Env (gallery):** `FRAME_MAX_UPLOAD_BYTES` (default 26214400), `FRAME_DEFAULT_W` (800),
  `FRAME_DEFAULT_H` (480), `FRAME_DEFAULT_CONTRAST` (1.2) — read in `server.ts` + `vite.config.ts`,
  passed through `mountFrameApi`. `multer` is a runtime dep (multipart upload).
- **Routing:** `Gallery` renders at `/` (replacing the scaffold landing) until #187 wraps it in the
  Picture↔Calendar shell.

## i18n

`src/i18n.ts` initialises react-i18next. **Polish-first**: detection order is
`['localStorage']` only (navigator/browser language is deliberately ignored) and
`fallbackLng: 'pl'`, so first load is always Polish — the frame lives in a Polish home. The
manual `LanguageToggle` is the only way to switch and its choice persists to localStorage key
`the-frame-lang`. Catalogs: `locales/pl.json`, `locales/en.json` (**PL + EN**). The e-ink
device output is Polish-only and is NOT i18n'd (separate concern, #188).

## QR

`scripts/gen-qr.ts` (run `npm run qr`) encodes the LAN URL into a **static printable** asset in
`public/` — no runtime QR in the app. The host is **explicit via `FRAME_LAN_HOST` / CLI arg**
(no network auto-detection); the script throws if neither is set. Generated assets are
gitignored (regenerate per host).

## Tests

vitest, Node environment (no DOM) — test pure logic, not React components. `src/test/setup.ts`
redirects `FRAME_GALLERY_DIR` / `FRAME_CALENDAR_DB` to temp dirs so tests never touch real
data. Test files live alongside source as `*.test.ts`.

## Gotchas

- **Server modules must not use `@/` for value imports.** The server chain is bundled into
  `vite.config.ts` (and runs under `tsx`), neither of which applies the `@/`→`src/` alias to
  runtime values. `import type … from '@/…'` is fine (erased at compile time), but a value
  import like `import { VERSION } from '@/version'` breaks `vite build`. Use a relative path in
  server code (see `frameApi.ts`).
- **`.npmrc` sets `legacy-peer-deps=true`** because `react-i18next` declares
  `peerOptional typescript@^5` while we run TypeScript 6 (matching random-tools). The peer is
  optional and 6.x is compatible. Keep this until react-i18next widens its peer range.
- **`src/vite-env.d.ts`** declares `*.scss`/`*.css` modules — without it, `tsc` (TS 6) errors on
  the `import './styles.scss'` side-effect import in `main.tsx`.

## Remaining epic work (#181) — what NOT to build outside its task

Image gallery/crop/thumbnail pipeline → **#185 (done)**. Calendar events table/CRUD/UI → **#186**.
The Picture↔Calendar switcher + real navigation → **#187** (the gallery currently sits at `/` as a
stand-in). E-ink fetch/firmware → **#188**. Back-port the orientation toggle + per-orientation
thumbnails to eink-frame → **#189**.
