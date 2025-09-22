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

async function updateInspectionByStandard() {
  try {
    console.log('🔍 Reading Excel file...');

    // Read the Excel file
    const excelPath = path.join(__dirname, '..', 'data', '_Oper_ISO_11_FF11ChkSch_Export.xlsx');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const excelData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 Found ${excelData.length} rows in Excel`);

    // First, let's see what columns are available
    console.log('\n📋 Excel columns:');
    if (excelData.length > 0) {
      Object.keys(excelData[0]).forEach((key, index) => {
        console.log(`  ${index + 1}. ${key}`);
      });
    }

    // Filter Excel data by ผลการตรวจสอบ == 'ตรงตามมาตรฐาน'
    console.log('\n🔍 Filtering Excel data by ผลการตรวจสอบ == "ตรงตามมาตรฐาน"...');

    const standardCompliantStations = excelData.filter(row => {
      const result = row['ผลการตรวจสอบ'];
      return result === 'ตรงตามมาตรฐาน';
    });

    console.log(`✅ Found ${standardCompliantStations.length} stations with "ตรงตามมาตรฐาน"`);

    // Show some examples of ผลการตรวจสอบ values
    console.log('\n📊 Sample ผลการตรวจสอบ values:');
    const inspectionResults = new Set();
    excelData.forEach(row => {
      const result = row['ผลการตรวจสอบ'];
      if (result) inspectionResults.add(result);
    });

    Array.from(inspectionResults).slice(0, 10).forEach((result, index) => {
      console.log(`  ${index + 1}. "${result}"`);
    });

    if (standardCompliantStations.length === 0) {
      console.log('❌ No stations found with "ตรงตามมาตรฐาน". Exiting...');
      return;
    }

    // Get all stations from database
    console.log('\n🗄️ Fetching stations from database...');
    const { data: stations, error: fetchError } = await supabase
      .from('fm_station')
      .select('id_fm, inspection_68, date_inspected')
      .order('id_fm');

    if (fetchError) {
      console.error('Error fetching stations:', fetchError);
      return;
    }

    console.log(`📡 Found ${stations.length} stations in database`);

    // Create a map of database stations for faster lookup
    const stationMap = new Map();
    stations.forEach(station => {
      stationMap.set(station.id_fm, station);
    });

    let updatedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;

    console.log('\n🔄 Processing "ตรงตามมาตรฐาน" stations...\n');

    // Process each filtered Excel row
    for (const row of standardCompliantStations) {
      const rawStationCode = row['รหัสสถานี'];
      const inspectionDate = row['วันที่ตรวจสอบ'];
      const inspectionResult = row['ผลการตรวจสอบ'];

      if (!rawStationCode || !inspectionDate) {
        continue;
      }

      // Convert Excel string to number by removing leading "0"
      let stationId = null;
      const stationStr = String(rawStationCode);

      if (stationStr.startsWith('0')) {
        // Remove leading "0" and convert to number
        stationId = parseInt(stationStr.substring(1));
      } else {
        stationId = parseInt(stationStr);
      }

      // Find matching station in database
      const station = stationMap.get(stationId);

      if (!station) {
        console.log(`⚠️ Station ${rawStationCode} (converted to ${stationId}) not found in database`);
        notFoundCount++;
        continue;
      }

      // Check if we need to update this station
      const needsInspectionUpdate = station.inspection_68 !== 'ตรวจแล้ว';
      const needsDateUpdate = !station.date_inspected;

      if (!needsInspectionUpdate && !needsDateUpdate) {
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
          console.error(`Error converting date for station ${rawStationCode}:`, error);
        }
      }

      // Build update object
      const updates = {};

      if (needsInspectionUpdate) {
        updates.inspection_68 = 'ตรวจแล้ว';
      }

      if (needsDateUpdate && gregorianDate) {
        updates.date_inspected = gregorianDate;
      }

      if (Object.keys(updates).length === 0) {
        skippedCount++;
        continue;
      }

      console.log(`🔄 Updating station ${rawStationCode} (ID: ${stationId}) - Result: "${inspectionResult}":`, updates);

      const { error: updateError } = await supabase
        .from('fm_station')
        .update(updates)
        .eq('id_fm', stationId);

      if (updateError) {
        console.error(`❌ Error updating station ${rawStationCode}:`, updateError);
      } else {
        updatedCount++;
        console.log(`✅ Updated station ${rawStationCode} (ID: ${stationId})`);
      }
    }

    console.log('\n📈 Summary (ตรงตามมาตรฐาน stations only):');
    console.log(`✅ Updated: ${updatedCount} stations`);
    console.log(`⏭️ Skipped: ${skippedCount} stations (already up to date)`);
    console.log(`❌ Not found: ${notFoundCount} stations`);
    console.log(`📊 Total "ตรงตามมาตรฐาน" processed: ${updatedCount + skippedCount + notFoundCount} stations`);
    console.log(`📊 Total Excel rows: ${excelData.length} stations`);

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

updateInspectionByStandard();