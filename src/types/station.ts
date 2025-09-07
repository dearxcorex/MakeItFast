export interface FMStation {
  id: string | number;
  name: string;
  frequency: number;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  genre: string;
  description?: string;
  website?: string;
  transmitterPower?: number; // in watts
  permit?: string;
  inspection67?: string;
  inspection68?: string;
  onAir?: boolean;
  unwanted?: boolean;
  submitRequest?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export type FilterType = {
  onAir: string;
  city: string;
  province: string;
  inspection: string;
  search: string;
}