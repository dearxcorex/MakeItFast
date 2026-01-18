import prisma from '@/lib/prisma';
import type { FMStation } from '@/types/station';
import type { fm_station } from '@prisma/client';

// Convert database row to FMStation interface
function convertToFMStation(row: fm_station): FMStation {
  return {
    id: row.id_fm,
    name: row.name || '',
    frequency: row.freq || 0,
    latitude: row.lat || 0,
    longitude: row.long || 0,
    city: row.district || '',
    state: row.province || '',
    genre: row.type || '',
    type: row.type || '',
    description: `${row.type || ''} radio station in ${row.district || ''}, ${row.province || ''}`,
    website: undefined,
    transmitterPower: undefined,
    permit: row.permit || undefined,
    inspection67: row.inspection_67 ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
    inspection68: row.inspection_68 ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
    dateInspected: row.date_inspected || undefined,
    details: undefined,
    onAir: row.on_air || false,
    unwanted: row.unwanted || false,
    submitRequest: row.submit_a_request ? 'ยื่น' : 'ไม่ยื่น',
    createdAt: undefined,
    updatedAt: undefined,
  };
}

export async function fetchFMStations(): Promise<FMStation[]> {
  try {
    const data = await prisma.fm_station.findMany({
      orderBy: { name: 'asc' },
    });
    return data.map(convertToFMStation);
  } catch (error) {
    console.error('Service error fetching FM stations:', error);
    throw error;
  }
}

export async function fetchFMStationById(id: number): Promise<FMStation | null> {
  try {
    const data = await prisma.fm_station.findUnique({
      where: { id_fm: id },
    });
    if (!data) return null;
    return convertToFMStation(data);
  } catch (error) {
    console.error('Service error fetching FM station:', error);
    return null;
  }
}

export async function fetchFMStationsByGenre(genre: string): Promise<FMStation[]> {
  try {
    const data = await prisma.fm_station.findMany({
      where: { type: genre },
      orderBy: { name: 'asc' },
    });
    return data.map(convertToFMStation);
  } catch (error) {
    console.error('Service error fetching FM stations by genre:', error);
    throw error;
  }
}

export async function fetchFMStationsByCity(city: string): Promise<FMStation[]> {
  try {
    const data = await prisma.fm_station.findMany({
      where: { district: city },
      orderBy: { name: 'asc' },
    });
    return data.map(convertToFMStation);
  } catch (error) {
    console.error('Service error fetching FM stations by city:', error);
    throw error;
  }
}

export async function fetchUniqueGenres(): Promise<string[]> {
  try {
    const data = await prisma.fm_station.findMany({
      select: { type: true },
      distinct: ['type'],
      orderBy: { type: 'asc' },
    });
    return data.map(item => item.type).filter((t): t is string => t !== null);
  } catch (error) {
    console.error('Service error fetching genres:', error);
    return [];
  }
}

export async function fetchUniqueCities(): Promise<string[]> {
  try {
    const data = await prisma.fm_station.findMany({
      select: { district: true },
      distinct: ['district'],
      orderBy: { district: 'asc' },
    });
    return data.map(item => item.district).filter((d): d is string => d !== null);
  } catch (error) {
    console.error('Service error fetching cities:', error);
    return [];
  }
}

export async function fetchUniqueProvinces(): Promise<string[]> {
  try {
    const data = await prisma.fm_station.findMany({
      select: { province: true },
      distinct: ['province'],
      orderBy: { province: 'asc' },
    });
    return data.map(item => item.province).filter((p): p is string => p !== null);
  } catch (error) {
    console.error('Service error fetching provinces:', error);
    return [];
  }
}

export async function fetchUniqueInspectionStatuses(): Promise<string[]> {
  return ['ตรวจแล้ว', 'ยังไม่ตรวจ'];
}

export async function fetchFMStationsByProvince(province: string): Promise<FMStation[]> {
  try {
    const data = await prisma.fm_station.findMany({
      where: { province },
      orderBy: { name: 'asc' },
    });
    return data.map(convertToFMStation);
  } catch (error) {
    console.error('Service error fetching FM stations by province:', error);
    throw error;
  }
}

export async function fetchFMStationsByInspectionStatus(status: string): Promise<FMStation[]> {
  try {
    const isInspected = status === 'ตรวจแล้ว';
    const data = await prisma.fm_station.findMany({
      where: { inspection_68: isInspected },
      orderBy: { name: 'asc' },
    });
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
export async function updateFMStation(stationId: number, updates: Partial<fm_station>): Promise<FMStation | null> {
  try {
    const data = await prisma.fm_station.update({
      where: { id_fm: stationId },
      data: updates,
    });
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
export async function updateStationInspectionStatus(stationId: number, inspected: boolean): Promise<FMStation | null> {
  return updateFMStation(stationId, { inspection_68: inspected });
}
