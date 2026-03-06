import { describe, it, expect } from 'vitest';
import { getRankingColor } from '@/utils/interferenceMapHelpers';

describe('getRankingColor', () => {
  it('returns red for Critical', () => {
    expect(getRankingColor('Critical')).toBe('#EF4444');
    expect(getRankingColor('critical')).toBe('#EF4444');
  });

  it('returns amber for Major', () => {
    expect(getRankingColor('Major')).toBe('#F59E0B');
    expect(getRankingColor('major')).toBe('#F59E0B');
  });

  it('returns yellow for Minor', () => {
    expect(getRankingColor('Minor')).toBe('#FACC15');
    expect(getRankingColor('minor')).toBe('#FACC15');
  });

  it('returns grey for unknown ranking', () => {
    expect(getRankingColor('Unknown')).toBe('#6B7280');
    expect(getRankingColor(null)).toBe('#6B7280');
  });
});
