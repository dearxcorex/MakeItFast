// src/__tests__/inspection-digest.test.ts
import { describe, it, expect } from 'vitest';
import {
  buildInspectionDigest,
  formatThaiDate,
  type DigestInspection,
  type ProvinceProgress,
} from '@/utils/inspectionDigest';

function insp(overrides: Partial<DigestInspection> = {}): DigestInspection {
  return {
    stationId: 1,
    name: 'สถานีวิทยุชุมชนปากช่อง',
    freq: 98.5,
    district: 'ปากช่อง',
    province: 'นครราชสีมา',
    leadName: 'สมชาย',
    helperCount: 0,
    ...overrides,
  };
}

const progress: ProvinceProgress[] = [
  { province: 'นครราชสีมา', inspected: 120, total: 206, revoked: 12 },
  { province: 'ชัยภูมิ', inspected: 64, total: 140, revoked: 5 },
];

describe('formatThaiDate', () => {
  it('uses the abbreviated Thai month and the Buddhist-era year', () => {
    expect(formatThaiDate('2026-09-13')).toBe('13 ก.ย. 2569');
    expect(formatThaiDate('2027-01-01')).toBe('1 ม.ค. 2570');
  });
});

describe('buildInspectionDigest', () => {
  it('returns null on a day with no inspections', () => {
    expect(buildInspectionDigest([], progress, '2026-09-13')).toBeNull();
  });

  it('builds one embed with the date, count, station lines and progress', () => {
    const payload = buildInspectionDigest(
      [insp({ helperCount: 2 })],
      progress,
      '2026-09-13',
      'https://fm.example.com',
    )!;

    expect(payload.embeds).toHaveLength(1);
    const embed = payload.embeds[0];
    expect(embed.title).toBe('📋 สรุปการตรวจสถานี FM — 13 ก.ย. 2569');
    expect(embed.url).toBe('https://fm.example.com');
    expect(embed.description).toContain('วันนี้ตรวจ 1 สถานี');
    expect(embed.description).toContain('• 98.50 สถานีวิทยุชุมชนปากช่อง — ปากช่อง (นครราชสีมา) — สมชาย +2');
    expect(embed.description).toContain('นครราชสีมา 120/206 (58%) · ถูกเพิกถอน 12');
    expect(embed.description).toContain('ชัยภูมิ 64/140 (46%) · ถูกเพิกถอน 5');
  });

  it('never pings anyone', () => {
    const payload = buildInspectionDigest([insp()], progress, '2026-09-13')!;
    expect(payload.allowed_mentions).toEqual({ parse: [] });
  });

  it('omits the link when no site URL is configured', () => {
    const payload = buildInspectionDigest([insp()], progress, '2026-09-13')!;
    expect(payload.embeds[0].url).toBeUndefined();
  });

  it('lists a station inspected by two teams once, with both leads', () => {
    const payload = buildInspectionDigest(
      [
        insp({ leadName: 'สมชาย', helperCount: 1 }),
        insp({ leadName: 'สมหญิง', helperCount: 0 }),
      ],
      progress,
      '2026-09-13',
    )!;
    const d = payload.embeds[0].description;
    expect(d).toContain('วันนี้ตรวจ 1 สถานี');
    expect(d).toContain('— สมชาย +1, สมหญิง');
    expect(d.match(/^• /gm)).toHaveLength(1);
  });

  it('orders stations by province then frequency', () => {
    const payload = buildInspectionDigest(
      [
        insp({ stationId: 3, freq: 105.0, province: 'นครราชสีมา' }),
        insp({ stationId: 2, freq: 88.0, province: 'ชัยภูมิ', district: 'เมือง' }),
        insp({ stationId: 1, freq: 91.25, province: 'นครราชสีมา' }),
      ],
      progress,
      '2026-09-13',
    )!;
    const freqs = payload.embeds[0].description
      .split('\n')
      .filter((l) => l.startsWith('• '))
      .map((l) => l.split(' ')[1]);
    expect(freqs).toEqual(['88.00', '91.25', '105.00']);
  });

  it('caps the list at 25 stations and counts the rest', () => {
    const many = Array.from({ length: 30 }, (_, i) => insp({ stationId: i + 1, freq: 88 + i * 0.5 }));
    const d = buildInspectionDigest(many, progress, '2026-09-13')!.embeds[0].description;
    expect(d).toContain('วันนี้ตรวจ 30 สถานี');
    expect(d.match(/^• /gm)).toHaveLength(25);
    expect(d).toContain('…และอีก 5 สถานี');
  });

  it('stays inside the Discord embed description limit with long names', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      insp({ stationId: i + 1, name: 'ก'.repeat(500), district: 'ข'.repeat(200) }),
    );
    const d = buildInspectionDigest(many, progress, '2026-09-13')!.embeds[0].description;
    expect(d.length).toBeLessThanOrEqual(4096);
  });

  it('tolerates missing station fields', () => {
    const d = buildInspectionDigest(
      [insp({ name: null, freq: null, district: null, province: null })],
      progress,
      '2026-09-13',
    )!.embeds[0].description;
    expect(d).toContain('• - ไม่ระบุชื่อ');
  });

  it('escapes Discord markdown in station names', () => {
    const d = buildInspectionDigest([insp({ name: '*วิทยุ_ชุมชน*' })], progress, '2026-09-13')!
      .embeds[0].description;
    expect(d).toContain('\\*วิทยุ\\_ชุมชน\\*');
  });

  it('hides the revoked note when a province has none', () => {
    const d = buildInspectionDigest(
      [insp()],
      [{ province: 'ชัยภูมิ', inspected: 0, total: 0, revoked: 0 }],
      '2026-09-13',
    )!.embeds[0].description;
    expect(d).toContain('ชัยภูมิ 0/0 (0%)');
    expect(d).not.toContain('ถูกเพิกถอน');
  });
});
