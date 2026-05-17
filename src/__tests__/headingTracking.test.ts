import { describe, it, expect } from 'vitest';
import {
  initialHeadingState,
  updateHeading,
} from '@/utils/headingTracking';

describe('headingTracking', () => {
  describe('initialHeadingState', () => {
    it('returns a fresh state with null heading and stale=false', () => {
      const s = initialHeadingState();
      expect(s.heading).toBeNull();
      expect(s.stale).toBe(false);
      expect(s.lastPosition).toBeNull();
    });
  });

  describe('updateHeading', () => {
    it('accepts non-null GPS heading when speed is at or above threshold', () => {
      const next = updateHeading(
        initialHeadingState(),
        { lat: 13.7, lng: 100.5, heading: 90, speed: 5 },
        1000
      );
      expect(next.heading).toBe(90);
      expect(next.stale).toBe(false);
      expect(next.lastPosition).toEqual({ lat: 13.7, lng: 100.5 });
    });

    it('marks stale when heading is null and speed is below threshold', () => {
      const seeded = updateHeading(
        initialHeadingState(),
        { lat: 13.7, lng: 100.5, heading: 45, speed: 5 },
        1000
      );
      const next = updateHeading(
        seeded,
        { lat: 13.7, lng: 100.5, heading: null, speed: 0 },
        2000
      );
      expect(next.heading).toBe(45);
      expect(next.stale).toBe(true);
    });

    it('falls back to position-bearing when distance is large and heading is null', () => {
      const start = updateHeading(
        initialHeadingState(),
        { lat: 13.7, lng: 100.5, heading: 0, speed: 5 },
        1000
      );
      // ~10 m east of starting point at lat 13.7
      const lngStep = 10 / (111000 * Math.cos((13.7 * Math.PI) / 180));
      const east = {
        lat: 13.7,
        lng: 100.5 + lngStep,
        heading: null,
        speed: null,
      };
      const next = updateHeading(start, east, 2000);
      expect(next.stale).toBe(false);
      expect(next.heading).not.toBeNull();
      expect(next.heading!).toBeGreaterThan(0);
      expect(next.heading!).toBeLessThan(180);
    });

    it('keeps stale when null heading and movement is below the bearing threshold', () => {
      const seeded = updateHeading(
        initialHeadingState(),
        { lat: 13.7, lng: 100.5, heading: 180, speed: 5 },
        1000
      );
      const next = updateHeading(
        seeded,
        { lat: 13.70000009, lng: 100.5, heading: null, speed: 0 },
        2000
      );
      expect(next.heading).toBe(180);
      expect(next.stale).toBe(true);
    });

    it('smooths through 0/360 wraparound (358 -> 2)', () => {
      const seeded = updateHeading(
        initialHeadingState(),
        { lat: 13.7, lng: 100.5, heading: 358, speed: 5 },
        1000
      );
      const next = updateHeading(
        seeded,
        { lat: 13.7001, lng: 100.5, heading: 2, speed: 5 },
        2000
      );
      expect(next.heading).toBeCloseTo(359.2, 1);
    });

    it('normalizes heading into [0, 360)', () => {
      const seeded = updateHeading(
        initialHeadingState(),
        { lat: 13.7, lng: 100.5, heading: 5, speed: 5 },
        1000
      );
      const next = updateHeading(
        seeded,
        { lat: 13.7001, lng: 100.5, heading: 355, speed: 5 },
        2000
      );
      expect(next.heading!).toBeGreaterThanOrEqual(0);
      expect(next.heading!).toBeLessThan(360);
    });

    it('seeds lastPosition even when first sample has no heading', () => {
      const next = updateHeading(
        initialHeadingState(),
        { lat: 1, lng: 2, heading: null, speed: null },
        0
      );
      expect(next.lastPosition).toEqual({ lat: 1, lng: 2 });
      expect(next.heading).toBeNull();
      expect(next.stale).toBe(false);
    });

    it('simulates a typical drive sequence: cold start → moving → stopped → moving', () => {
      let state = updateHeading(
        initialHeadingState(),
        { lat: 13.7, lng: 100.5, heading: null, speed: 0 },
        0
      );
      expect(state.heading).toBeNull();
      expect(state.stale).toBe(false);

      state = updateHeading(
        state,
        { lat: 13.701, lng: 100.5, heading: 0, speed: 10 },
        1000
      );
      expect(state.heading).toBe(0);
      expect(state.stale).toBe(false);

      state = updateHeading(
        state,
        { lat: 13.702, lng: 100.5, heading: 5, speed: 10 },
        2000
      );
      expect(state.heading).toBeCloseTo(1.5, 1);
      expect(state.stale).toBe(false);

      state = updateHeading(
        state,
        { lat: 13.702, lng: 100.5, heading: null, speed: 0 },
        3000
      );
      expect(state.heading).toBeCloseTo(1.5, 1);
      expect(state.stale).toBe(true);

      state = updateHeading(
        state,
        { lat: 13.702, lng: 100.501, heading: 90, speed: 8 },
        4000
      );
      expect(state.stale).toBe(false);
      expect(state.heading!).toBeGreaterThan(1.5);
      expect(state.heading!).toBeLessThan(90);
    });
  });
});
