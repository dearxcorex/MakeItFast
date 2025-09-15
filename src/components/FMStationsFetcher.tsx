import { createClient } from '@supabase/supabase-js';
import OptimizedFMStationClient from './OptimizedFMStationClient';

// Create admin client with service role key (server-side only)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminClient = createClient(supabaseUrl, serviceKey);

export default async function FMStationsFetcher() {
  // Fetch FM stations and filter data using service role key (bypasses RLS)
  // Add cache control to ensure fresh data on each request
  const [stationResult, onAirResult, cityResult, provinceResult, inspectionResult] = await Promise.all([
    adminClient.from('fm_station').select('*').order('name'),
    adminClient.from('fm_station').select('on_air').order('on_air'),
    adminClient.from('fm_station').select('district').order('district'),
    adminClient.from('fm_station').select('province').order('province'),
    adminClient.from('fm_station').select('inspection_68').order('inspection_68')
  ]);

  if (stationResult.error) {
    console.error('Error fetching FM stations with service key:', stationResult.error);
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
              <p className="text-muted-foreground mb-4">{stationResult.error.message}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Transform stations data to match our interface
  const transformedStations = stationResult.data?.map(station => ({
    id: station.id_fm,
    name: station.name,
    frequency: station.freq,
    latitude: station.lat,
    longitude: station.long,
    city: station.district,
    state: station.province,
    genre: station.type?.trim(),
    type: station.type?.trim(), // Station type (e.g., "สถานีหลัก", "สถานีสาขา")
    description: `${station.type?.trim()} radio station in ${station.district}, ${station.province}`,
    website: undefined,
    transmitterPower: undefined,
    permit: station.permit,
    inspection67: station.inspection_67,
    inspection68: station.inspection_68,
    onAir: station.on_air,
    unwanted: station.unwanted === 'true' || station.unwanted === true,
    submitRequest: station.submit_a_request,
    createdAt: undefined,
    updatedAt: undefined,
  })) || [];

  // Extract unique filter data
  const onAirStatuses = Array.from(new Set(onAirResult.data?.map(item => item.on_air).filter(item => item !== null && item !== undefined))) || [];
  const cities = Array.from(new Set(cityResult.data?.map(item => item.district).filter(Boolean))) || [];
  const provinces = Array.from(new Set(provinceResult.data?.map(item => item.province).filter(Boolean))) || [];
  const inspectionStatuses = Array.from(new Set(inspectionResult.data?.map(item => item.inspection_68).filter(Boolean))) || [];

  return (
    <OptimizedFMStationClient 
      initialStations={transformedStations}
      initialOnAirStatuses={onAirStatuses}
      initialCities={cities}
      initialProvinces={provinces}
      initialInspectionStatuses={inspectionStatuses}
    />
  );
}