/**
 * Key for "the same point on the map". Markers that share it are drawn as one
 * pin, so the map and the detail panels must all group by this and nothing
 * else. Five decimals is about one metre.
 */
export function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}
