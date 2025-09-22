import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin client function to handle environment variables at runtime
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Create admin client at runtime
    const adminClient = createAdminClient();

    // Debug logging for Vercel deployment
    console.log('🔍 API Debug - Environment check:');
    console.log('- SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('- SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('- SERVICE_ROLE_KEY length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0);

    const { id } = await params;
    const stationId = parseInt(id);
    if (isNaN(stationId)) {
      return NextResponse.json({ error: 'Invalid station ID' }, { status: 400 });
    }

    const body = await request.json();
    const { onAir, inspection68, details } = body;

    console.log('📡 API Debug - Request data:');
    console.log('- Station ID:', stationId);
    console.log('- Updates:', { onAir, inspection68, details });
    console.log('- Auto-date feature enabled for inspection changes');

    // Build update object with only provided fields
    const updates: Record<string, boolean | string | null> = {};
    if (onAir !== undefined) updates.on_air = onAir;
    if (details !== undefined) updates.details = details;
    if (inspection68 !== undefined) {
      updates.inspection_68 = inspection68;

      // Auto-set current date when inspection status changes to "ตรวจแล้ว"
      if (inspection68 === 'ตรวจแล้ว') {
        const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
        updates.date_inspected = currentDate;
        console.log('🗓️ Auto-setting inspection date:', currentDate);
      }
      // Auto-remove date when inspection status changes to "ยังไม่ตรวจ"
      else if (inspection68 === 'ยังไม่ตรวจ') {
        updates.date_inspected = null;
        console.log('🗑️ Auto-removing inspection date for status:', inspection68);
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }


    console.log('🔄 API Debug - Attempting Supabase update:');
    console.log('- Table: fm_station');
    console.log('- Where id_fm =', stationId);
    console.log('- Updates:', updates);

    const { data, error } = await adminClient
      .from('fm_station')
      .update(updates)
      .eq('id_fm', stationId)
      .select('*')
      .single();

    if (error) {
      console.error('❌ Supabase error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details
      }, { status: 500 });
    }

    if (!data) {
      console.log('⚠️ No data returned from Supabase update');
      return NextResponse.json({ error: 'Station not found' }, { status: 404 });
    }

    console.log('✅ Supabase update successful:', data);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}