import { describe, it, expect } from 'vitest';
import { buildSiteNotice, buildStationNotice } from '@/utils/inspectionNotice';
import { SUPPRESS_NOTIFICATIONS } from '@/lib/discord';

const station = {
  name: 'คลื่นดี',
  freq: 99.5,
  district: 'เมืองนครราชสีมา',
  province: 'นครราชสีมา',
  type: 'สถานีหลัก',
  lat: 14.97,
  long: 102.1,
  inspectedOn: '2026-09-15',
  lead: 'Somchai',
  helpers: ['Nok', 'Joy'],
};

describe('buildStationNotice', () => {
  it('titles the embed with name and frequency and lists area, type and crew', () => {
    const msg = buildStationNotice(station);
    const [embed] = msg.embeds;
    expect(embed.title).toBe('✅ ตรวจแล้ว · คลื่นดี 99.5 MHz');
    expect(embed.fields).toEqual([
      { name: 'พื้นที่', value: 'เมืองนครราชสีมา, นครราชสีมา', inline: true },
      { name: 'ประเภท', value: 'สถานีหลัก', inline: true },
      { name: 'ผู้ตรวจ', value: 'Somchai', inline: false },
      { name: 'ผู้ร่วมตรวจ', value: 'Nok, Joy', inline: false },
    ]);
    expect(embed.description).toBe('[📍 Google Maps](https://www.google.com/maps?q=14.97,102.1)');
    expect(embed.footer.text).toBe('วันที่ตรวจ 15 ก.ย. 2569');
  });

  it('posts silently and never pings', () => {
    const msg = buildStationNotice(station);
    expect(msg.flags).toBe(SUPPRESS_NOTIFICATIONS);
    expect(msg.allowed_mentions).toEqual({ parse: [] });
  });

  it('omits empty fields, the helper line and the map link when data is missing', () => {
    const [embed] = buildStationNotice({
      ...station, name: null, freq: null, type: '  ', lat: null, helpers: [],
    }).embeds;
    expect(embed.title).toBe('✅ ตรวจแล้ว · ไม่ระบุชื่อ');
    expect(embed.fields.map((f) => f.name)).toEqual(['พื้นที่', 'ผู้ตรวจ']);
    expect(embed.description).toBeUndefined();
  });

  it('escapes markdown in field values', () => {
    const [embed] = buildStationNotice({ ...station, lead: 'a_b*c' }).embeds;
    expect(embed.fields.find((f) => f.name === 'ผู้ตรวจ')?.value).toBe('a\\_b\\*c');
  });
});

describe('buildSiteNotice', () => {
  it('links both the site and the located source', () => {
    const [embed] = buildSiteNotice({
      siteName: null,
      siteCode: 'KRT1234',
      changwat: 'ชัยภูมิ',
      ranking: 'Critical',
      lat: 15.8,
      long: 102.03,
      sourceLat: 15.81,
      sourceLong: 102.04,
      inspectedOn: '2026-09-15',
      lead: 'Somchai',
      helpers: [],
    }).embeds;
    expect(embed.title).toBe('✅ ตรวจแล้ว · สัญญาณรบกวน KRT1234');
    expect(embed.description).toBe(
      '[📍 ไซต์](https://www.google.com/maps?q=15.8,102.03) · [🎯 จุดต้นเหตุ](https://www.google.com/maps?q=15.81,102.04)',
    );
    expect(embed.fields.map((f) => f.name)).toEqual(['รหัสไซต์', 'จังหวัด', 'ระดับ', 'ผู้ตรวจ']);
  });
});
