import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin client with service role key for database updates
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const stationId = parseInt(id);
    if (isNaN(stationId)) {
      return NextResponse.json({ error: 'Invalid station ID' }, { status: 400 });
    }

    const body = await request.json();
    const { onAir, inspection68 } = body;

    // Build update object with only provided fields
    const updates: Record<string, boolean | string> = {};
    if (onAir !== undefined) updates.on_air = onAir;
    if (inspection68 !== undefined) updates.inspection_68 = inspection68;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    console.log(`Updating station ${stationId} with:`, updates);

    const { data, error } = await adminClient
      .from('fm_station')
      .update(updates)
      .eq('id_fm', stationId)
      .select('*')
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 });
    }

    console.log(`Successfully updated station ${stationId}`);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}