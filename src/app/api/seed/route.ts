import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const sampleStations = [
  {
    name: 'Radio Thailand',
    freq: 92.5,
    type: 'Public',
    permit: 'PERMIT001',
    district: 'Dusit',
    province: 'Bangkok',
    lat: 13.7563,
    long: 100.5018,
    inspection_67: true,
    unwanted: false,
    submit_a_request: false,
    inspection_68: true,
    on_air: true
  },
  {
    name: 'Cool Fahrenheit',
    freq: 93.0,
    type: 'Commercial',
    permit: 'PERMIT002',
    district: 'Chatuchak',
    province: 'Bangkok',
    lat: 13.8025,
    long: 100.5538,
    inspection_67: true,
    unwanted: false,
    submit_a_request: false,
    inspection_68: true,
    on_air: true
  },
  {
    name: 'Green Wave',
    freq: 106.5,
    type: 'Commercial',
    permit: 'PERMIT003',
    district: 'Huai Khwang',
    province: 'Bangkok',
    lat: 13.7658,
    long: 100.5700,
    inspection_67: true,
    unwanted: false,
    submit_a_request: false,
    inspection_68: false,
    on_air: true
  },
];

export async function POST() {
  try {
    // Clear existing data first
    await prisma.fm_station.deleteMany({});

    // Insert new data
    const data = await prisma.fm_station.createMany({
      data: sampleStations,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${data.count} FM stations!`,
    });

  } catch (err) {
    console.error('Seeding error:', err);
    return NextResponse.json(
      { error: `Seeding failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
