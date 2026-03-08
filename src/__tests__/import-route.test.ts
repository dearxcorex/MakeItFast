import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock prisma
const mockDeleteMany = vi.fn();
const mockCreateMany = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}));

// Mock xlsx
const mockRead = vi.fn();
const mockSheetToJson = vi.fn();

vi.mock('xlsx', () => ({
  read: (...args: unknown[]) => mockRead(...args),
  utils: {
    sheet_to_json: (...args: unknown[]) => mockSheetToJson(...args),
  },
}));

// Mock importMapper
const mockMapCsvRowToRecord = vi.fn();
vi.mock('@/utils/importMapper', () => ({
  mapCsvRowToRecord: (row: unknown) => mockMapCsvRowToRecord(row),
}));

import { POST } from '@/app/api/interference/import/route';

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockImplementation(async (fn) => {
    const tx = {
      interference_site: {
        deleteMany: mockDeleteMany,
        createMany: mockCreateMany,
      },
    };
    return fn(tx);
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

function createMockFile(
  content: string,
  name: string,
  type: string,
  size?: number
): File {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size });
  }
  return file;
}

function createFormData(file: File | null): FormData {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  }
  return formData;
}

function createRequest(formData: FormData): Request {
  return {
    formData: () => Promise.resolve(formData),
  } as unknown as Request;
}

describe('POST /api/interference/import', () => {
  it('returns 400 for missing file', async () => {
    const formData = new FormData();
    // Don't append any file
    const request = createRequest(formData);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('No file provided');
  });

  it('returns 400 for oversized file (>10MB)', async () => {
    const file = createMockFile('data', 'big.csv', 'text/csv', 11 * 1024 * 1024);
    const request = createRequest(createFormData(file));

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('File too large');
  });

  it('returns 400 for wrong file type (not csv/xlsx)', async () => {
    const file = createMockFile('data', 'file.txt', 'text/plain', 100);
    const request = createRequest(createFormData(file));

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Only CSV and Excel files are supported');
  });

  it('returns 400 for empty data', async () => {
    const file = createMockFile('header1,header2\n', 'data.csv', 'text/csv', 20);
    const sheet = {};
    mockRead.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: sheet },
    });
    mockSheetToJson.mockReturnValue([]);

    const request = createRequest(createFormData(file));
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('No data found in file');
  });

  it('returns 400 when no valid records have coordinates', async () => {
    const file = createMockFile('Site,Lat,Long\nA,,\n', 'data.csv', 'text/csv', 50);
    const sheet = {};
    mockRead.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: sheet },
    });
    mockSheetToJson.mockReturnValue([{ Site: 'A', Lat: '', Long: '' }]);
    mockMapCsvRowToRecord.mockReturnValue({ site_code: 'A', lat: null, long: null });

    const request = createRequest(createFormData(file));
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('No valid records with coordinates found');
  });

  it('successfully imports valid CSV file', async () => {
    const csvContent = 'Site,Lat,Long\nAWN-001,13.75,100.5\nAWN-002,14.0,101.0\n';
    const file = createMockFile(csvContent, 'sites.csv', 'text/csv', 100);
    const sheet = {};
    mockRead.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: sheet },
    });
    mockSheetToJson.mockReturnValue([
      { Site: 'AWN-001', Lat: 13.75, Long: 100.5 },
      { Site: 'AWN-002', Lat: 14.0, Long: 101.0 },
    ]);
    mockMapCsvRowToRecord.mockImplementation((row: Record<string, unknown>) => ({
      site_code: row.Site,
      lat: row.Lat,
      long: row.Long,
    }));
    mockDeleteMany.mockResolvedValue({ count: 0 });
    mockCreateMany.mockResolvedValue({ count: 2 });

    const request = createRequest(createFormData(file));
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.imported).toBe(2);
    expect(body.total).toBe(2);
    expect(mockDeleteMany).toHaveBeenCalled();
    expect(mockCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ site_code: 'AWN-001', lat: 13.75 }),
      ]),
    });
  });

  it('returns 500 on internal error', async () => {
    const file = createMockFile('data', 'data.csv', 'text/csv', 50);
    mockRead.mockImplementation(() => {
      throw new Error('Parse error');
    });

    const request = createRequest(createFormData(file));
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to import data');
  });

  it('handles xlsx file extension correctly', async () => {
    const file = createMockFile('binary', 'data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 100);
    const sheet = {};
    mockRead.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: sheet },
    });
    mockSheetToJson.mockReturnValue([
      { Site: 'AWN-003', Lat: 13.8, Long: 100.6 },
    ]);
    mockMapCsvRowToRecord.mockReturnValue({
      site_code: 'AWN-003',
      lat: 13.8,
      long: 100.6,
    });
    mockDeleteMany.mockResolvedValue({ count: 0 });
    mockCreateMany.mockResolvedValue({ count: 1 });

    const request = createRequest(createFormData(file));
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.imported).toBe(1);
    // xlsx should use buffer type, not string
    expect(mockRead).toHaveBeenCalledWith(expect.any(Buffer), { type: 'buffer' });
  });
});
