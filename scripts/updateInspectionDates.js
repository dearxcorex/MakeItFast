const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Function to convert Thai Buddhist Era date to Gregorian date
function convertThaiDateToGregorian(thaiDateStr) {
  if (!thaiDateStr) return null;

  try {
    // Thai date format: DD/MM/YYYY (Buddhist Era)
    const parts = thaiDateStr.split('/');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]) - 543; // Convert from Buddhist Era to Gregorian

    // Format as YYYY-MM-DD for PostgreSQL
    const gregorianDate = new Date(year, month - 1, day);
    return gregorianDate.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error converting date:', thaiDateStr, error);
    return null;
  }
}

async function updateInspectionDates() {
  try {
    console.log('Reading Excel file...');

    // Read the Excel file
    const filePath = path.join(__dirname, '../data/_Oper_ISO_11_FF11ChkSch_Export.xlsx');
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`Found ${jsonData.length - 1} data rows in Excel file`);

    // Get column indices
    const headers = jsonData[0];
    const stationIdIndex = headers.findIndex(h => h && h.includes('รหัสสถานี'));
    const inspectionDateIndex = headers.findIndex(h => h && h.includes('วันที่ตรวจสอบ'));

    if (stationIdIndex === -1 || inspectionDateIndex === -1) {
      console.error('Required columns not found');
      return;
    }

    console.log(`Station ID column index: ${stationIdIndex}`);
    console.log(`Inspection date column index: ${inspectionDateIndex}`);

    // Process each row
    let updateCount = 0;
    let errorCount = 0;

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const stationId = row[stationIdIndex];
      const thaiDate = row[inspectionDateIndex];

      if (!stationId || !thaiDate) {
        console.log(`Row ${i}: Missing station ID or date, skipping`);
        continue;
      }

      // Convert Thai date to Gregorian
      const gregorianDate = convertThaiDateToGregorian(thaiDate);

      if (!gregorianDate) {
        console.error(`Row ${i}: Invalid date format: ${thaiDate}`);
        errorCount++;
        continue;
      }

      try {
        // Update the database
        const { data, error } = await supabase
          .from('fm_station')
          .update({ date_inspected: gregorianDate })
          .eq('id_fm', parseInt(stationId))
          .select('id_fm, name');

        if (error) {
          console.error(`Error updating station ${stationId}:`, error.message);
          errorCount++;
        } else if (data && data.length > 0) {
          console.log(`✓ Updated station ${stationId} (${data[0].name}): ${thaiDate} → ${gregorianDate}`);
          updateCount++;
        } else {
          console.log(`⚠ Station ${stationId} not found in database`);
        }
      } catch (error) {
        console.error(`Error updating station ${stationId}:`, error);
        errorCount++;
      }

      // Add small delay to avoid rate limiting
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('\n=== Update Summary ===');
    console.log(`Total rows processed: ${jsonData.length - 1}`);
    console.log(`Successfully updated: ${updateCount}`);
    console.log(`Errors: ${errorCount}`);

  } catch (error) {
    console.error('Error in updateInspectionDates:', error);
  }
}

// Run the script
console.log('Starting inspection date update process...');
updateInspectionDates().then(() => {
  console.log('Process completed');
  process.exit(0);
}).catch(error => {
  console.error('Process failed:', error);
  process.exit(1);
});