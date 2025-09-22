const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  console.error('URL:', supabaseUrl);
  console.error('Service Key:', supabaseServiceKey ? 'Present' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addDateInspectedColumn() {
  try {
    console.log('Adding date_inspected column to fm_station table...');

    // Check if column already exists
    const { data: tableInfo, error: infoError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'fm_station')
      .eq('column_name', 'date_inspected');

    if (infoError) {
      console.error('Error checking existing columns:', infoError);
    }

    if (tableInfo && tableInfo.length > 0) {
      console.log('Column date_inspected already exists');
      return true;
    }

    // Use direct SQL query through database
    const { data, error } = await supabase
      .from('fm_station')
      .select('id_fm')
      .limit(1);

    if (error) {
      console.error('Error testing connection:', error);
      return false;
    }

    console.log('Database connection successful');
    console.log('Please execute this SQL manually in Supabase dashboard:');
    console.log('ALTER TABLE fm_station ADD COLUMN date_inspected DATE;');

    return true;
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
}

// Run the function
addDateInspectedColumn().then((success) => {
  if (success) {
    console.log('Please add the column manually through Supabase dashboard');
  } else {
    console.log('Database connection failed');
  }
});