# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Wiki (Project Knowledge Base)

A persistent wiki lives at `wiki/`. At session start, read `wiki/index.md` and `tail wiki/log.md` to load accumulated project knowledge. After implementing features or learning something new, update the wiki per `wiki/SCHEMA.md`. See the schema for full rules on ingest, query, lint, and implement operations.

## Commands

- `npm run dev` - Start dev server with Turbopack at http://localhost:3000
- `npm run build` - Production build (`prisma generate && next build --turbopack`)
- `npm run lint` - Run ESLint
- `npm test` - Run all tests (vitest)
- `npx vitest run src/__tests__/foo.test.ts` - Run a single test file
- `npm run test:coverage` - Run tests with v8 coverage report
- `npx prisma generate` - Regenerate Prisma client after schema changes
- `npx prisma db push` - Push schema changes to database

## Architecture Overview

FM radio station tracker for NBTC (Thailand), built with Next.js 15, TypeScript, Tailwind CSS 4, and Prisma + PostgreSQL. Three tabs: Field Ops (unified FM + interference map), Cell Sites (mobile base-station licences) and Intermod Calculator.

### Data Flow
1. **`src/app/page.tsx`** renders **`FieldOpsFetcher`** — this is the only app screen
2. **`FieldOpsFetcher`** (server component) reads `fm_station` and `interference_site` straight from Prisma, converts rows via `convertToFMStation` / `convertToInterferenceSite`, and passes them to **`FieldOpsClient`**
3. **`FieldOpsClient`** (client component) owns all client state: active tab, filters, selection, theme, and the `isMobile` breakpoint (`window.innerWidth < 900`)
4. **`FieldOpsMap`** uses `react-leaflet` with dynamic import (`ssr: false`) — Leaflet cannot run server-side
5. API routes under `src/app/api/` handle mutations (inspection toggles, PATCH station/site) and inspection-history reads. Initial Field Ops data does **not** go through them; the Cell Sites tab is the exception — it lazy-loads `data/cell-sites/cell-sites-clean.csv` through `/api/cell-sites` on first open

### Key Patterns
- **Database → UI conversion**: `stationService.ts:convertToFMStation()` and `interferenceService.ts:convertToInterferenceSite()` map Prisma snake_case rows to camelCase interfaces. Field names differ significantly (e.g., `id_fm` → `id`, `freq` → `frequency`, `district` → `city`, `province` → `state`)
- **Marker clustering**: `react-leaflet-cluster` in `FieldOpsMap`. Cluster bubbles draw a segmented ring whose arcs are proportional to the child mix (`utils/clusterIcon.ts`), and children are bucketed by `utils/pinBucket.ts` (`critical` / `pending` / `offair` / `inspected`). Every map colour comes from `utils/pinTokens.ts`
- **Three tabs**: Field Ops, Cell Sites, Intermod — controlled by `FieldOpsTab` in `field-ops/FieldOpsNav.tsx`
- **Coverage area**: This office tracks **นครราชสีมา** and **ชัยภูมิ** only. บุรีรัมย์ was removed on 2026-09-12 (`scripts/delete-buriram.ts`) and dropped from `TARGET_PROVINCES` so an Excel re-import cannot resurrect it
- **Thai language**: Inspection statuses use Thai strings (`'ตรวจแล้ว'`/`'ยังไม่ตรวจ'`, `'ยื่น'`/`'ไม่ยื่น'`, `'สถานีหลัก'`). These are **comparison values in logic**, not display strings — a translation pass must not rewrite them
- **Optimistic updates**: `FieldOpsClient` updates local state immediately, then PATCHes the server and reconciles

### Database
- PostgreSQL via Prisma ORM, schema in `prisma/schema.prisma`
- Station and site models: `fm_station`, `interference_site`; auth and inspection history: `user`, `station_inspection(_member)`, `interference_inspection(_member)`
- Migrations are hand-written SQL under `prisma/migrations/<date>-<name>/migration.sql`; apply them to the Neon DB before deploying code that reads new columns (Prisma selects every scalar by default)
- Connection configured via `DATABASE_URL` env var
- Prisma client singleton in `src/lib/prisma.ts` with global caching for dev

### Component Organization
- `src/components/field-ops/` - The entire main UI: nav rail, header, map, filters, bottom sheet, mobile drawer
- `src/components/admin/` - User management modals, reached only from `/admin/users`
- `src/components/interference/NavigationPill.tsx` - Bearing/distance pill; the only survivor in this directory, used by `FieldOpsMap`
- `src/contexts/ThemeContext.tsx` - Theme provider mounted in `layout.tsx`. Note Field Ops keeps its own theme state in `localStorage` under `fo-theme`
- `src/utils/mapHelpers.ts` - `createLocationIcon` only (the user-location marker)
- `src/utils/clusterIcon.ts`, `src/utils/pinBucket.ts` - Cluster ring rendering and pin bucketing
- `src/utils/cellSites.ts`, `src/utils/cellSiteFilters.ts` - Cell Sites CSV parsing and filtering (data built by `scripts/clean-cell-sites.ts`)
- `src/utils/intermodCalculations.ts` - Third-order intermod products, aviation band analysis, path loss

### Responsive Design
- **Desktop**: 72px icon rail (`FieldOpsNav`) + top header (`FieldOpsHeader`) + map-dominant content
- **Mobile** (`< 900px`): the rail is hidden; a top header with a ☰ opens `FieldOpsDrawer`, filters live in `MobileFilterBar`, and station detail opens in `FieldOpsBottomSheet`
- Tailwind CSS 4 with CSS-based config (no `tailwind.config.js`)

## Testing

- Vitest with jsdom environment, `@testing-library/react` for components
- Tests in `src/__tests__/`, 582 tests across 70 files
- Leaflet requires mocking: `vi.mock('leaflet')` and `vi.mock('react-leaflet')` with divIcon/icon stubs
- CSS stub at `src/__tests__/css-stub.js` handles `leaflet/dist/leaflet.css` imports (aliased in `vitest.config.ts`)
- API route tests mock Prisma via `vi.mock('@/lib/prisma')` with method stubs (findMany, findFirst, etc.)
- Next.js API routes using `request.nextUrl` require `NextRequest` (not `Request`) in tests
- Component tests use `container.textContent` assertions to avoid multi-match issues with `screen.getByText`

## Important Notes
- Do not commit and push to GitHub. Wait for explicit command.

## Agent skills

### Issue tracker

Issues live in the `dearxcorex/MakeItFast` GitHub repo, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical defaults — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
