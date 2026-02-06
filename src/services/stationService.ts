import prisma from '@/lib/prisma';
import type { FMStation } from '@/types/station';
import type { fm_station } from '@prisma/client';

// Convert database row to FMStation interface
export function convertToFMStation(row: fm_station): FMStation {
  return {
    id: row.id_fm,
    name: row.name || '',
    frequency: row.freq || 0,
    latitude: row.lat || 0,
    longitude: row.long || 0,
    city: row.district || '',
    state: row.province || '',
    genre: row.type?.trim() || '',
    type: row.type?.trim() || '',
    description: `${row.type?.trim() || ''} radio station in ${row.district || ''}, ${row.province || ''}`,
    website: undefined,
    transmitterPower: undefined,
    permit: undefined,
    inspection68: row.inspection_68 ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
    inspection69: row.inspection_69 ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
    dateInspected: row.date_inspected || undefined,
    details: row.note || undefined,
    onAir: row.on_air || false,
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

// Update station data in the database
export async function updateFMStation(stationId: number, updates: Partial<fm_station>): Promise<FMStation> {
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
