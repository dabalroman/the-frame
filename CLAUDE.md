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
`health` is matched first, then calendar `/events*` routes, then the gallery handlers. The
calendar handlers come from `createEventApi(createEventStore(calendar.db))`, wired in
`createFrameApi` alongside `image`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | `{ ok, version, gallery, calendar:{ ready, events } }` |
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
| GET/POST | `/api/events` | list / create event (#186) |
| PUT/DELETE | `/api/events/:id` | update / delete event |
| GET | `/api/events/upcoming?days=N` | next-N-days occurrences, closest-first (#188 feed) |
| GET | `/api/device/frame?orientation=&w=&h=&days=&chance=` | **primary device path** — server-dispatched: returns server-rendered events PNG (X% chance when events exist) or random photo; device is dumb |
| GET | `/api/device/photo?orientation=&w=&h=` | random orientation-filtered 1-bit PNG for device (used as fallback internally) |
| GET | `/api/device/events?days=N` | pre-formatted Polish event lines, max 8, `\n`-delimited |
| GET | `/api/device/qr` | 1-bit PNG: `public/frame-qr.png` at natural square size |

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
  keeps `PRAGMA user_version` in sync. First migration: `20260615120000_create-events` (#186).
  - Server runs via `tsx`, never compiled, so `.ts` migrations are loaded at runtime via
    `createRequire`. **In tests** import the migration module directly and pass it to
    `runMigrations` (see `eventStore.test.ts` / `calendarDb.test.ts`) — don't call
    `loadMigrations()` (its `createRequire('*.ts')` path isn't transformed by vitest).

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
  - **Android Chrome upload (#190):** plain `accept="image/*" multiple` makes Android Chrome 14/15
    open the Files UI directly — no Camera, no gallery grid. The mobile FAB therefore uses
    `accept="image/*,android/allowCamera"` (non-standard token, **mobile FAB only**) to force a
    chooser with **Camera + Files (multi-select)**. The system Photo Picker / **gallery grid is
    unreachable while `multiple` is set** (Chrome limitation) — accepted; the responsive
    single-select-on-mobile fallback was offered and declined. Desktop input stays clean
    `image/*`. Non-image picks are caught server-side (415).
- **Env (gallery):** `FRAME_MAX_UPLOAD_BYTES` (default 26214400), `FRAME_DEFAULT_W` (800),
  `FRAME_DEFAULT_H` (480), `FRAME_DEFAULT_CONTRAST` (1.2) — read in `server.ts` + `vite.config.ts`,
  passed through `mountFrameApi`. `multer` is a runtime dep (multipart upload).
- **Routing:** `Gallery` renders at `/photos`. The hub (`/`) links to it via a large nav card.

## Calendar (#186)

Custom events with a deliberately minimal recurrence model: `repeat` is **`none` or `yearly` only**
(birthdays/anniversaries). Event shape `{ id, title, date, time?, repeat, description? }` — `title`
is the one-line eink label (#188), `description` is app-only, no icon/category, no age math. `date`
is `'YYYY-MM-DD'`; for yearly only month+day recur.

- **Occurrence logic is pure** in `src/lib/recurrence.ts` (no DOM/SQL; dates are 'YYYY-MM-DD'
  strings, UTC math, `today` is injected so it's testable): `occursOnDate` (month grid),
  `nextOccurrence`, `upcomingEvents(today, days=3)` (the #188 feed, closest-first), `agenda` (stream
  order: future closest-first, past one-offs last). **Feb 29 yearly events clamp to Feb 28** in
  non-leap years. `src/lib/monthGrid.ts` is the **Monday-first** (PL) calendar matrix. Input
  validation is `src/lib/event.ts`.
- **Store/API:** `eventStore.ts` (prepared-statement CRUD + `upcoming`), `eventApi.ts` (JSON
  handlers, validate at the boundary, `serverLocalToday()` for the feed — no UTC shift since the
  frame lives in one timezone).
- **UI** (`src/features/calendar/`, mirrors the gallery): `Calendar` hosts a **Month/Stream**
  segmented toggle (persisted `the-frame-calendar-view`), `MonthView` (grid + month/year nav +
  always-present "Today" below the grid; tap-day→`DaySheet`, tap-event→`EventDialog`), `EventStream`
  (agenda), `EventDialog` (none/yearly via `SegmentedToggle`, optional time w/ clear button, delete
  + undo). Dates localized via `Intl` (`format.ts`). Route `/calendar`.
- **Shared primitives:** `src/components/SegmentedToggle.tsx` (gallery orientation, calendar
  view/repeat) and `src/components/Fab.tsx` (gallery upload, calendar add) were extracted so both
  features stay visually identical — change them in one place.

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

## Device renderer (#188)

`src/server/deviceRenderer.ts` has two exports:

- **`renderQrImage`** — dithered 1-bit PNG of the QR code at its natural square size.
- **`renderEventsImage(lines, qrPath, w, h)`** — Polish-only events screen as a dithered 1-bit PNG.
  Uses SVG → sharp (librsvg) → Floyd-Steinberg. **Font is `DejaVu Sans`** (system font, supports
  Polish diacritics ą/ć/ę/ł/ń/ó/ś/ź/ż; Nunito/Fraunces are not available on the server).
  QR is composited in the bottom-right corner; its size is clamped to `min(128, w-40, h-40)` so
  small test images don't trigger sharp's "composite must be same size or smaller" error.

`/api/device/frame` is the **primary device endpoint** — the server rolls the X% chance and
returns either a rendered events PNG or a random photo. The ESPHome firmware calls only this
endpoint (plus `/api/device/qr` for the WiFi info screen). `/api/device/events` and
`/api/device/photo` remain available but are no longer called by the firmware.

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

## Navigation shell (#187 — done)

Routes: `/` → **Home hub** (`src/features/home/Home.tsx`), `/photos` → Gallery, `/calendar` → Calendar. The hub is a landing screen with two large descriptive nav cards — **not** a bottom tab bar or top segmented control (both were considered and rejected: tab bar collides with the FAB, segmented control stacks awkwardly with per-section controls). Both Gallery and Calendar render a shared `<HomeButton/>` (`src/components/HomeButton.tsx`) as a back-to-hub affordance.

## Device firmware (#188)

ESPHome firmware for the TRMNL Seeed Studio 7.5" e-ink device. Source at
`esphome/the-frame-display.yaml`.

**Deploy:**
```bash
sudo cp ~/projects/the-frame/esphome/the-frame-display.yaml ~/hassio/homeassistant/esphome/
```
Then flash via the ESPHome dashboard or `esphome run`.

**Hardware:** XIAO ESP32-S3 Plus. **3 user-programmable buttons** (D3 skipped, not on PCB):
| Button | GPIO | Action |
|---|---|---|
| KEY1 (D1) | GPIO2 | Refresh in current orientation |
| KEY2 (D2) | GPIO3 | Toggle orientation H↔V, then refresh |
| KEY3 (D4) | GPIO5 | WiFi SSID + signal bars + QR code; stays awake (OTA available); any button press → refresh normal content → sleep |
| KEY4 (EN) | — | Hardware RESET only — not programmable |

**Deep sleep:** EXT1 ANY_LOW (GPIO2∥3∥5) + NTP-aligned timer (see below). e-ink retains image during sleep.

**NTP-aligned wakes + overnight gap (#217):** the device has an `sntp` `time:` component (`sntp_time`, tz `Europe/Warsaw`). Instead of a fixed 60-min timer, the `enter_sleep` **script** computes the duration to the **next top-of-hour** (sleep to `:00`), so wakes land on 07:00, 08:00, … 23:00. If the next hour would be `< resume_hour` (i.e. 00:00–06:00), it targets `resume_hour` (07:00) instead — so **23:00 is the last redraw and the device does one ~8 h sleep straight to 07:00** (no overnight wakes). `enter_sleep` uses `deep_sleep.enter` with a templated `sleep_duration` lambda; the `deep_sleep:` component's `${deep_sleep_minutes}min` is now only a **fallback** used when the clock isn't synced yet. Both end-of-cycle sleeps (`online_image.on_download_finished`, `render_events`) call `script.execute: enter_sleep` instead of `deep_sleep.enter`.
  - **`auto_wake` global** = `cause != ESP_SLEEP_WAKEUP_EXT1` (timer/cold = automatic, button = manual). A **pre-WiFi guard** in `on_boot` (right after `safe_mode.mark_successful`, which was moved up so early sleeps don't trip the safe-mode reboot counter): if `auto_wake && sntp_time.now().is_valid() && hour < resume_hour`, it `script.execute: enter_sleep` immediately — catches an RTC-drift undershoot (woke ~06:50) without spending WiFi/fetch/redraw. Button (EXT1) wakes set `auto_wake=false` → guard skipped → buttons always work overnight. An unsynced clock fails open (normal boot).
  - **Resume precision is ±~30 min** (RTC drift over the long sleep is uncorrected by design — no overnight re-sync). NTP re-syncs on every daytime wake's WiFi connect, so the clock is fresh whenever the gap edges are evaluated.

**Boot flow:** (auto wake before `resume_hour` → guard sleeps back to 07:00) → fetch `/api/device/events?days=N` → non-empty + `esp_random() % 100 < events_chance` → show event poster; otherwise fetch `/api/device/photo` → display → `enter_sleep` (NTP-aligned).

**Key substitutions in `esphome/the-frame-display.yaml`:**
| Substitution | Default | Notes |
|---|---|---|
| `frame_url` | `http://192.168.0.4:7375` | Update before flash |
| `deep_sleep_minutes` | `60` | **Fallback** sleep only (used when the clock isn't synced); normal cadence is NTP-aligned via `enter_sleep` |
| `resume_hour` | `7` | First redraw hour after the overnight gap; automatic wakes for hours `< this` are pushed to it (#217) |
| `quiet_timezone` | `Europe/Warsaw` | Timezone for the `sntp` `time:` component (DST-correct) (#217) |
| `events_days` | `3` | Days ahead to fetch events |
| `events_chance` | `30` | 0–100 % chance of showing events when events exist (device-side randomness) |

**QR asset:** `public/frame-qr.png` — regenerate with `npm run qr` when the LAN IP changes. Served as-is (natural square size) by `/api/device/qr`; device renders it on the right half of the WiFi+QR screen.

No HA API component (removes keep-alive overhead vs. the original `trmnl.yaml`). Time comes from **SNTP**, not HA — so the "no HA API" stance still holds even with the `time:` component (#217).

## Remaining work

Back-port orientation toggle + per-orientation thumbnails to eink-frame → **#189** (open).
