import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';
import { mapCsvRowToRecord } from '@/utils/importMapper';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (max 10 MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 10 MB allowed.' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const isCsv = file.name.endsWith('.csv');
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    if (!isCsv && !isXlsx) {
      return NextResponse.json({ error: 'Only CSV and Excel files are supported' }, { status: 400 });
    }
    if (file.type && !allowedTypes.includes(file.type) && file.type !== 'application/octet-stream') {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = isCsv
      ? XLSX.read(buffer.toString('utf-8'), { type: 'string' })
      : XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data found in file' }, { status: 400 });
    }

    const records = rows.map(mapCsvRowToRecord);
    const validRecords = records.filter((r) => r.lat !== null && r.long !== null);

    if (validRecords.length === 0) {
      return NextResponse.json({ error: 'No valid records with coordinates found' }, { status: 400 });
    }

    // Atomic: delete + insert in a transaction
    const result = await prisma.$transaction(async (tx) => {
      await tx.interference_site.deleteMany();
      return tx.interference_site.createMany({ data: validRecords });
    });

    return NextResponse.json({
      success: true,
      imported: result.count,
      total: rows.length,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import data' },
      { status: 500 }
    );
  }
}
