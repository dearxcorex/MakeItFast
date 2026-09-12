import { describe, it, expect } from 'vitest';
import {
  AVIATION_BANDS,
  AVIATION_BAND_RANGE,
  FM_BAND_RANGE,
  COMMON_AVIATION_FREQUENCIES,
} from '@/types/intermod';

// ---------- intermod constants ----------

describe('Intermod constants', () => {
  it('AVIATION_BANDS has correct ranges for all services', () => {
    expect(AVIATION_BANDS['VOR/ILS']).toEqual({ min: 108.0, max: 117.95 });
    expect(AVIATION_BANDS['Emergency']).toEqual({ min: 121.5, max: 121.5 });
    expect(AVIATION_BANDS['ATC Voice']).toEqual({ min: 118.0, max: 137.0 });
  });

  it('AVIATION_BAND_RANGE covers 108-137 MHz', () => {
    expect(AVIATION_BAND_RANGE).toEqual({ min: 108.0, max: 137.0 });
  });

  it('FM_BAND_RANGE covers 87.5-108 MHz', () => {
    expect(FM_BAND_RANGE).toEqual({ min: 87.5, max: 108.0 });
  });

  it('COMMON_AVIATION_FREQUENCIES has entries with required fields', () => {
    expect(COMMON_AVIATION_FREQUENCIES.length).toBeGreaterThan(0);
    for (const entry of COMMON_AVIATION_FREQUENCIES) {
      expect(entry).toHaveProperty('frequency');
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('service');
      expect(typeof entry.frequency).toBe('number');
    }
  });

  it('all COMMON_AVIATION_FREQUENCIES fall within AVIATION_BAND_RANGE', () => {
    for (const entry of COMMON_AVIATION_FREQUENCIES) {
      expect(entry.frequency).toBeGreaterThanOrEqual(AVIATION_BAND_RANGE.min);
      expect(entry.frequency).toBeLessThanOrEqual(AVIATION_BAND_RANGE.max);
    }
  });
});
