import { supabase } from '@/lib/supabase';
import type { FMStation } from '@/types/station';

// Database row interface
interface FMStationRow {
  id_fm: number;
  name: string;
  freq: number;
  lat: number;
  long: number;
  district: string;
  province: string;
  type: string;
  permit?: string;
  inspection_67?: string;
  inspection_68?: string;
  on_air: boolean;
  unwanted: string | boolean;
  submit_a_request: string | boolean;
}

// Convert database row to FMStation interface
function convertToFMStation(row: FMStationRow): FMStation {
  return {
    id: row.id_fm,
    name: row.name,
    frequency: row.freq,
    latitude: row.lat,
    longitude: row.long,
    city: row.district,
    state: row.province,
    genre: row.type,
    description: `${row.type} radio station in ${row.district}, ${row.province}`,
    website: undefined,
    transmitterPower: undefined,
    permit: row.permit,
    inspection67: row.inspection_67,
    inspection68: row.inspection_68,
    onAir: row.on_air,
    unwanted: row.unwanted === 'true' || row.unwanted === true,
    submitRequest: typeof row.submit_a_request === 'string' ? row.submit_a_request : (row.submit_a_request ? 'ไม่ยื่น' : ''),
    createdAt: undefined,
    updatedAt: undefined,
  };
}

export async function fetchFMStations(): Promise<FMStation[]> {
  try {
    const { data, error } = await supabase
      .from('fm_station')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching FM stations:', error);
      throw new Error(`Failed to fetch FM stations: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map(convertToFMStation);
  } catch (error) {
    console.error('Service error fetching FM stations:', error);
    throw error;
  }
}

export async function fetchFMStationById(id: number): Promise<FMStation | null> {
  try {
    const { data, error } = await supabase
      .from('fm_station')
      .select('*')
      .eq('id_fm', id)
      .single();

    if (error) {
      console.error('Error fetching FM station:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return convertToFMStation(data);
  } catch (error) {
    console.error('Service error fetching FM station:', error);
    return null;
  }
}

export async function fetchFMStationsByGenre(genre: string): Promise<FMStation[]> {
  try {
    const { data, error } = await supabase
      .from('fm_station')
      .select('*')
      .eq('type', genre)
      .order('name');

    if (error) {
      console.error('Error fetching FM stations by genre:', error);
      throw new Error(`Failed to fetch FM stations: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map(convertToFMStation);
  } catch (error) {
    console.error('Service error fetching FM stations by genre:', error);
    throw error;
  }
}

export async function fetchFMStationsByCity(city: string): Promise<FMStation[]> {
  try {
    const { data, error } = await supabase
      .from('fm_station')
      .select('*')
      .eq('district', city)
      .order('name');

    if (error) {
      console.error('Error fetching FM stations by city:', error);
      throw new Error(`Failed to fetch FM stations: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map(convertToFMStation);
  } catch (error) {
    console.error('Service error fetching FM stations by city:', error);
    throw error;
  }
}

// Get unique genres from database
export async function fetchUniqueGenres(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('fm_station')
      .select('type')
      .order('type');

    if (error) {
      console.error('Error fetching genres:', error);
      return [];
    }

    if (!data) {
      return [];
    }

    // Extract unique genres (using type column)
    const genres = Array.from(new Set(data.map(item => item.type))).filter(Boolean);
    return genres;
  } catch (error) {
    console.error('Service error fetching genres:', error);
    return [];
  }
}

// Get unique cities from database
export async function fetchUniqueCities(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('fm_station')
      .select('district')
      .order('district');

    if (error) {
      console.error('Error fetching cities:', error);
      return [];
    }

    if (!data) {
      return [];
    }

    // Extract unique cities (using district column)
    const cities = Array.from(new Set(data.map(item => item.district))).filter(Boolean);
    return cities;
  } catch (error) {
    console.error('Service error fetching cities:', error);
    return [];
  }
}

// Get unique provinces from database
export async function fetchUniqueProvinces(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('fm_station')
      .select('province')
      .order('province');

    if (error) {
      console.error('Error fetching provinces:', error);
      return [];
    }

    if (!data) {
      return [];
    }

    // Extract unique provinces
    const provinces = Array.from(new Set(data.map(item => item.province))).filter(Boolean);
    return provinces;
  } catch (error) {
    console.error('Service error fetching provinces:', error);
    return [];
  }
}

// Get unique inspection_68 statuses from database
export async function fetchUniqueInspectionStatuses(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('fm_station')
      .select('inspection_68')
      .order('inspection_68');

    if (error) {
      console.error('Error fetching inspection statuses:', error);
      return [];
    }

    if (!data) {
      return [];
    }

    // Extract unique inspection_68 statuses
    const statuses = Array.from(new Set(data.map(item => item.inspection_68))).filter(Boolean);
    return statuses;
  } catch (error) {
    console.error('Service error fetching inspection statuses:', error);
    return [];
  }
}

// Filter stations by province
export async function fetchFMStationsByProvince(province: string): Promise<FMStation[]> {
  try {
    const { data, error } = await supabase
      .from('fm_station')
      .select('*')
      .eq('province', province)
      .order('name');

    if (error) {
      console.error('Error fetching FM stations by province:', error);
      throw new Error(`Failed to fetch FM stations: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map(convertToFMStation);
  } catch (error) {
    console.error('Service error fetching FM stations by province:', error);
    throw error;
  }
}

// Filter stations by inspection_68 status
export async function fetchFMStationsByInspectionStatus(status: string): Promise<FMStation[]> {
  try {
    const { data, error } = await supabase
      .from('fm_station')
      .select('*')
      .eq('inspection_68', status)
      .order('name');

    if (error) {
      console.error('Error fetching FM stations by inspection status:', error);
      throw new Error(`Failed to fetch FM stations: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map(convertToFMStation);
  } catch (error) {
    console.error('Service error fetching FM stations by inspection status:', error);
    throw error;
  }
}

// Group stations by identical coordinates
export function groupStationsByCoordinates(stations: FMStation[]): Map<string, FMStation[]> {
  const groupedStations = new Map<string, FMStation[]>();

  stations.forEach(station => {
    const coordKey = `${station.latitude},${station.longitude}`;

    if (groupedStations.has(coordKey)) {
      groupedStations.get(coordKey)!.push(station);
    } else {
      groupedStations.set(coordKey, [station]);
    }
  });

  return groupedStations;
}

// Check for duplicate coordinates in the database
export async function checkDuplicateCoordinates(): Promise<{[key: string]: FMStation[]}> {
  try {
    const stations = await fetchFMStations();
    const grouped = groupStationsByCoordinates(stations);
    const duplicates: {[key: string]: FMStation[]} = {};

    grouped.forEach((stationGroup, coordKey) => {
      if (stationGroup.length > 1) {
        duplicates[coordKey] = stationGroup;
      }
    });

    return duplicates;
  } catch (error) {
    console.error('Error checking duplicate coordinates:', error);
    return {};
  }
}

// Update station data in the database
export async function updateFMStation(stationId: number, updates: Partial<FMStationRow>): Promise<FMStation | null> {
  try {
    const { data, error } = await supabase
      .from('fm_station')
      .update(updates)
      .eq('id_fm', stationId)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating FM station:', error);
      throw new Error(`Failed to update FM station: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return convertToFMStation(data);
  } catch (error) {
    console.error('Service error updating FM station:', error);
    throw error;
  }
}

// Update station on_air status
export async function updateStationOnAirStatus(stationId: number, onAir: boolean): Promise<FMStation | null> {
  return updateFMStation(stationId, { on_air: onAir });
}

// Update station inspection status
export async function updateStationInspectionStatus(stationId: number, inspectionStatus: string): Promise<FMStation | null> {
  return updateFMStation(stationId, { inspection_68: inspectionStatus });
}