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

async function updateInspectionStatus() {
  try {
    console.log('🔍 Reading Excel file...');

    // Read the Excel file
    const excelPath = path.join(__dirname, '..', 'data', '_Oper_ISO_11_FF11ChkSch_Export.xlsx');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const excelData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 Found ${excelData.length} rows in Excel`);

    // Get all stations from database
    console.log('🗄️ Fetching stations from database...');
    const { data: stations, error: fetchError } = await supabase
      .from('fm_station')
      .select('id_fm, inspection_68, date_inspected')
      .order('id_fm');

    if (fetchError) {
      console.error('Error fetching stations:', fetchError);
      return;
    }

    console.log(`📡 Found ${stations.length} stations in database`);

    let updatedCount = 0;
    let skippedCount = 0;

    // Process each Excel row
    for (const row of excelData) {
      const stationCode = row['รหัสสถานี'];
      const inspectionDate = row['วันที่ตรวจสอบ'];

      if (!stationCode || !inspectionDate) {
        continue;
      }

      // Find matching station in database
      const station = stations.find(s => s.id_fm === stationCode);

      if (!station) {
        console.log(`⚠️ Station ${stationCode} not found in database`);
        continue;
      }

      // Check if we need to update this station
      const needsUpdate = station.inspection_68 !== 'ตรวจแล้ว' || !station.date_inspected;

      if (!needsUpdate) {
        skippedCount++;
        continue;
      }

      // Convert Buddhist era date to Gregorian
      let gregorianDate = null;
      if (inspectionDate) {
        try {
          const dateStr = inspectionDate.toString();
          if (dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/');
            const gregorianYear = parseInt(year) - 543;
            gregorianDate = `${gregorianYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        } catch (error) {
          console.error(`Error converting date for station ${stationCode}:`, error);
        }
      }

      // Update the station
      const updates = {
        inspection_68: 'ตรวจแล้ว'
      };

      // Only update date_inspected if it's currently null/empty and we have a valid date
      if (!station.date_inspected && gregorianDate) {
        updates.date_inspected = gregorianDate;
      }

      console.log(`🔄 Updating station ${stationCode}:`, updates);

      const { error: updateError } = await supabase
        .from('fm_station')
        .update(updates)
        .eq('id_fm', stationCode);

      if (updateError) {
        console.error(`❌ Error updating station ${stationCode}:`, updateError);
      } else {
        updatedCount++;
        console.log(`✅ Updated station ${stationCode}`);
      }
    }

    console.log('\n📈 Summary:');
    console.log(`✅ Updated: ${updatedCount} stations`);
    console.log(`⏭️ Skipped: ${skippedCount} stations (already up to date)`);
    console.log(`📊 Total processed: ${updatedCount + skippedCount} stations`);

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

updateInspectionStatus();