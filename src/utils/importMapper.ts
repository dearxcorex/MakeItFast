/**
 * Maps CSV row columns to interference_site database fields.
 * Handles the actual CSV column names from the 2600 AWN interference spreadsheet.
 */

function parseFloatSafe(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(String(value));
  return isNaN(num) ? null : num;
}

function parseStringSafe(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

export function mapCsvRowToRecord(row: Record<string, unknown>) {
  return {
    site_code: parseStringSafe(row['Site'] ?? row['Site Code'] ?? row['site_code']),
    site_name: parseStringSafe(row['Site name'] ?? row['Site Name'] ?? row['site_name']),
    lat: parseFloatSafe(row['Lat'] ?? row['lat']),
    long: parseFloatSafe(row['Long'] ?? row['long']),
    mc_zone: parseStringSafe(row['MC_ZONE'] ?? row['MC Zone'] ?? row['mc_zone']),
    changwat: parseStringSafe(row['CHANGWAT'] ?? row['Changwat'] ?? row['changwat']),
    cell_name: parseStringSafe(row['Cell Name'] ?? row['cell_name']),
    sector_name: parseStringSafe(row['Sector name'] ?? row['Sector Name'] ?? row['sector_name']),
    direction: parseFloatSafe(row['Direction'] ?? row['direction']),
    avg_ni_carrier: parseFloatSafe(row['Average NI of Carrier'] ?? row['Avg NI Carrier'] ?? row['avg_ni_carrier']),
    day_time: parseFloatSafe(row['Day time'] ?? row['Day Time'] ?? row['day_time']),
    night_time: parseFloatSafe(row['Night time'] ?? row['Night Time'] ?? row['night_time']),
    source_lat: parseFloatSafe(row['Latitude source'] ?? row['Source Lat'] ?? row['source_lat']),
    source_long: parseFloatSafe(row['Longitude source'] ?? row['Source Long'] ?? row['source_long']),
    // CSV is in meters, convert to km for UI display
    estimate_distance: (() => {
      const meters = parseFloatSafe(row['Estimate Distance (m.)'] ?? row['Estimate Distance'] ?? row['estimate_distance']);
      return meters !== null ? meters / 1000 : null;
    })(),
    ranking: parseStringSafe(row['Ranking'] ?? row['ranking']),
    status: parseStringSafe(row['Status'] ?? row['status']),
    nbtc_area: parseStringSafe(row['NBTC Area'] ?? row['nbtc_area']),
    awn_contact: parseStringSafe(row['AWN Contact'] ?? row['awn_contact']),
    lot: parseStringSafe(row['Lot'] ?? row['lot']),
    on_site_scan_by: parseStringSafe(row['On Site scan by'] ?? row['On Site Scan By'] ?? row['on_site_scan_by']),
    on_site_scan_date: parseStringSafe(row['On Site SCAN Date'] ?? row['On Site Scan Date'] ?? row['on_site_scan_date']),
    check_realtime: parseStringSafe(row['Check Real time'] ?? row['Check Realtime'] ?? row['check_realtime']),
    source_location_1: parseStringSafe(row['สถานที่เจอ # 1'] ?? row['Source Location 1'] ?? row['source_location_1']),
    source_location_2: parseStringSafe(row['สถานที่เจอ # 2'] ?? row['Source Location 2'] ?? row['source_location_2']),
    camera_model_1: parseStringSafe(row['Camera Model # 1'] ?? row['Camera Model 1'] ?? row['camera_model_1']),
    camera_model_2: parseStringSafe(row['Camera Model #2'] ?? row['Camera Model 2'] ?? row['camera_model_2']),
    notes: parseStringSafe(row['หมายเหตุ'] ?? row['Notes'] ?? row['notes']),
  };
}
