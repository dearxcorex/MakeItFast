import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin client with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);

export async function GET() {
  try {
    const { data, error } = await adminClient
      .from('fm_station')
      .select('*')
      .order('name');

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ stations: data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}