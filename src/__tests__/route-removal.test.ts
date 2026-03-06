/**
 * TDD Tests: Verify Route Plan Feature Removal
 *
 * These tests confirm that all route plan artifacts have been
 * removed from types, utilities, and components.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '..');

// Helper: read file content
function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(SRC, relativePath), 'utf-8');
}

// Helper: check if file exists
function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(SRC, relativePath));
}

describe('Route Plan Feature Removal', () => {
  // ─── Deleted Files ──────────────────────────────────────────
  describe('Deleted files', () => {
    it('should have removed RoutePlanPanel.tsx', () => {
      expect(fileExists('components/route/RoutePlanPanel.tsx')).toBe(false);
    });

    it('should have removed RoutePlanItem.tsx', () => {
      expect(fileExists('components/route/RoutePlanItem.tsx')).toBe(false);
    });

    it('should have removed routeHelpers.ts', () => {
      expect(fileExists('utils/routeHelpers.ts')).toBe(false);
    });

    it('should have removed the route directory', () => {
      expect(fileExists('components/route')).toBe(false);
    });
  });

  // ─── Types ──────────────────────────────────────────────────
  describe('types/station.ts', () => {
    it('should not export RoutePlanStation interface', () => {
      const content = readFile('types/station.ts');
      expect(content).not.toContain('RoutePlanStation');
    });

    it('should still export FMStation interface', () => {
      const content = readFile('types/station.ts');
      expect(content).toContain('export interface FMStation');
    });

    it('should still export UserLocation interface', () => {
      const content = readFile('types/station.ts');
      expect(content).toContain('export interface UserLocation');
    });

    it('should still export FilterType', () => {
      const content = readFile('types/station.ts');
      expect(content).toContain('export type FilterType');
    });
  });

  // ─── Utilities ──────────────────────────────────────────────
  describe('utils/mapHelpers.ts', () => {
    it('should not contain createRouteNumberIcon', () => {
      const content = readFile('utils/mapHelpers.ts');
      expect(content).not.toContain('createRouteNumberIcon');
    });

    it('should still export createStationIcon', () => {
      const content = readFile('utils/mapHelpers.ts');
      expect(content).toContain('export function createStationIcon');
    });

    it('should still export createLocationIcon', () => {
      const content = readFile('utils/mapHelpers.ts');
      expect(content).toContain('export function createLocationIcon');
    });

    it('should still export calculateDistance', () => {
      const content = readFile('utils/mapHelpers.ts');
      expect(content).toContain('export function calculateDistance');
    });

    it('should still export getStationIcon', () => {
      const content = readFile('utils/mapHelpers.ts');
      expect(content).toContain('export function getStationIcon');
    });
  });

  // ─── NavSidebar ─────────────────────────────────────────────
  describe('components/NavSidebar.tsx', () => {
    let content: string;

    it('should not contain route tab', () => {
      content = readFile('components/NavSidebar.tsx');
      expect(content).not.toContain("'route'");
      expect(content).not.toContain('แผนตรวจสอบ');
    });

    it('should not contain routeCount prop', () => {
      content = readFile('components/NavSidebar.tsx');
      expect(content).not.toContain('routeCount');
    });

    it('should have ActiveTab as stations | intermod only', () => {
      content = readFile('components/NavSidebar.tsx');
      expect(content).toContain("'stations' | 'intermod'");
      expect(content).not.toContain("| 'route'");
    });

    it('should still have stations and intermod nav items', () => {
      content = readFile('components/NavSidebar.tsx');
      expect(content).toContain("id: 'stations'");
      expect(content).toContain("id: 'intermod'");
    });
  });

  // ─── Map Component ─────────────────────────────────────────
  describe('components/Map.tsx', () => {
    let content: string;

    it('should not import RoutePlanStation', () => {
      content = readFile('components/Map.tsx');
      expect(content).not.toContain('RoutePlanStation');
    });

    it('should not import createRouteNumberIcon', () => {
      content = readFile('components/Map.tsx');
      expect(content).not.toContain('createRouteNumberIcon');
    });

    it('should not import Polyline', () => {
      content = readFile('components/Map.tsx');
      expect(content).not.toContain('Polyline');
    });

    it('should not contain routePlan prop', () => {
      content = readFile('components/Map.tsx');
      expect(content).not.toContain('routePlan');
    });

    it('should not contain FitRouteBounds', () => {
      content = readFile('components/Map.tsx');
      expect(content).not.toContain('FitRouteBounds');
    });

    it('should not contain route-numbered marker rendering', () => {
      content = readFile('components/Map.tsx');
      expect(content).not.toContain('route-marker');
      expect(content).not.toContain('route-${');
    });

    it('should still render station markers', () => {
      content = readFile('components/Map.tsx');
      expect(content).toContain('getStationIcon');
      expect(content).toContain('MapContainer');
    });
  });

  // ─── OptimizedFMStationClient ───────────────────────────────
  describe('components/OptimizedFMStationClient.tsx', () => {
    let content: string;

    it('should not import RoutePlanStation', () => {
      content = readFile('components/OptimizedFMStationClient.tsx');
      expect(content).not.toContain('RoutePlanStation');
    });

    it('should not import sortByNearestNeighbor', () => {
      content = readFile('components/OptimizedFMStationClient.tsx');
      expect(content).not.toContain('sortByNearestNeighbor');
    });

    it('should not import RoutePlanPanel', () => {
      content = readFile('components/OptimizedFMStationClient.tsx');
      expect(content).not.toContain('RoutePlanPanel');
    });

    it('should have ActiveTab as stations | intermod only', () => {
      content = readFile('components/OptimizedFMStationClient.tsx');
      expect(content).toContain("'stations' | 'intermod'");
      expect(content).not.toContain("| 'route'");
    });

    it('should not contain route state variables', () => {
      content = readFile('components/OptimizedFMStationClient.tsx');
      expect(content).not.toContain('routePlanStations');
      expect(content).not.toContain('routeStartLocation');
      expect(content).not.toContain('sortedRoutePlan');
    });

    it('should not contain route handler callbacks', () => {
      content = readFile('components/OptimizedFMStationClient.tsx');
      expect(content).not.toContain('handleToggleRouteStation');
      expect(content).not.toContain('handleRemoveFromRoute');
      expect(content).not.toContain('handleClearRoute');
      expect(content).not.toContain('handleSetRouteStations');
    });

    it('should not pass routeCount to NavSidebar', () => {
      content = readFile('components/OptimizedFMStationClient.tsx');
      expect(content).not.toContain('routeCount=');
    });

    it('should not pass routePlan to Map', () => {
      content = readFile('components/OptimizedFMStationClient.tsx');
      expect(content).not.toContain('routePlan=');
    });

    it('should not contain mobile route button', () => {
      content = readFile('components/OptimizedFMStationClient.tsx');
      expect(content).not.toContain('ตรวจสอบ');
      expect(content).not.toContain("setActiveTab('route')");
    });

    it('should still render stations tab and intermod tab', () => {
      content = readFile('components/OptimizedFMStationClient.tsx');
      expect(content).toContain("setActiveTab('stations')");
      expect(content).toContain("setActiveTab('intermod')");
      expect(content).toContain('IntermodCalculator');
    });

    it('should not import useMemo (no longer needed)', () => {
      content = readFile('components/OptimizedFMStationClient.tsx');
      // Check the react import line specifically - useMemo appears in useMemoryMonitor name
      const reactImportLine = content.split('\n').find(line => line.includes("from 'react'"));
      expect(reactImportLine).toBeDefined();
      expect(reactImportLine).not.toContain('useMemo');
    });
  });

  // ─── CSS ────────────────────────────────────────────────────
  describe('app/globals.css', () => {
    let content: string;

    it('should not contain route marker styles', () => {
      content = readFile('app/globals.css');
      expect(content).not.toContain('.custom-route-marker');
      expect(content).not.toContain('.route-marker');
      expect(content).not.toContain('.route-marker-circle');
      expect(content).not.toContain('.route-marker-pointer');
    });

    it('should not contain Route Plan section comment', () => {
      content = readFile('app/globals.css');
      expect(content).not.toContain('Route Plan Numbered Markers');
    });

    it('should still contain station marker styles', () => {
      content = readFile('app/globals.css');
      expect(content).toContain('.custom-station-marker');
      expect(content).toContain('.station-marker');
    });

    it('should still contain location marker styles', () => {
      content = readFile('app/globals.css');
      expect(content).toContain('.location-marker');
    });
  });
});
