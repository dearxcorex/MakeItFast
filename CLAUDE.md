# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` - Start dev server with Turbopack at http://localhost:3000
- `npm run build` - Production build (`prisma generate && next build --turbopack`)
- `npm run lint` - Run ESLint
- `npx prisma generate` - Regenerate Prisma client after schema changes
- `npx prisma db push` - Push schema changes to database

## Architecture Overview

FM radio station tracker for NBTC (Thailand), built with Next.js 15, TypeScript, Tailwind CSS 4, and Prisma + PostgreSQL. Used to track and inspect FM stations across Thai provinces.

### Data Flow
1. **`FMStationsFetcher`** (server component) loads all stations from PostgreSQL via Prisma at page load
2. Passes transformed data to **`OptimizedFMStationClient`** (client component) which manages all client-side state
3. **`Map`** component uses `react-leaflet` with dynamic import (`ssr: false`) — Leaflet cannot run server-side
4. API routes under `src/app/api/` provide REST endpoints for station CRUD

### Key Patterns
- **Database → UI conversion**: `stationService.ts:convertToFMStation()` maps Prisma `fm_station` rows to the `FMStation` interface used throughout the UI. Field names differ significantly (e.g., `id_fm` → `id`, `freq` → `frequency`, `district` → `city`, `province` → `state`)
- **Station grouping**: Stations at identical coordinates are grouped into clustered markers with multi-station popups
- **Two tabs**: Stations list, Intermod Calculator — controlled by `ActiveTab` type in `OptimizedFMStationClient`
- **Thai language**: Inspection statuses use Thai strings ('ตรวจแล้ว'/'ยังไม่ตรวจ', 'ยื่น'/'ไม่ยื่น')

### Database
- PostgreSQL via Prisma ORM, schema in `prisma/schema.prisma`
- Single model: `fm_station` with fields for frequency, location, inspection status, on-air status
- Connection configured via `DATABASE_URL` env var
- Prisma client singleton in `src/lib/prisma.ts` with global caching for dev

### Component Organization
- `src/components/map/` - Map sub-components (popups, station cards, navigation button)
- `src/components/sidebar/` - Sidebar sub-components (filter controls, station list items)
- `src/components/client/` - Client-only components (header, mobile filter bar)
- `src/contexts/ThemeContext.tsx` - Theme provider
- `src/hooks/` - Custom hooks for filtering (`useOptimizedFilters`) and keyboard nav
- `src/utils/mapHelpers.ts` - Distance calculation (Haversine), marker icons, map utilities

### Responsive Design
- **Desktop**: Fixed left nav sidebar + content sidebar + map
- **Mobile**: Collapsible sidebar overlay with `z-[1000]`, map remains interactive
- Tailwind CSS 4 with CSS-based config (no `tailwind.config.js`)

## Important Notes
- Do not commit and push to GitHub. Wait for explicit command.
