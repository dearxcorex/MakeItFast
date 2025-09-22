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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Function to convert Thai Buddhist Era date to Gregorian date
function convertThaiDateToGregorian(thaiDateStr) {
  if (!thaiDateStr) return null;

  try {
    const parts = thaiDateStr.split('/');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]) - 543; // Convert from Buddhist Era to Gregorian

    const gregorianDate = new Date(year, month - 1, day);
    return gregorianDate.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error converting date:', thaiDateStr, error);
    return null;
  }
}

async function testAndImportData() {
  try {
    console.log('🚀 Testing database access and importing data...\n');

    // Test database connection first
    console.log('🔌 Testing database connection...');
    const { data: testData, error: testError } = await supabase
      .from('fm_station')
      .select('id_fm, name')
      .limit(1);

    if (testError) {
      console.error('❌ Database connection failed:', testError);
      return;
    }

    console.log('✅ Database connection successful');
    console.log(`   Sample station: ${testData[0]?.name || 'Unknown'}`);

    // Try to check current table structure
    console.log('\n📋 Checking current table structure...');

    const { data: columnTest, error: columnError } = await supabase
      .from('fm_station')
      .select('id_fm, name, date_inspected')
      .limit(1);

    if (columnError) {
      if (columnError.message.includes('date_inspected') || columnError.code === '42703') {
        console.log('❌ Column date_inspected does not exist');
        console.log('\n🔧 Please add the column manually in Supabase SQL Editor:');
        console.log('   1. Go to: https://supabase.com/dashboard/project/iigbezvfqsfuuucvmopt/sql');
        console.log('   2. Execute: ALTER TABLE fm_station ADD COLUMN date_inspected DATE;');
        console.log('   3. Run this script again\n');
        return;
      } else {
        console.error('❌ Unexpected error:', columnError);
        return;
      }
    }

    console.log('✅ Column date_inspected exists!');

    // Now proceed with data import
    console.log('\n📊 Reading Excel file...');

    const filePath = path.join(__dirname, '../data/_Oper_ISO_11_FF11ChkSch_Export.xlsx');
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`   Found ${jsonData.length - 1} data rows`);

    // Get column indices
    const headers = jsonData[0];
    const stationIdIndex = headers.findIndex(h => h && h.includes('รหัสสถานี'));
    const inspectionDateIndex = headers.findIndex(h => h && h.includes('วันที่ตรวจสอบ'));

    if (stationIdIndex === -1 || inspectionDateIndex === -1) {
      console.error('❌ Required columns not found');
      return;
    }

    console.log('🔄 Starting data import...\n');

    let updateCount = 0;
    let errorCount = 0;
    let notFoundCount = 0;

    // Process all rows (or first 20 for testing)
    const maxRows = Math.min(jsonData.length, 21); // Process first 20 rows as test

    for (let i = 1; i < maxRows; i++) {
      const row = jsonData[i];
      const stationId = row[stationIdIndex];
      const thaiDate = row[inspectionDateIndex];

      if (!stationId || !thaiDate) {
        continue;
      }

      const gregorianDate = convertThaiDateToGregorian(thaiDate);
      if (!gregorianDate) {
        errorCount++;
        continue;
      }

      try {
        const { data, error } = await supabase
          .from('fm_station')
          .update({ date_inspected: gregorianDate })
          .eq('id_fm', parseInt(stationId))
          .select('id_fm, name');

        if (error) {
          console.error(`❌ Error updating ${stationId}: ${error.message}`);
          errorCount++;
        } else if (data && data.length > 0) {
          console.log(`✅ Updated ${stationId} (${data[0].name}): ${gregorianDate}`);
          updateCount++;
        } else {
          console.log(`⚠️  Station ${stationId} not found`);
          notFoundCount++;
        }
      } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        errorCount++;
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log('\n📋 === Import Summary ===');
    console.log(`✅ Successfully updated: ${updateCount}`);
    console.log(`⚠️  Not found: ${notFoundCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Processed: ${maxRows - 1} out of ${jsonData.length - 1} total rows`);

    if (updateCount > 0) {
      console.log('\n🎉 Data import successful!');
    }

  } catch (error) {
    console.error('💥 Error in testAndImportData:', error);
  }
}

// Run the script
testAndImportData().then(() => {
  console.log('\n🏁 Process completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Process failed:', error);
  process.exit(1);
});