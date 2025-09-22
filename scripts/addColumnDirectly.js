const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addColumn() {
  try {
    console.log('🔧 Attempting to add date_inspected column...');

    // Try creating a function that adds the column
    const { data: functionData, error: functionError } = await supabase.rpc('exec', {
      sql: `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'fm_station'
            AND column_name = 'date_inspected'
          ) THEN
            ALTER TABLE fm_station ADD COLUMN date_inspected DATE;
            RAISE NOTICE 'Column date_inspected added successfully';
          ELSE
            RAISE NOTICE 'Column date_inspected already exists';
          END IF;
        END
        $$;
      `
    });

    if (functionError) {
      console.log('❌ Direct SQL execution failed:', functionError.message);

      // Try alternative approach - test if we can execute any custom function
      console.log('\n🔄 Trying alternative approach...');

      const { data: testData, error: testError } = await supabase
        .rpc('version');

      if (testError) {
        console.log('❌ RPC functions not available:', testError.message);
      } else {
        console.log('✅ RPC functions work, but custom SQL execution is restricted');
      }

      console.log('\n⚠️  The column needs to be added manually. Here are the options:');
      console.log('\n📝 Option 1: Supabase Dashboard SQL Editor');
      console.log('   1. Visit: https://supabase.com/dashboard/project/iigbezvfqsfuuucvmopt/sql');
      console.log('   2. Paste: ALTER TABLE fm_station ADD COLUMN date_inspected DATE;');
      console.log('   3. Click "Run"');

      console.log('\n📝 Option 2: Table Editor');
      console.log('   1. Visit: https://supabase.com/dashboard/project/iigbezvfqsfuuucvmopt/editor');
      console.log('   2. Click on "fm_station" table');
      console.log('   3. Click "+ Add Column"');
      console.log('   4. Name: date_inspected, Type: date, Nullable: true');

      return false;
    }

    console.log('✅ Column added successfully!');
    return true;

  } catch (error) {
    console.error('💥 Error:', error);
    return false;
  }
}

addColumn().then((success) => {
  if (success) {
    console.log('\n🎉 Ready to run data import!');
    console.log('Run: node scripts/directDbUpdate.js');
  }
  process.exit(0);
});