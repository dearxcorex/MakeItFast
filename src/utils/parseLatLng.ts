export type ParseLatLngResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; error: string };

/**
 * Parse two text inputs into a (lat, lng) pair.
 *
 * If `lngRaw` is empty and `latRaw` contains a comma, treat `latRaw` as a
 * pasted "lat, lng" pair (Google-Maps friendly).
 *
 * Returns `{ ok: false, error }` for empty / non-numeric / out-of-range input.
 */
export function parseLatLngInput(latRaw: string, lngRaw: string): ParseLatLngResult {
  const latTrim = latRaw.trim();
  const lngTrim = lngRaw.trim();

  let lat: number;
  let lng: number;

  if (!lngTrim && latTrim.includes(",")) {
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
