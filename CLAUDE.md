# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server with Turbopack at http://localhost:3000
- `npm run build` - Build production application with Turbopack
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Note on Turbopack
This project uses Next.js 15 with Turbopack for faster development builds. All build commands include the `--turbopack` flag.

## Architecture Overview

### Application Structure
This is a responsive FM radio station tracker built with Next.js 15, TypeScript, and Tailwind CSS. The app displays a map for tracking car position relative to FM stations with an interactive sidebar for filtering stations.

### Core Components
- **`src/app/page.tsx`** - Main application with layout management, geolocation, and state coordination
- **`src/components/Map.tsx`** - Leaflet-based interactive map with station markers and user location
- **`src/components/Sidebar.tsx`** - Responsive filtering sidebar with search and station list

### Data Layer
- **`src/types/station.ts`** - Core TypeScript interfaces for FMStation, UserLocation, and FilterType
- **`src/data/stations.ts`** - Mock FM station data and utility functions for LA area stations

### Map Implementation Details
- Uses `react-leaflet` with dynamic imports (`ssr: false`) to avoid server-side rendering issues
- Custom icons for stations (red markers) and user location (blue markers)  
- Real-time distance calculations between user location and stations
- Popups show station details including calculated distance

### Responsive Design Strategy
- **Desktop (lg+)**: Static sidebar alongside map
- **Mobile**: Collapsible sidebar with `z-[1000]` that overlays but doesn't cover entire map
- **Sidebar width**: `w-72` on mobile, `w-80` on larger screens to preserve map visibility
- No dark overlay on mobile - both sidebar and map remain interactive when sidebar is open

### Styling and CSS
- Uses Tailwind CSS 4 with CSS-based configuration (no separate config file)
- Leaflet CSS imported in `globals.css` with custom z-index fixes for proper layering
- Custom `.line-clamp-2` utility for text truncation in station descriptions

### State Management
Key state in main component:
- `selectedStation` - Currently selected FM station for highlighting
- `sidebarOpen` - Controls sidebar visibility on mobile
- `userLocation` - User's current geolocation coordinates

### Geolocation Integration
- Automatic user location detection on component mount
- Fallback to Los Angeles coordinates if geolocation fails
- Distance calculation using Haversine formula
- Station list automatically sorts by distance when user location available