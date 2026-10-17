import { describe, it, expect } from 'vitest';
import { MAX_DETAIL_STATIONS, buildAskMessage, askErrorMessage, operDataLines, thaiDateTime, truncate } from '@/utils/askMessage';
import { BACKED_BAND, FIELD_KIT, buildSystemPrompt } from '@/utils/askPrompt';

const result = (over: Partial<{ answer: string; toolsUsed: string[]; truncated: boolean }> = {}) => ({
  answer: 'ลองดูที่ย่าน 122 MHz ก่อน',
  toolsUsed: ['find_stations'],
  truncated: false,
  ...over,
});

describe('OPER data age and partial lists', () => {
  const oper = (output: object, isError = false) => ({ name: 'find_oper_stations', output: JSON.stringify(output), isError });

  it('writes a timestamp in Thai time and Buddhist era', () => {
    expect(thaiDateTime('2026-10-15T20:00:00+00:00')).toBe('16 ต.ค. 2569 03:00');
    expect(thaiDateTime('not a date')).toBeUndefined();
  });

  it('shows the saved register age in the footer', () => {
    const msg = buildAskMessage('q', {
      ...result({ toolsUsed: ['find_oper_stations'] }),
      calls: [oper({ total: 129, shown: 10, complete: true, as_of: '2026-10-15T20:00:00+00:00' })],
    });
    expect(msg.embeds[0].footer?.text).toContain('ข้อมูล OPER ณ 16 ต.ค. 2569 03:00');
    expect(msg.embeds[0].footer?.text).not.toContain('ไม่ครบ');
  });

  it('flags a partial live list with shown of total', () => {
    expect(operDataLines([oper({ total: 129, shown: 10, complete: false })])).toEqual([
      'รายการ OPER ไม่ครบ: แสดง 10 จาก 129 สถานี (ค้นสดไม่ทันเวลา)',
    ]);
  });

  it('ignores failed calls, other tools, and a repeat of the same line', () => {
    const same = oper({ total: 5, shown: 5, complete: true, as_of: '2026-10-15T20:00:00+00:00' });
    expect(
      operDataLines([
        same,
        same,
        oper({ complete: false }, true),
        { name: 'count_oper_inspections', output: '{"complete":false,"shown":1,"total":2}', isError: false },
        { name: 'find_oper_stations', output: 'not json', isError: false },
      ]),
    ).toEqual(['ข้อมูล OPER ณ 16 ต.ค. 2569 03:00']);
  });
});

describe('truncate', () => {
  it('leaves a short string alone', () => {
    expect(truncate('สั้น', 10)).toBe('สั้น');
  });

  it('never exceeds the limit, ellipsis included', () => {
    const out = truncate('a'.repeat(50), 10);
    expect(out).toHaveLength(10);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('station details under the answer', () => {
  const station = (n: number, more = {}) => ({
    name: `สถานี ${n}`, frequencyMHz: 91.75, subdistrict: 'ผักปัง', district: 'ภูเขียว', province: 'ชัยภูมิ',
    lat: 16.12671, lng: 101.897369, contactName: 'สมชาย', contactPhone: '081-111-1111', ...more,
  });
  const call = (stations: unknown[], isError = false) => ({ name: 'find_oper_stations', output: '{}', isError, stations });

  it('prints place, a map link and the phone after the answer', () => {
    const msg = buildAskMessage('ถาม', { answer: 'พบ 1 สถานี', toolsUsed: [], truncated: false, calls: [call([station(1)])] });
    const text = msg.embeds[0].description;
    expect(text.startsWith('พบ 1 สถานี\n\n')).toBe(true);
    expect(text).toContain('**สถานี 1** 91.75 MHz');
    expect(text).toContain('ที่ตั้ง: ต.ผักปัง อ.ภูเขียว จ.ชัยภูมิ');
    expect(text).toContain('พิกัด: [16.12671, 101.897369](https://www.google.com/maps?q=16.12671,101.897369)');
    expect(text).toContain('โทร: สมชาย 081-111-1111');
  });

  it('says ไม่มีข้อมูล for a missing phone or coordinates, dedupes, caps and skips failed calls', () => {
    const many = Array.from({ length: MAX_DETAIL_STATIONS + 2 }, (_, i) => station(i));
    const msg = buildAskMessage('ถาม', {
      answer: 'ก', toolsUsed: [], truncated: false,
      calls: [call([station(0, { lat: null, contactPhone: null })]), call(many), call([station(99)], true)],
    });
    const text = msg.embeds[0].description;
    expect(text).toContain('…และอีก 2 สถานี');
    expect(text).not.toContain('สถานี 99');
    expect(buildAskMessage('ถาม', { answer: 'ก', toolsUsed: [], truncated: false,
      calls: [call([station(0, { lat: null, contactPhone: null })])] }).embeds[0].description)
      .toContain('พิกัด: ไม่มีข้อมูล\nโทร: ไม่มีข้อมูล');
  });

  it('leaves the answer alone when no station came back', () => {
    const msg = buildAskMessage('ถาม', { answer: 'ก', toolsUsed: [], truncated: false, calls: [call([])] });
    expect(msg.embeds[0].description).toBe('ก');
  });
});

describe('buildAskMessage', () => {
  it('puts the question in the title and the answer in the description', () => {
    const msg = buildAskMessage('ร้องเรียนคลื่นรบกวน 122.5 MHz', result());
    expect(msg.embeds[0].title).toBe('🤖 ร้องเรียนคลื่นรบกวน 122.5 MHz');
    expect(msg.embeds[0].description).toBe('ลองดูที่ย่าน 122 MHz ก่อน');
  });

  it('adds no disclaimer or tools line, and no footer when there is nothing to warn about', () => {
    const msg = buildAskMessage('ถาม', result({ toolsUsed: ['count_oper_inspections', 'web_search'] }));
    expect(msg.embeds[0].footer).toBeUndefined();
    expect(JSON.stringify(msg)).not.toContain('สันนิษฐาน');
    expect(JSON.stringify(msg)).not.toContain('ใช้:');
  });

  it('flags an answer that ran out of tool rounds', () => {
    const msg = buildAskMessage('ถาม', result({ truncated: true }));
    expect(msg.embeds[0].footer?.text).toContain('สรุปก่อนกำหนด');
  });

  it('keeps title and description inside Discord limits', () => {
    const msg = buildAskMessage('ถ'.repeat(600), result({ answer: 'ก'.repeat(9000) }));
    expect(msg.embeds[0].title.length).toBeLessThanOrEqual(256);
    expect(msg.embeds[0].description).toHaveLength(4096);
  });

  it('suppresses mentions so the model cannot ping the server', () => {
    const msg = buildAskMessage('ถาม', result({ answer: '@everyone ออกตรวจด่วน' }));
    expect(msg.allowed_mentions).toEqual({ parse: [] });
  });
});

describe('askErrorMessage', () => {
  it('is plain content with mentions suppressed', () => {
    expect(askErrorMessage('พัง')).toEqual({ content: 'พัง', allowed_mentions: { parse: [] } });
  });
});

describe('buildSystemPrompt', () => {
  const prompt = buildSystemPrompt('2026-09-20');

  it('carries the date it was told', () => {
    expect(prompt).toContain('2026-09-20');
  });

  it('forbids inventing numbers', () => {
    expect(prompt).toContain('ห้ามสร้างตัวเลขเอง');
  });

  it('states the band the database actually covers', () => {
    expect(prompt).toContain(BACKED_BAND);
  });

  it('states the 30 MHz – 3 GHz remit, not just FM', () => {
    expect(prompt).toContain('30 MHz – 3 GHz');
  });

  it('lists the direction-finding kit', () => {
    expect(prompt).toContain(FIELD_KIT);
    for (const model of ['HE300', 'HE400', 'DDF550']) expect(prompt).toContain(model);
  });

  it('makes OPER the main job and keeps the FM database out of non-FM questions', () => {
    expect(prompt).toContain('งานหลัก: **ตอบข้อมูลสถานีวิทยุกระจายเสียงจากระบบ OPER');
    expect(prompt).not.toContain('scan_intermod');
    expect(prompt).toContain('ไม่ต้องพูดถึงฐานข้อมูล FM เลย');
  });

  it('caps web search to save tokens', () => {
    expect(prompt).toContain('ไม่เกิน 1 ครั้งต่อคำถาม');
  });

  it('tells the model not to add a disclaimer or a tools line itself', () => {
    expect(prompt).toContain('หมายเหตุหรือคำเตือนว่าเป็นข้อสันนิษฐาน, บรรทัดบอกว่าใช้เครื่องมือ/แหล่งข้อมูลอะไร');
  });

  it('answers a count with inspections only, split by result, no station counts', () => {
    expect(prompt).toContain('ตอบเป็นจำนวนครั้งที่ตรวจ (inspections) เท่านั้น ห้ามใส่จำนวนสถานี (stations)');
    expect(prompt).toContain('ตรวจ 126 ครั้ง: ตรงตามมาตรฐาน 118 ครั้ง / ไม่ตรงตามมาตรฐาน 8 ครั้ง');
    expect(prompt).not.toContain('สถานีไม่ซ้ำใส่ในวงเล็บ');
    expect(prompt).toContain('ไม่ผ่าน/ไม่ตรงมาตรฐาน → ไม่ตรงตามมาตรฐาน');
    expect(prompt).toContain('เรียก count_oper_inspections ครั้งเดียวโดยไม่ใส่ province เพื่อนับทุกจังหวัด');
  });

  it('treats OPER sources as exact-match data sources, not names', () => {
    expect(prompt).toContain('BCS คือ BCS เท่านั้น ไม่รวม BCS2/BCS3');
    expect(prompt).toContain('ไม่ใช่ชื่อสถานีหรือผู้ประกอบการ');
  });

  it('reports an OPER failure plainly instead of inventing procedures', () => {
    expect(prompt).toContain('ค้นจากระบบ OPER ไม่สำเร็จ');
    expect(prompt).toContain('ห้ามแนะนำขั้นตอนงานอื่น');
  });

  it('frames the bot as a recommender, not an authority', () => {
    expect(prompt).toContain('ผู้แนะนำ');
    expect(prompt).toContain('ข้อสันนิษฐาน');
  });
});
