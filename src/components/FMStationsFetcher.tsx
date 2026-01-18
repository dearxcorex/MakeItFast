import prisma from '@/lib/prisma';
import OptimizedFMStationClient from './OptimizedFMStationClient';

export default async function FMStationsFetcher() {
  try {
    // Fetch FM stations and filter data using Prisma
    const [stations, onAirData, cityData, provinceData] = await Promise.all([
      prisma.fm_station.findMany({ orderBy: { name: 'asc' } }),
      prisma.fm_station.findMany({ select: { on_air: true }, distinct: ['on_air'] }),
      prisma.fm_station.findMany({ select: { district: true }, distinct: ['district'], orderBy: { district: 'asc' } }),
      prisma.fm_station.findMany({ select: { province: true }, distinct: ['province'], orderBy: { province: 'asc' } }),
    ]);

    // Transform stations data to match our interface
    const transformedStations = stations.map(station => ({
      id: station.id_fm,
      name: station.name || '',
      frequency: station.freq || 0,
      latitude: station.lat || 0,
      longitude: station.long || 0,
      city: station.district || '',
      state: station.province || '',
      genre: station.type?.trim() || '',
      type: station.type?.trim() || '',
      description: `${station.type?.trim() || ''} radio station in ${station.district || ''}, ${station.province || ''}`,
      website: undefined,
      transmitterPower: undefined,
      permit: station.permit || undefined,
      inspection67: station.inspection_67 ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
      inspection68: station.inspection_68 ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
      dateInspected: station.date_inspected || undefined,
      details: undefined,
      onAir: station.on_air || false,
      unwanted: station.unwanted || false,
      submitRequest: station.submit_a_request ? 'ยื่น' : 'ไม่ยื่น',
      createdAt: undefined,
      updatedAt: undefined,
    }));

    // Extract unique filter data
    const onAirStatuses = onAirData.map(item => item.on_air).filter((item): item is boolean => item !== null);
    const cities = cityData.map(item => item.district).filter((item): item is string => item !== null);
    const provinces = provinceData.map(item => item.province).filter((item): item is string => item !== null);
    const inspectionStatuses = ['ตรวจแล้ว', 'ยังไม่ตรวจ'];

    return (
      <OptimizedFMStationClient
        initialStations={transformedStations}
        initialOnAirStatuses={onAirStatuses}
        initialCities={cities}
        initialProvinces={provinces}
        initialInspectionStatuses={inspectionStatuses}
      />
    );
  } catch (error) {
    console.error('Error fetching FM stations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const hasDbUrl = !!process.env.DATABASE_URL;

    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center max-w-md px-6">
            <div className="w-16 h-16 bg-destructive/20 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Database Error</h2>
              <p className="text-muted-foreground mb-2">Failed to connect to database</p>
              <p className="text-xs text-muted-foreground/70">
                {hasDbUrl ? 'DATABASE_URL is set' : 'DATABASE_URL is missing'}
              </p>
              <p className="text-xs text-destructive/70 mt-2 break-all">
                {errorMessage}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
