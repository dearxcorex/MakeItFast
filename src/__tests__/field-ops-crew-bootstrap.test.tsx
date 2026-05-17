// src/__tests__/field-ops-crew-bootstrap.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import FieldOpsClient from '@/components/field-ops/FieldOpsClient';
import type { FMStation } from '@/types/station';

// AnalyticsDashboard uses ResizeObserver via charts; jsdom lacks it.
vi.mock('@/components/analytics/AnalyticsDashboard', () => ({ default: () => null }));

// Skip the dynamic Leaflet map — tests don't need real geo behavior.
vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const stations: FMStation[] = [
  {
    id: 5520117,
    name: 'เสียงชนเสรี',
    frequency: 106,
    latitude: 14.96,
    longitude: 102.07,
    city: 'คง',
    state: 'นครราชสีมา',
    genre: 'ธุรกิจ',
    type: 'ธุรกิจ',
    inspection69: 'ยังไม่ตรวจ',
    onAir: true,
  },
];

const inspectors = [
  { id: 3, username: 'iff', displayName: 'iff' },
  { id: 6, username: 'daf', displayName: 'daf' },
  { id: 7, username: 'ice', displayName: 'ice' },
];

const currentUser = { id: 3, displayName: 'iff' };

beforeEach(() => {
  // jsdom provides localStorage but some environments need explicit stubbing
  // when the component accesses it during effect execution.
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  });

  global.fetch = vi.fn(async (url: string) => {
    if (url.toString().endsWith('/api/users/inspectors')) {
      return new Response(JSON.stringify({ users: inspectors }), { status: 200 });
    }
    if (url.toString().endsWith('/api/users/me/crew')) {
      return new Response(JSON.stringify({ defaultHelperUserIds: null }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  }) as never;
});

describe('FieldOpsClient — crew bootstrap', () => {
  it('opens the modal when defaultHelperUserIds is null', async () => {
    const { container } = render(
      <FieldOpsClient
        initialStations={stations}
        initialInterference={[]}
        initialCities={[]}
        initialProvinces={[]}
        currentUser={currentUser}
      />,
    );
    await waitFor(() => {
      expect(container.textContent).toContain('Tag your default crew');
    });
  });

  it('does NOT open the modal when defaultHelperUserIds is []', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.toString().endsWith('/api/users/inspectors')) {
        return new Response(JSON.stringify({ users: inspectors }), { status: 200 });
      }
      if (url.toString().endsWith('/api/users/me/crew')) {
        return new Response(JSON.stringify({ defaultHelperUserIds: [] }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }) as never;

    const { container } = render(
      <FieldOpsClient
        initialStations={stations}
        initialInterference={[]}
        initialCities={[]}
        initialProvinces={[]}
        currentUser={currentUser}
      />,
    );
    // Allow the bootstrap fetch to resolve.
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/users/me/crew');
    });
    // Give the state update a microtask tick to flush.
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).not.toContain('Tag your default crew');
  });

  it('does NOT open the modal when defaultHelperUserIds is non-empty', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.toString().endsWith('/api/users/inspectors')) {
        return new Response(JSON.stringify({ users: inspectors }), { status: 200 });
      }
      if (url.toString().endsWith('/api/users/me/crew')) {
        return new Response(JSON.stringify({ defaultHelperUserIds: [6, 7] }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }) as never;

    const { container } = render(
      <FieldOpsClient
        initialStations={stations}
        initialInterference={[]}
        initialCities={[]}
        initialProvinces={[]}
        currentUser={currentUser}
      />,
    );
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/users/me/crew');
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).not.toContain('Tag your default crew');
  });

  it('opens the modal on fetch failure (fail-open)', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.toString().endsWith('/api/users/inspectors')) {
        return new Response(JSON.stringify({ users: inspectors }), { status: 200 });
      }
      if (url.toString().endsWith('/api/users/me/crew')) {
        throw new Error('network down');
      }
      return new Response('{}', { status: 404 });
    }) as never;

    const { container } = render(
      <FieldOpsClient
        initialStations={stations}
        initialInterference={[]}
        initialCities={[]}
        initialProvinces={[]}
        currentUser={currentUser}
      />,
    );
    await waitFor(() => {
      expect(container.textContent).toContain('Tag your default crew');
    });
  });
});
