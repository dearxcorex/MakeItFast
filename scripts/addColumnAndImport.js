const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config();

// Initialize Supabase client with service role key
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

async function addColumnAndImportData() {
  try {
    console.log('🚀 Starting database setup and data import...\n');

    // Step 1: Add the column using raw SQL query
    console.log('📋 Step 1: Adding date_inspected column...');

    // First, let's try to query the table to see if column exists
    try {
      const { data: testData, error: testError } = await supabase
        .from('fm_station')
        .select('date_inspected')
        .limit(1);

      if (testError && testError.message.includes('date_inspected')) {
        console.log('   Column does not exist, attempting to add it...');

        // Try to add column using a stored procedure or function
        const { data: addResult, error: addError } = await supabase.rpc('execute_sql', {
          query: 'ALTER TABLE fm_station ADD COLUMN date_inspected DATE;'
        });

        if (addError) {
          console.log('   ⚠️  Cannot add column via API. Please execute this SQL manually in Supabase:');
          console.log('   ALTER TABLE fm_station ADD COLUMN date_inspected DATE;\n');
          console.log('   Then re-run this script.\n');
          return;
        }

        console.log('   ✅ Column added successfully');
      } else {
        console.log('   ✅ Column already exists or accessible');
      }
    } catch (error) {
      console.log('   ⚠️  Column may not exist. Attempting to proceed with data import...');
    }

    // Step 2: Read and process Excel data
    console.log('📊 Step 2: Reading Excel file...');

    const filePath = path.join(__dirname, '../data/_Oper_ISO_11_FF11ChkSch_Export.xlsx');
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`   Found ${jsonData.length - 1} data rows in Excel file`);

    // Get column indices
    const headers = jsonData[0];
    const stationIdIndex = headers.findIndex(h => h && h.includes('รหัสสถานี'));
    const inspectionDateIndex = headers.findIndex(h => h && h.includes('วันที่ตรวจสอบ'));

    if (stationIdIndex === -1 || inspectionDateIndex === -1) {
      console.error('   ❌ Required columns not found in Excel file');
      return;
    }

    console.log(`   Station ID column: ${stationIdIndex}, Inspection date column: ${inspectionDateIndex}`);

    // Step 3: Update database records
    console.log('\n🔄 Step 3: Updating station records...');

    let updateCount = 0;
    let errorCount = 0;
    let notFoundCount = 0;

    for (let i = 1; i < Math.min(jsonData.length, 11); i++) { // Test with first 10 rows
      const row = jsonData[i];
      const stationId = row[stationIdIndex];
      const thaiDate = row[inspectionDateIndex];

      if (!stationId || !thaiDate) {
        console.log(`   Row ${i}: Missing data, skipping`);
        continue;
      }

      // Convert Thai date to Gregorian
      const gregorianDate = convertThaiDateToGregorian(thaiDate);

      if (!gregorianDate) {
        console.error(`   Row ${i}: Invalid date format: ${thaiDate}`);
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
          console.error(`   ❌ Error updating station ${stationId}: ${error.message}`);
          errorCount++;
        } else if (data && data.length > 0) {
          console.log(`   ✅ Updated station ${stationId} (${data[0].name}): ${thaiDate} → ${gregorianDate}`);
          updateCount++;
        } else {
          console.log(`   ⚠️  Station ${stationId} not found in database`);
          notFoundCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error updating station ${stationId}:`, error.message);
        errorCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📋 === Update Summary (First 10 records) ===');
    console.log(`✅ Successfully updated: ${updateCount}`);
    console.log(`⚠️  Not found: ${notFoundCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    if (updateCount > 0) {
      console.log('\n🎉 Test successful! To import all records, modify the script to process all rows.');
    }

  } catch (error) {
    console.error('❌ Error in addColumnAndImportData:', error);
  }
}

// Run the script
addColumnAndImportData().then(() => {
  console.log('\n🏁 Process completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Process failed:', error);
  process.exit(1);
});