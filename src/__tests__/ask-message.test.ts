import { describe, it, expect } from 'vitest';
import { buildAskMessage, askErrorMessage, truncate } from '@/utils/askMessage';
import { BACKED_BAND, DISCLAIMER, FIELD_KIT, buildSystemPrompt } from '@/utils/askPrompt';

const result = (over: Partial<{ answer: string; toolsUsed: string[]; truncated: boolean }> = {}) => ({
  answer: 'ลองดูที่ย่าน 122 MHz ก่อน',
  toolsUsed: ['find_stations'],
  truncated: false,
  ...over,
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

describe('buildAskMessage', () => {
  it('puts the question in the title and the answer in the description', () => {
    const msg = buildAskMessage('ร้องเรียนคลื่นรบกวน 122.5 MHz', result());
    expect(msg.embeds[0].title).toBe('🤖 ร้องเรียนคลื่นรบกวน 122.5 MHz');
    expect(msg.embeds[0].description).toBe('ลองดูที่ย่าน 122 MHz ก่อน');
  });

  it('always stamps the disclaimer, whatever the model wrote', () => {
    const msg = buildAskMessage('ถาม', result({ answer: 'ยืนยันแล้วว่าเป็นเครื่องนี้' }));
    expect(msg.embeds[0].footer.text).toContain(DISCLAIMER);
  });

  it('names the tools it used in Thai', () => {
    const msg = buildAskMessage('ถาม', result({ toolsUsed: ['scan_intermod', 'scan_intermod', 'web_search'] }));
    expect(msg.embeds[0].footer.text).toContain('ใช้: คำนวณอินเตอร์มอด · ค้นเว็บ');
  });

  it('says so when no tool was called, so an ungrounded answer is visible', () => {
    const msg = buildAskMessage('ถาม', result({ toolsUsed: [] }));
    expect(msg.embeds[0].footer.text).toContain('ไม่ได้เรียกเครื่องมือ');
  });

  it('flags an answer that ran out of tool rounds', () => {
    const msg = buildAskMessage('ถาม', result({ truncated: true }));
    expect(msg.embeds[0].footer.text).toContain('สรุปก่อนกำหนด');
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

  it('frames the bot as a recommender, not an authority', () => {
    expect(prompt).toContain('ผู้แนะนำ');
    expect(prompt).toContain('ข้อสันนิษฐาน');
  });
});
