import prisma from '@/lib/prisma';
import type { FMStation } from '@/types/station';
import type { fm_station } from '@prisma/client';

// Convert database row to FMStation interface
export function convertToFMStation(row: fm_station): FMStation {
  return {
    id: row.id,
    idFm: row.id_fm?.trim() || undefined,
    name: row.name || '',
    frequency: row.freq || 0,
    latitude: row.lat ?? NaN,
    longitude: row.long ?? NaN,
    city: row.district || '',
    state: row.province || '',
    genre: row.type?.trim() || '',
    type: row.type?.trim() || '',
    description: `${row.type?.trim() || ''} radio station in ${row.district || ''}, ${row.province || ''}`,
    website: undefined,
    transmitterPower: undefined,
    permit: row.permit ?? undefined,
    inspection69: row.inspection_69 ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
    dateInspected: row.date_inspected || undefined,
    onAir: row.on_air || false,
    submitRequest: row.submit_a_request ? 'ยื่น' : 'ไม่ยื่น',
    revoked: row.revoked === true,
    revokedNote: row.revoked_note ?? undefined,
    createdAt: undefined,
    updatedAt: undefined,
  };
}

export async function fetchFMStationById(id: number): Promise<FMStation | null> {
  try {
    const data = await prisma.fm_station.findUnique({
      where: { id },
    });
    if (!data) return null;
    return convertToFMStation(data);
  } catch (error) {
    console.error('Service error fetching FM station:', error);
    return null;
  }
}
