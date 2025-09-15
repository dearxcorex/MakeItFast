import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin client for checking recent updates
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function GET() {
  try {
    const adminClient = createAdminClient();

    // Get recent updates (last 10 seconds for polling)
    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();

    const { data, error } = await adminClient
      .from('fm_station')
      .select('id_fm, on_air, inspection_68, unwanted, submit_a_request')
      .gte('updated_at', tenSecondsAgo);

    if (error) {
      console.error('❌ Error fetching recent updates:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to match our interface
    const updates = data?.map(station => ({
      id: station.id_fm,
      onAir: station.on_air,
      inspection68: station.inspection_68,
      unwanted: station.unwanted === 'true' || station.unwanted === true,
      submitRequest: station.submit_a_request
    })) || [];

    return NextResponse.json({
      updated: updates,
      count: updates.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Recent updates API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent updates' },
      { status: 500 }
    );
  }
}