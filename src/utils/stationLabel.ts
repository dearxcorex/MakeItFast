import type { FMStation } from '@/types/station';

/**
 * The identifier a field inspector recognises. Since
 * 2026-09-20-3-id-fm-holds-nbtc-code that is whatever `id_fm` holds: the official
 * NBTC code where the station has one, else its register StationID.
 *
 * A StationID is printed as `FM-5520003`; an NBTC code stands on its own.
 *
 * FMStation.id is the surrogate primary key (ADR 0003) -- an internal row
 * number with no meaning on a licence document, so it is never shown.
 */
export function stationLabel(station: Pick<FMStation, 'idFm'>): string {
  const code = station.idFm?.trim();
  if (!code) return '—';
  return /^\d+$/.test(code) ? `FM-${code}` : code;
}
