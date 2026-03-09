# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

FM radio station tracker for NBTC (Thailand), built with Next.js 15, TypeScript, Tailwind CSS 4, and Prisma + PostgreSQL. Three main features: station tracking/inspection, intermodulation calculator, and interference analysis with CloudRF propagation modeling.

### Data Flow
1. **`FMStationsFetcher`** (server component) loads all stations from PostgreSQL via Prisma at page load
2. Passes transformed data to **`OptimizedFMStationClient`** (client component) which manages all client-side state
3. **`Map`** component uses `react-leaflet` with dynamic import (`ssr: false`) — Leaflet cannot run server-side
4. API routes under `src/app/api/` provide REST endpoints for station CRUD and interference data

### Key Patterns
- **Database → UI conversion**: `stationService.ts:convertToFMStation()` and `interferenceService.ts:convertToInterferenceSite()` map Prisma snake_case rows to camelCase interfaces. Field names differ significantly (e.g., `id_fm` → `id`, `freq` → `frequency`, `district` → `city`, `province` → `state`)
- **Station grouping**: Stations at identical coordinates are grouped into clustered markers with multi-station popups (`groupStationsByCoordinates`)
- **Three tabs**: Stations, Intermod Calculator, Interference Analysis — controlled by `ActiveTab` type in `OptimizedFMStationClient`
- **Thai language**: Inspection statuses use Thai strings (`'ตรวจแล้ว'`/`'ยังไม่ตรวจ'`, `'ยื่น'`/`'ไม่ยื่น'`). Boolean DB values are converted to/from Thai in the UI layer
- **Optimistic updates**: `handleUpdateStation` in `OptimizedFMStationClient` updates UI immediately, then syncs with server. Uses `stationsRef` to avoid stale closures in Leaflet popup callbacks

### Database
- PostgreSQL via Prisma ORM, schema in `prisma/schema.prisma`
- Three models: `fm_station`, `interference_site`, `cloudrf_cache`
- Connection configured via `DATABASE_URL` env var
- Prisma client singleton in `src/lib/prisma.ts` with global caching for dev

### CloudRF Integration
- `src/utils/cloudrf.ts` - API client with request hashing, caching (7-day TTL in `cloudrf_cache`), and rate limiting
- `src/utils/equipmentProfiles.ts` - Equipment profiles (macro_urban/suburban/rural) and Thailand-specific environment config
- API routes: `/api/cloudrf/area` (coverage), `/api/cloudrf/path` (point-to-point), `/api/cloudrf/multisite`, `/api/cloudrf/interference`
- Requires `CLOUDRF_API_KEY` env var for live API calls

### Component Organization
- `src/components/map/` - Map sub-components (popups, station cards, navigation button)
- `src/components/sidebar/` - Sidebar sub-components (filter controls, station list items)
- `src/components/client/` - Client-only components (header, mobile filter bar)
- `src/components/interference/` - Interference analysis components (map, controls, filters, import)
- `src/contexts/ThemeContext.tsx` - Theme provider
- `src/hooks/useOptimizedFilters.ts` - Filtering with distance sorting, hashtag search, performance metrics
- `src/utils/mapHelpers.ts` - Distance calculation (Haversine), marker icons, map utilities
- `src/utils/intermodCalculations.ts` - Third-order intermod products, aviation band analysis, path loss

### Responsive Design
- **Desktop**: Fixed left nav sidebar + content area + map
- **Mobile**: Collapsible filter bar, bottom tab navigation, map remains interactive
- Tailwind CSS 4 with CSS-based config (no `tailwind.config.js`)

## Testing

- Vitest with jsdom environment, `@testing-library/react` for components
- Tests in `src/__tests__/`, 824+ tests, 81%+ coverage
- Leaflet requires mocking: `vi.mock('leaflet')` and `vi.mock('react-leaflet')` with divIcon/icon stubs
- CSS stub at `src/__tests__/css-stub.js` handles `leaflet/dist/leaflet.css` imports (aliased in `vitest.config.ts`)
- API route tests mock Prisma via `vi.mock('@/lib/prisma')` with method stubs (findMany, findFirst, etc.)
- Next.js API routes using `request.nextUrl` require `NextRequest` (not `Request`) in tests
- Component tests use `container.textContent` assertions to avoid multi-match issues with `screen.getByText`

## Important Notes
- Do not commit and push to GitHub. Wait for explicit command.
