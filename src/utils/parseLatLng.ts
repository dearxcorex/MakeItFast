export type ParseLatLngResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; error: string };

/**
 * Parse two text inputs into a (lat, lng) pair.
 *
 * If `lngRaw` is empty and `latRaw` looks like a pasted "lat, lng" pair
 * (Google-Maps friendly), split on the comma.
 *
 * Heuristic for "looks like a pair": either the comma is followed by
 * whitespace ("13.756, 100.501") or the second token contains a decimal
 * point ("13.756,100.501"). This guards against Thai-locale users typing a
 * single decimal with a comma separator ("13,75") being silently parsed as
 * `(13, 75)`.
 *
 * Returns `{ ok: false, error }` for empty / non-numeric / out-of-range input.
 */
export function parseLatLngInput(latRaw: string, lngRaw: string): ParseLatLngResult {
  const latTrim = latRaw.trim();
  const lngTrim = lngRaw.trim();

  let lat: number;
  let lng: number;

  const looksLikePair =
    !lngTrim &&
    latTrim.includes(",") &&
    (/,\s/.test(latTrim) || /,[^,]*\./.test(latTrim));

  if (looksLikePair) {
    const [a, b] = latTrim.split(",").map((v) => v.trim());
    lat = parseFloat(a);
    lng = parseFloat(b);
  } else {
    lat = parseFloat(latTrim);
    lng = parseFloat(lngTrim);
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: `Invalid: ${(latTrim + " " + lngTrim).trim() || "empty"}` };
  }
  if (lat < -90 || lat > 90) {
    return { ok: false, error: "Lat out of range (-90..90)" };
  }
  if (lng < -180 || lng > 180) {
    return { ok: false, error: "Long out of range (-180..180)" };
  }
  return { ok: true, lat, lng };
}
