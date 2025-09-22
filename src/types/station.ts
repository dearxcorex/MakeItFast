export interface FMStation {
  id: string | number;
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
  inspection67?: string;
  inspection68?: string;
  dateInspected?: string; // Date when the station was inspected (from วันที่ตรวจสอบ column)
  details?: string; // Hashtags like #deviation, #intermod for station details
  onAir?: boolean;
  unwanted?: boolean;
  submitRequest?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
}

export type FilterType = {
  onAir?: boolean;
  city?: string;
  province?: string;
  inspection?: string;
  inspection68?: string;
  search?: string;
  submitRequest?: string;
}