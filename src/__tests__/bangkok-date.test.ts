// src/__tests__/bangkok-date.test.ts
import { describe, it, expect } from 'vitest';
import { bangkokToday } from '@/utils/bangkokDate';

describe('bangkokToday', () => {
  it('rolls over to the next day at 00:00 Bangkok (17:00 UTC)', () => {
    expect(bangkokToday(new Date('2026-09-12T16:59:59Z'))).toBe('2026-09-12');
    expect(bangkokToday(new Date('2026-09-12T17:00:00Z'))).toBe('2026-09-13');
  });

  it('keeps an early-morning field inspection on its own Thai date', () => {
    // 06:30 Bangkok on 13 Sep is still 12 Sep in UTC
    expect(bangkokToday(new Date('2026-09-12T23:30:00Z'))).toBe('2026-09-13');
  });

  it('crosses month and year boundaries', () => {
    expect(bangkokToday(new Date('2026-12-31T18:00:00Z'))).toBe('2027-01-01');
  });
});
