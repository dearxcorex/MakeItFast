// src/__tests__/fm-stat.test.ts
import { describe, it, expect } from 'vitest';
import {
  buildStatMessage,
  emptyBuckets,
  formatThaiDate,
  type ProvinceStat,
  type TodayStation,
} from '@/utils/fmStat';

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

function station(overrides: Partial<TodayStation> = {}): TodayStation {
  return {
    stationId: 1,
    name: 'สถานีวิทยุชุมชนปากช่อง',
    freq: 98.5,
    district: 'ปากช่อง',
    province: 'นครราชสีมา',
    bucket: 'inspected',
    ...overrides,
  };
}

const describeOf = (today: TodayStation[], p = provinces) =>
  buildStatMessage(p, today, '2026-09-14').embeds[0].description;

describe('formatThaiDate', () => {
  it('uses the abbreviated Thai month and the Buddhist-era year', () => {
    expect(formatThaiDate('2026-09-13')).toBe('13 ก.ย. 2569');
    expect(formatThaiDate('2027-01-01')).toBe('1 ม.ค. 2570');
  });
});

describe('buildStatMessage', () => {
  it('titles one green embed with the Thai date and links the site when set', () => {
    const msg = buildStatMessage(provinces, [], '2026-09-14', 'https://fm.example.com');
    expect(msg.embeds).toHaveLength(1);
    expect(msg.embeds[0].title).toBe('📊 สรุปสถานี FM — 14 ก.ย. 2569');
    expect(msg.embeds[0].color).toBe(0x00684a);
    expect(msg.embeds[0].url).toBe('https://fm.example.com');
  });

  it('omits the link when no site URL is configured', () => {
    expect(buildStatMessage(provinces, [], '2026-09-14').embeds[0].url).toBeUndefined();
  });

  it('never pings anyone', () => {
    expect(buildStatMessage(provinces, [], '2026-09-14').allowed_mentions).toEqual({ parse: [] });
  });

  it('shows each province with its pin-colour counts and inspection_69 progress', () => {
    const d = describeOf([]);
    expect(d).toContain(
      '**นครราชสีมา** (144)\n' +
        '🟢 ตรวจแล้ว 58 · 🟡 ยังไม่ตรวจ 70 · ⚫ ไม่ออกอากาศ 10 · 🔴 เพิกถอน 6\n' +
        'ความคืบหน้า ตรวจแล้ว 64/144 (44%)',
    );
    expect(d).toContain('ความคืบหน้า ตรวจแล้ว 21/77 (27%)');
  });

  it('sums every province into one total line', () => {
    expect(describeOf([])).toContain('รวม 221 — 🟢 79 · 🟡 118 · ⚫ 15 · 🔴 9');
  });

  it('says nothing was inspected on an empty day', () => {
    expect(describeOf([])).toContain('วันนี้ยังไม่มีการตรวจ');
  });

  it('lists today\'s stations with their pin colour and no inspector names', () => {
    const d = describeOf([station(), station({ stationId: 2, freq: 101, bucket: 'critical', district: null })]);
    expect(d).toContain('**วันนี้ตรวจ 2 สถานี**');
    expect(d).toContain('🟢 98.50 สถานีวิทยุชุมชนปากช่อง — ปากช่อง (นครราชสีมา)');
    expect(d).toContain('🔴 101.00 สถานีวิทยุชุมชนปากช่อง — นครราชสีมา');
  });

  it('lists a station inspected by two teams once', () => {
    const d = describeOf([station(), station()]);
    expect(d).toContain('วันนี้ตรวจ 1 สถานี');
    expect(d.match(/^🟢 98\.50/gm)).toHaveLength(1);
  });

  it('orders stations by province then frequency', () => {
    const d = describeOf([
      station({ stationId: 3, freq: 105 }),
      station({ stationId: 2, freq: 88, province: 'ชัยภูมิ', district: 'เมือง' }),
      station({ stationId: 1, freq: 91.25 }),
    ]);
    const freqs = d
      .split('\n')
      .filter((l) => /^🟢 \d/.test(l))
      .map((l) => l.split(' ')[1]);
    expect(freqs).toEqual(['88.00', '91.25', '105.00']);
  });

  it('caps the list at 25 stations and counts the rest', () => {
    const many = Array.from({ length: 30 }, (_, i) => station({ stationId: i + 1, freq: 88 + i * 0.5 }));
    const d = describeOf(many);
    expect(d).toContain('วันนี้ตรวจ 30 สถานี');
    expect(d.match(/^🟢 \d/gm)).toHaveLength(25);
    expect(d).toContain('…และอีก 5 สถานี');
  });

  it('stays inside the Discord embed description limit with long names', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      station({ stationId: i + 1, name: 'ก'.repeat(500), district: 'ข'.repeat(200) }),
    );
    expect(describeOf(many).length).toBeLessThanOrEqual(4096);
  });

  it('tolerates missing station fields', () => {
    const d = describeOf([station({ name: null, freq: null, district: null, province: null })]);
    expect(d).toContain('🟢 - ไม่ระบุชื่อ — -');
  });

  it('escapes Discord markdown in station names', () => {
    expect(describeOf([station({ name: '*วิทยุ_ชุมชน*' })])).toContain('\\*วิทยุ\\_ชุมชน\\*');
  });

  it('shows 0% for a province with no stations', () => {
    const d = describeOf([], [{ province: 'ชัยภูมิ', total: 0, inspected: 0, buckets: emptyBuckets() }]);
    expect(d).toContain('ความคืบหน้า ตรวจแล้ว 0/0 (0%)');
  });
});
