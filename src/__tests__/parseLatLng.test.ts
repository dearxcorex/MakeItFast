import { describe, it, expect } from 'vitest';
import { parseLatLngInput } from '@/utils/parseLatLng';

describe('parseLatLngInput', () => {
  it('parses two separate fields', () => {
    expect(parseLatLngInput('13.756', '100.501')).toEqual({
      ok: true,
      lat: 13.756,
      lng: 100.501,
    });
  });

  it('parses comma-paste in the LAT field when LONG is empty', () => {
    expect(parseLatLngInput('13.756, 100.501', '')).toEqual({
      ok: true,
      lat: 13.756,
      lng: 100.501,
    });
  });

  it('strips surrounding whitespace from both fields', () => {
    expect(parseLatLngInput('  13.756 ', '  100.501 ')).toEqual({
      ok: true,
      lat: 13.756,
      lng: 100.501,
    });
  });

  it('accepts negative values', () => {
    expect(parseLatLngInput('-33.8688', '151.2093')).toEqual({
      ok: true,
      lat: -33.8688,
      lng: 151.2093,
    });
  });

  it('rejects empty input', () => {
    const r = parseLatLngInput('', '');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/invalid/i);
  });

  it('rejects non-numeric input', () => {
    const r = parseLatLngInput('abc', '100');
    expect(r.ok).toBe(false);
  });

  it('rejects lat out of range', () => {
    const r = parseLatLngInput('91', '0');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/lat/i);
  });

  it('rejects long out of range', () => {
    const r = parseLatLngInput('0', '181');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/long/i);
  });

  it('accepts boundary values lat=±90 long=±180', () => {
    expect(parseLatLngInput('90', '180').ok).toBe(true);
    expect(parseLatLngInput('-90', '-180').ok).toBe(true);
  });

  it('comma-paste with extra whitespace still parses', () => {
    expect(parseLatLngInput('  13.756 ,   100.501  ', '')).toEqual({
      ok: true,
      lat: 13.756,
      lng: 100.501,
    });
  });

  it('does NOT split a Thai-locale single decimal "13,75" as (13, 75)', () => {
    // Comma is not followed by whitespace AND second token has no decimal —
    // treat as a single (malformed) lat number, with empty lng.
    const r = parseLatLngInput('13,75', '');
    expect(r.ok).toBe(false);
  });

  it('parses "13.756,100.501" (no whitespace, decimal in lng) as a pair', () => {
    expect(parseLatLngInput('13.756,100.501', '')).toEqual({
      ok: true,
      lat: 13.756,
      lng: 100.501,
    });
  });

  it('parses "13,100.5" as a pair when second token has a decimal', () => {
    // No whitespace after comma, but the second part has a decimal point —
    // unambiguous as a paired paste.
    expect(parseLatLngInput('13,100.5', '')).toEqual({
      ok: true,
      lat: 13,
      lng: 100.5,
    });
  });
});
