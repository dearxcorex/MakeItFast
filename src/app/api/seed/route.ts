import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;


if (!supabaseUrl || !serviceKey) {
  console.error('Missing environment variables');
}

// Create admin client with service role key (server-side only)
const adminClient = supabaseUrl && serviceKey 
  ? createClient(supabaseUrl, serviceKey)
  : null;

const sampleStations = [
  {
    id_fm: 1,
    name: 'Radio Thailand',
    freq: 92.5,
    type: 'Public',
    permit: 'PERMIT001',
    district: 'Dusit',
    province: 'Bangkok',
    lat: 13.7563,
    long: 100.5018,
    inspection_67: 'Passed',
    unwanted: false,
    submit_a_request: false,
    inspection_68: 'Passed',
    on_air: true
  },
  {
    id_fm: 2,
    name: 'Cool Fahrenheit',
    freq: 93.0,
    type: 'Commercial',
    permit: 'PERMIT002',
    district: 'Chatuchak',
    province: 'Bangkok',
    lat: 13.8025,
    long: 100.5538,
    inspection_67: 'Passed',
    unwanted: false,
    submit_a_request: false,
    inspection_68: 'Passed',
    on_air: true
  },
  {
    id_fm: 3,
    name: 'Green Wave',
    freq: 106.5,
    type: 'Commercial',
    permit: 'PERMIT003',
    district: 'Huai Khwang',
    province: 'Bangkok',
    lat: 13.7658,
    long: 100.5700,
    inspection_67: 'Passed',
    unwanted: false,
    submit_a_request: false,
    inspection_68: 'Pending',
    on_air: true
  },
  {
    id_fm: 4,
    name: 'Vintage FM',
    freq: 95.5,
    type: 'Community',
    permit: 'PERMIT004',
    district: 'Wang Thonglang',
    province: 'Bangkok',
    lat: 13.7878,
    long: 100.6058,
    inspection_67: 'Passed',
    unwanted: false,
    submit_a_request: true,
    inspection_68: 'Passed',
    on_air: true
  },
  {
    id_fm: 5,
    name: 'EFM Radio',
    freq: 104.5,
    type: 'Commercial',
    permit: 'PERMIT005',
    district: 'Lat Phrao',
    province: 'Bangkok',
    lat: 13.8198,
    long: 100.6098,
    inspection_67: 'Passed',
    unwanted: false,
    submit_a_request: false,
    inspection_68: 'Passed',
    on_air: true
  },
  {
    id_fm: 6,
    name: 'Kiss FM',
    freq: 91.5,
    type: 'Commercial',
    permit: 'PERMIT006',
    district: 'Pathum Wan',
    province: 'Bangkok',
    lat: 13.7460,
    long: 100.5350,
    inspection_67: 'Passed',
    unwanted: false,
    submit_a_request: false,
    inspection_68: 'Passed',
    on_air: true
  },
  {
    id_fm: 7,
    name: 'JS100',
    freq: 100.5,
    type: 'Commercial',
    permit: 'PERMIT007',
    district: 'Bang Rak',
    province: 'Bangkok',
    lat: 13.7240,
    long: 100.5260,
    inspection_67: 'Passed',
    unwanted: false,
    submit_a_request: false,
    inspection_68: 'Passed',
    on_air: true
  },
  {
    id_fm: 8,
    name: 'Chill FM',
    freq: 89.0,
    type: 'Commercial',
    permit: 'PERMIT008',
    district: 'Sathon',
    province: 'Bangkok',
    lat: 13.7200,
    long: 100.5310,
    inspection_67: 'Passed',
    unwanted: false,
    submit_a_request: false,
    inspection_68: 'Passed',
    on_air: true
  },
  {
    id_fm: 9,
    name: 'Hitz 955',
    freq: 95.0,
    type: 'Commercial',
    permit: 'PERMIT009',
    district: 'Phaya Thai',
    province: 'Bangkok',
    lat: 13.7590,
    long: 100.5350,
    inspection_67: 'Failed',
    unwanted: true,
    submit_a_request: false,
    inspection_68: 'Pending',
    on_air: false
  },
  {
    id_fm: 10,
    name: 'Fat Radio',
    freq: 104.5,
    type: 'Commercial',
    permit: 'PERMIT010',
    district: 'Ratchathewi',
    province: 'Bangkok',
    lat: 13.7550,
    long: 100.5300,
    inspection_67: 'Passed',
    unwanted: false,
    submit_a_request: false,
    inspection_68: 'Passed',
    on_air: true
  }
];

export async function POST() {
  try {
    
    // Check if admin client is available
    if (!adminClient) {
      console.error('Admin client not available');
      return NextResponse.json(
        { error: 'Database connection not configured. Missing environment variables.' },
        { status: 500 }
      );
    }

    
    // Clear existing data first - using name field instead of id since id doesn't exist
    const { error: deleteError } = await adminClient
      .from('fm_station')
      .delete()
      .neq('name', ''); // Delete all records (where name is not empty)

    if (deleteError) {
      console.error('Delete error:', deleteError);
      // Don't fail on delete error - table might be empty
    }


    // Insert new data
    const { data, error } = await adminClient
      .from('fm_station')
      .insert(sampleStations)
      .select();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json(
        { error: `Insert failed: ${error.message}`, details: error },
        { status: 500 }
      );
    }


    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${data?.length || 0} FM stations!`,
      data: data
    });

  } catch (err) {
    return NextResponse.json(
      { error: `Seeding failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}