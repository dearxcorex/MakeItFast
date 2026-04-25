import { describe, it, expect } from 'vitest';
import { clusterTone } from '@/utils/clusterIcon';

describe('clusterTone', () => {
  it('buckets small clusters at <= 10', () => {
    expect(clusterTone(1)).toBe('small');
    expect(clusterTone(10)).toBe('small');
  });

  it('buckets medium clusters at 11..50', () => {
    expect(clusterTone(11)).toBe('medium');
    expect(clusterTone(50)).toBe('medium');
  });

  it('buckets large clusters at > 50', () => {
    expect(clusterTone(51)).toBe('large');
    expect(clusterTone(500)).toBe('large');
  });
});
