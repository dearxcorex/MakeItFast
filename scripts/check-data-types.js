const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkDataTypes() {
  try {
    console.log('🔍 Checking data types...\n');

    // 1. Check database id_fm types
    console.log('📊 Database id_fm samples:');
    const { data: stations, error: fetchError } = await supabase
      .from('fm_station')
      .select('id_fm')
      .limit(10)
      .order('id_fm');

    if (fetchError) {
      console.error('Error fetching stations:', fetchError);
      return;
    }

    stations.forEach((station, index) => {
      console.log(`  ${index + 1}. id_fm: ${station.id_fm} (type: ${typeof station.id_fm})`);
    });

    // 2. Check Excel รหัสสถานี types
    console.log('\n📊 Excel รหัสสถานี samples:');
    const excelPath = path.join(__dirname, '..', 'data', '_Oper_ISO_11_FF11ChkSch_Export.xlsx');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const excelData = XLSX.utils.sheet_to_json(worksheet);

    // Show first 10 entries
    excelData.slice(0, 10).forEach((row, index) => {
      const stationCode = row['รหัสสถานี'];
      console.log(`  ${index + 1}. รหัสสถานี: ${stationCode} (type: ${typeof stationCode})`);
    });

    // 3. Show all unique database id_fm values
    console.log('\n📊 All database id_fm values:');
    const { data: allStations, error: allError } = await supabase
      .from('fm_station')
      .select('id_fm')
      .order('id_fm');

    if (allError) {
      console.error('Error fetching all stations:', allError);
      return;
    }

    const dbIds = allStations.map(s => s.id_fm).sort((a, b) => {
      // Sort numerically if both are numbers, otherwise alphabetically
      const aNum = parseInt(a);
      const bNum = parseInt(b);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      return String(a).localeCompare(String(b));
    });

    console.log('Database id_fm values:', dbIds);

    // 4. Show all unique Excel รหัสสถานี values
    console.log('\n📊 All Excel รหัสสถานี values:');
    const excelIds = excelData.map(row => row['รหัสสถานี']).filter(Boolean).sort();
    console.log('Excel รหัสสถานี values (first 20):', excelIds.slice(0, 20));
    console.log(`...and ${excelIds.length - 20} more`);

    // 5. Check for potential matches
    console.log('\n🔍 Looking for potential matches...');
    let potentialMatches = 0;

    for (const excelId of excelIds) {
      // Try different matching strategies
      const excelStr = String(excelId);

      // Strategy 1: Direct match
      if (dbIds.includes(excelId)) {
        console.log(`✅ Direct match: ${excelId}`);
        potentialMatches++;
        continue;
      }

      // Strategy 2: Check if Excel ID ends with any DB ID
      for (const dbId of dbIds) {
        const dbStr = String(dbId);
        if (excelStr.endsWith(dbStr) && excelStr.length > dbStr.length) {
          console.log(`🔄 Potential match: Excel ${excelId} ends with DB ${dbId}`);
          potentialMatches++;
          break;
        }
      }
    }

    console.log(`\n📈 Summary: Found ${potentialMatches} potential matches out of ${excelIds.length} Excel entries and ${dbIds.length} database entries`);

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

checkDataTypes();