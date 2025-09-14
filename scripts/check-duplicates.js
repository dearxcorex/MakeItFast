// Test script to check for duplicate coordinates in the database
const { createClient } = require('@supabase/supabase-js');

async function checkDuplicates() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    console.log('Fetching stations from database...');
    const { data: stations, error } = await supabase
      .from('fm_station')
      .select('id_fm, name, freq, lat, long, district, province')
      .order('name');

    if (error) {
      console.error('Error fetching stations:', error.message);
      return;
    }

    if (!stations || stations.length === 0) {
      console.log('No stations found in database.');
      return;
    }

    console.log(`Found ${stations.length} stations`);

    // Group by coordinates
    const coordMap = new Map();

    stations.forEach(station => {
      const coordKey = `${station.lat},${station.long}`;
      if (coordMap.has(coordKey)) {
        coordMap.get(coordKey).push(station);
      } else {
        coordMap.set(coordKey, [station]);
      }
    });

    // Find duplicates
    const duplicates = [];
    coordMap.forEach((stationGroup, coordKey) => {
      if (stationGroup.length > 1) {
        duplicates.push({ coordinate: coordKey, stations: stationGroup });
      }
    });

    console.log(`\nFound ${duplicates.length} locations with duplicate coordinates:`);

    duplicates.forEach(({ coordinate, stations }) => {
      const [lat, lng] = coordinate.split(',');
      console.log(`\n📍 Location: ${lat}, ${lng} (${stations.length} stations)`);
      stations.forEach(station => {
        console.log(`  - ${station.name} (${station.freq} FM) - ${station.district}, ${station.province}`);
      });
    });

    if (duplicates.length === 0) {
      console.log('\n✅ No duplicate coordinates found!');
    } else {
      console.log(`\n🔄 Found ${duplicates.reduce((sum, d) => sum + d.stations.length, 0)} stations in ${duplicates.length} duplicate locations`);
    }

  } catch (error) {
    console.error('Script error:', error);
  }
}

checkDuplicates();