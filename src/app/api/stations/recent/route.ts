import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Get all stations with key fields for polling updates
    const data = await prisma.fm_station.findMany({
      select: {
        id_fm: true,
        on_air: true,
        inspection_68: true,
        unwanted: true,
        submit_a_request: true,
      },
    });

    // Transform to match our interface
    const updates = data.map(station => ({
      id: station.id_fm,
      onAir: station.on_air,
      inspection68: station.inspection_68 ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
      unwanted: station.unwanted,
      submitRequest: station.submit_a_request ? 'ยื่น' : 'ไม่ยื่น'
    }));

    return NextResponse.json({
      updated: updates,
      count: updates.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Recent updates API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent updates' },
      { status: 500 }
    );
  }
}
