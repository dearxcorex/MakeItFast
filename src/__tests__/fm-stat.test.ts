// src/__tests__/fm-stat.test.ts
import { describe, it, expect } from 'vitest';
import { buildStatMessage, emptyBuckets, formatThaiDate, type ProvinceStat } from '@/utils/fmStat';

const provinces: ProvinceStat[] = [
  {
    province: 'นครราชสีมา',
    total: 144,
    inspected: 64,
    buckets: { inspected: 58, pending: 70, offair: 10, critical: 6 },
  },
  {
    province: 'ชัยภูมิ',
    total: 77,
    inspected: 21,
    buckets: { inspected: 21, pending: 48, offair: 5, critical: 3 },
  },
];

const describeOf = (p = provinces) => buildStatMessage(p, '2026-09-14').embeds[0].description;

describe('formatThaiDate', () => {
  it('uses the abbreviated Thai month and the Buddhist-era year', () => {
    expect(formatThaiDate('2026-09-13')).toBe('13 ก.ย. 2569');
    expect(formatThaiDate('2027-01-01')).toBe('1 ม.ค. 2570');
  });
});

describe('buildStatMessage', () => {
  it('titles one green embed with the Thai date and links the site when set', () => {
    const msg = buildStatMessage(provinces, '2026-09-14', 'https://fm.example.com');
    expect(msg.embeds).toHaveLength(1);
    expect(msg.embeds[0].title).toBe('📊 สรุปสถานี FM — 14 ก.ย. 2569');
    expect(msg.embeds[0].color).toBe(0x00684a);
    expect(msg.embeds[0].url).toBe('https://fm.example.com');
  });

  it('omits the link when no site URL is configured', () => {
    expect(buildStatMessage(provinces, '2026-09-14').embeds[0].url).toBeUndefined();
  });

  it('never pings anyone', () => {
    expect(buildStatMessage(provinces, '2026-09-14').allowed_mentions).toEqual({ parse: [] });
  });

  it('shows each province with its pin-colour counts and inspection_69 progress', () => {
    const d = describeOf();
    expect(d).toContain(
      '**นครราชสีมา** (144)\n' +
        '🟢 ตรวจแล้ว 58 · 🟡 ยังไม่ตรวจ 70 · ⚫ ไม่ออกอากาศ 10 · 🔴 เพิกถอน 6\n' +
        'ความคืบหน้า ตรวจแล้ว 64/144 (44%)',
    );
    expect(d).toContain('ความคืบหน้า ตรวจแล้ว 21/77 (27%)');
  });

  it('ends with one total line summing every province', () => {
    expect(describeOf().split('\n').at(-1)).toBe('รวม 221 — 🟢 79 · 🟡 118 · ⚫ 15 · 🔴 9');
  });

  it("does not list today's inspections", () => {
    expect(describeOf()).not.toContain('วันนี้');
  });

  it('escapes Discord markdown in province names', () => {
    const d = describeOf([{ province: '*จังหวัด_', total: 0, inspected: 0, buckets: emptyBuckets() }]);
    expect(d).toContain('**\\*จังหวัด\\_**');
  });

  it('shows 0% for a province with no stations', () => {
    const d = describeOf([{ province: 'ชัยภูมิ', total: 0, inspected: 0, buckets: emptyBuckets() }]);
    expect(d).toContain('ความคืบหน้า ตรวจแล้ว 0/0 (0%)');
  });
});
