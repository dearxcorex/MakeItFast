const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkInspectionCount() {
  try {
    console.log('🔍 Checking inspection counts in database...\n');

    // Get all stations
    const { data: allStations, error: allError } = await supabase
      .from('fm_station')
      .select('id_fm, inspection_68, submit_a_request')
      .order('id_fm');

    if (allError) {
      console.error('Error fetching stations:', allError);
      return;
    }

    console.log(`📊 Total stations in database: ${allStations.length}`);

    // Count inspected stations (all)
    const inspectedAll = allStations.filter(station => station.inspection_68 === 'ตรวจแล้ว');
    console.log(`✅ Total inspected stations: ${inspectedAll.length}`);

    // Count inspected stations (excluding submit_a_request == 'ไม่ยื่น')
    const inspectedExcludingNotSubmitted = allStations.filter(station =>
      station.inspection_68 === 'ตรวจแล้ว' && station.submit_a_request !== 'ไม่ยื่น'
    );
    console.log(`✅ Inspected stations (excluding 'ไม่ยื่น'): ${inspectedExcludingNotSubmitted.length}`);

    // Count pending stations (excluding submit_a_request == 'ไม่ยื่น')
    const pendingExcludingNotSubmitted = allStations.filter(station =>
      station.inspection_68 === 'ยังไม่ตรวจ' && station.submit_a_request !== 'ไม่ยื่น'
    );
    console.log(`⏳ Pending stations (excluding 'ไม่ยื่น'): ${pendingExcludingNotSubmitted.length}`);

    // Count stations with submit_a_request == 'ไม่ยื่น'
    const notSubmitted = allStations.filter(station => station.submit_a_request === 'ไม่ยื่น');
    console.log(`❌ Stations with 'ไม่ยื่น': ${notSubmitted.length}`);

    console.log('\n📋 Breakdown by inspection status:');
    const inspectionBreakdown = {};
    allStations.forEach(station => {
      const status = station.inspection_68 || 'null/undefined';
      if (!inspectionBreakdown[status]) {
        inspectionBreakdown[status] = 0;
      }
      inspectionBreakdown[status]++;
    });

    Object.entries(inspectionBreakdown).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    console.log('\n📋 Breakdown by submit_a_request:');
    const submitBreakdown = {};
    allStations.forEach(station => {
      const status = station.submit_a_request || 'null/undefined';
      if (!submitBreakdown[status]) {
        submitBreakdown[status] = 0;
      }
      submitBreakdown[status]++;
    });

    Object.entries(submitBreakdown).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    // Show inspected stations that might have submit_a_request == 'ไม่ยื่น'
    console.log('\n🔍 Inspected stations with submit_a_request == "ไม่ยื่น":');
    const inspectedButNotSubmitted = allStations.filter(station =>
      station.inspection_68 === 'ตรวจแล้ว' && station.submit_a_request === 'ไม่ยื่น'
    );

    if (inspectedButNotSubmitted.length > 0) {
      console.log(`Found ${inspectedButNotSubmitted.length} stations:`);
      inspectedButNotSubmitted.forEach(station => {
        console.log(`  Station ID: ${station.id_fm}`);
      });
    } else {
      console.log('None found.');
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

checkInspectionCount();