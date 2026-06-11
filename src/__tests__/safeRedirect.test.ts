import { describe, it, expect } from 'vitest';
import { safeNextPath } from '@/lib/safeRedirect';

describe('safeNextPath', () => {
  it('returns a plain relative path unchanged', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard');
  });

  it('falls back to "/" for null or missing input', () => {
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath(undefined)).toBe('/');
    expect(safeNextPath('')).toBe('/');
  });

  it('rejects absolute URLs', () => {
    expect(safeNextPath('https://evil.com')).toBe('/');
    expect(safeNextPath('http://evil.com/path')).toBe('/');
  });

  it('rejects protocol-relative URLs', () => {
    expect(safeNextPath('//evil.com')).toBe('/');
    expect(safeNextPath('//evil.com/path')).toBe('/');
  });

  it('rejects backslash tricks that browsers normalize to "//"', () => {
    expect(safeNextPath('/\\evil.com')).toBe('/');
    expect(safeNextPath('\\/evil.com')).toBe('/');
  });

  it('rejects non-path strings', () => {
    expect(safeNextPath('javascript:alert(1)')).toBe('/');
    expect(safeNextPath('foo/bar')).toBe('/');
    expect(safeNextPath('mailto:x@y.com')).toBe('/');
  });

  it('rejects control-char bypasses that browsers strip from URLs', () => {
    // Browsers remove tab/newline/CR, so "/\t/evil.com" becomes "//evil.com".
    expect(safeNextPath('/\t/evil.com')).toBe('/');
    expect(safeNextPath('/\n/evil.com')).toBe('/');
    expect(safeNextPath('/\r/evil.com')).toBe('/');
  });

  it('preserves query string and hash on a safe path', () => {
    expect(safeNextPath('/stations?tab=fm&sort=dist#top')).toBe(
      '/stations?tab=fm&sort=dist#top',
    );
  });
});
