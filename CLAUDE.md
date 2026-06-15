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
share one router. Currently only `GET /api/health`; gallery (#185) and calendar (#186)
endpoints hang off the same factory. The SPA fallback in `server.ts` 404s `/api/*` so it never
swallows API paths.

## Storage

Two **separate, independent** stores, both starting empty:

- **Images** — on-disk blobs + **JSON sidecar metadata** (no SQL), `src/server/imageStore.ts`.
  Layout under `FRAME_GALLERY_DIR`: `<uuid>.jpg` blobs, `.metadata/<stem>.json` sidecars
  (`{ width, height, crops: { horizontal?, vertical? } }`), `.thumbs/`, `.trash/`. Mirrors
  eink-frame's store. Scaffold provides `list()` + sidecar reads only; the upload/crop/thumb/
  dedupe pipeline is ported in **#185**.
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

## Scope of #183 (this scaffold) — what NOT to build here

Image upload/crop/thumbnail pipeline → **#185**. Calendar events table/CRUD/UI → **#186**.
The Picture↔Calendar switcher + real navigation → **#187** (the current landing page is a
throwaway placeholder). E-ink fetch/firmware → **#188**.
