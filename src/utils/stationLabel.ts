import type { FMStation } from '@/types/station';

/**
 * The identifier a field inspector recognises, in the order they trust it:
 * the official NBTC code, else the register StationID, else nothing.
 *
 * FMStation.id is the surrogate primary key (ADR 0003) -- an internal row
 * number with no meaning on a licence document, so it is never shown.
 */
export function stationLabel(station: Pick<FMStation, 'nbtcCode' | 'idFm'>): string {
  if (station.nbtcCode) return station.nbtcCode;
  if (station.idFm !== undefined && station.idFm !== null) return `FM-${station.idFm}`;
  return '—';
}
