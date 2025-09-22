const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function convertThaiDateToGregorian(thaiDateStr) {
  if (!thaiDateStr) return null;
  try {
    const parts = thaiDateStr.split('/');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]) - 543; // Convert Buddhist Era to Gregorian

    const gregorianDate = new Date(year, month - 1, day);
    return gregorianDate.toISOString().split('T')[0];
  } catch (error) {
    return null;
  }
}

async function importInspectionDates() {
  try {
    console.log('🚀 Starting inspection date import...\n');

    // Verify column exists
    console.log('🔍 Verifying database setup...');
    const { data: testData, error: testError } = await supabase
      .from('fm_station')
      .select('id_fm, name, date_inspected')
      .limit(1);

    if (testError) {
      console.error('❌ Column date_inspected does not exist!');
      console.log('\n🔧 Please add it first:');
      console.log('   Visit: https://supabase.com/dashboard/project/iigbezvfqsfuuucvmopt/sql');
      console.log('   Execute: ALTER TABLE fm_station ADD COLUMN date_inspected DATE;');
      return;
    }

    console.log('✅ Database setup verified');

    // Read Excel file
    console.log('\n📊 Reading Excel data...');
    const filePath = path.join(__dirname, '../data/_Oper_ISO_11_FF11ChkSch_Export.xlsx');
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const headers = jsonData[0];
    const stationIdIndex = headers.findIndex(h => h && h.includes('รหัสสถานี'));
    const inspectionDateIndex = headers.findIndex(h => h && h.includes('วันที่ตรวจสอบ'));

    console.log(`   📁 Found ${jsonData.length - 1} records to process`);
    console.log(`   🏷️  Station ID column: ${stationIdIndex}`);
    console.log(`   📅 Inspection date column: ${inspectionDateIndex}`);

    // Process data
    console.log('\n🔄 Processing records...\n');

    let stats = {
      processed: 0,
      updated: 0,
      notFound: 0,
      errors: 0,
      skipped: 0
    };

    // Process ALL records (not just test subset)
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const stationId = row[stationIdIndex];
      const thaiDate = row[inspectionDateIndex];

      stats.processed++;

      if (!stationId || !thaiDate) {
        stats.skipped++;
        continue;
      }

      const gregorianDate = convertThaiDateToGregorian(thaiDate);
      if (!gregorianDate) {
        console.log(`⚠️  Row ${i}: Invalid date format "${thaiDate}"`);
        stats.errors++;
        continue;
      }

      try {
        const { data, error } = await supabase
          .from('fm_station')
          .update({ date_inspected: gregorianDate })
          .eq('id_fm', parseInt(stationId))
          .select('id_fm, name');

        if (error) {
          console.log(`❌ Row ${i}: Error updating station ${stationId} - ${error.message}`);
          stats.errors++;
        } else if (data && data.length > 0) {
          console.log(`✅ Station ${stationId} (${data[0].name}) → ${gregorianDate}`);
          stats.updated++;
        } else {
          console.log(`❓ Station ${stationId} not found in database`);
          stats.notFound++;
        }
      } catch (error) {
        console.log(`💥 Row ${i}: Exception - ${error.message}`);
        stats.errors++;
      }

      // Progress indicator
      if (i % 20 === 0) {
        console.log(`\n📊 Progress: ${i}/${jsonData.length - 1} rows processed...\n`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Final summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 IMPORT COMPLETE!');
    console.log('='.repeat(50));
    console.log(`📊 Total records processed: ${stats.processed}`);
    console.log(`✅ Successfully updated: ${stats.updated}`);
    console.log(`❓ Stations not found: ${stats.notFound}`);
    console.log(`⚠️  Errors encountered: ${stats.errors}`);
    console.log(`⏭️  Records skipped: ${stats.skipped}`);
    console.log('='.repeat(50));

    if (stats.updated > 0) {
      console.log('\n🎯 Next Steps:');
      console.log('   1. Run: npm run dev');
      console.log('   2. Click on station markers to see inspection dates');
      console.log('   3. Dates will appear as "Inspected: [date]" in popups');
    }

  } catch (error) {
    console.error('💥 Fatal error:', error);
  }
}

// Run with confirmation
console.log('📋 Inspection Date Import Tool');
console.log('🎯 This will update ALL stations with inspection dates from Excel file');

importInspectionDates().then(() => {
  console.log('\n🏁 Process completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Process failed:', error);
  process.exit(1);
});