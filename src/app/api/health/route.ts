import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    console.log('🔍 Health Check - Environment:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- SUPABASE_URL exists:', !!supabaseUrl);
    console.log('- SUPABASE_URL:', supabaseUrl);
    console.log('- SERVICE_ROLE_KEY exists:', !!serviceRoleKey);
    console.log('- SERVICE_ROLE_KEY length:', serviceRoleKey?.length || 0);

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        status: 'error',
        message: 'Missing environment variables',
        env: {
          supabaseUrl: !!supabaseUrl,
          serviceRoleKey: !!serviceRoleKey
        }
      }, { status: 500 });
    }

    // Test Supabase connection
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    console.log('🔄 Testing Supabase connection...');
    const { data, error } = await adminClient
      .from('fm_station')
      .select('id_fm')
      .limit(1)
      .single();

    if (error) {
      console.error('❌ Supabase connection failed:', error);
      return NextResponse.json({
        status: 'error',
        message: 'Supabase connection failed',
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        }
      }, { status: 500 });
    }

    console.log('✅ Health check passed');
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      supabase: {
        connected: true,
        url: supabaseUrl
      }
    });

  } catch (error) {
    console.error('❌ Health check error:', error);
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}