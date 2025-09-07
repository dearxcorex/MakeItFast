import { supabase, type FMStationRow } from '@/lib/supabase';
import type { FMStation } from '@/types/station';

// Convert database row to FMStation interface
function convertToFMStation(row: any): FMStation {
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
    submitRequest: row.submit_a_request === 'true' || row.submit_a_request === true,
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