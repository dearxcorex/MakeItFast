export interface FMStation {
  /** fm_station.id — the surrogate primary key. Internal: URLs and React keys. */
  id: string | number;
  /** fm_station.id_fm — the NBTC register StationID. Undefined until the station is in the register. */
  idFm?: number;
  name: string;
  frequency: number;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  genre: string;
  type?: string; // Station type (e.g., "สถานีหลัก", "สถานีสาขา")
  description?: string;
  website?: string;
  transmitterPower?: number; // in watts
  permit?: string;
  nbtcCode?: string; // fm_station.nbtc_code — the official NBTC code, shown as the station ID
  inspection69?: string;
  dateInspected?: string; // Date when the station was inspected
  onAir?: boolean;
  submitRequest?: string;
  revoked?: boolean;
  revokedNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
  stale?: boolean;
}
