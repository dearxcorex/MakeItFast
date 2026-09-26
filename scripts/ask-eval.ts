/* eslint-disable no-console */
/**
 * Manual eval for the Discord /ask bot. Deliberately NOT part of `npm test`:
 * it calls DeepSeek and the real database, so it costs money and needs the
 * network. `npm test` mocks the provider instead.
 *
 * Run it after changing the system prompt or the tool set, and read the
 * answers — the thing being checked is judgement, which no assertion covers.
 *
 *   npx tsx --env-file=.env scripts/ask-eval.ts
 *   npx tsx --env-file=.env scripts/ask-eval.ts "คำถามของคุณเอง"
 *
 * What to look for:
 *   - did it call a tool before stating any number?
 *   - does it say so when the question leaves the 87.5–108 MHz data?
 *   - is the advice something you could actually do with HE300/HE400/DDF550?
 */

import { askAgent } from '../src/services/askAgent';
import { bangkokToday } from '../src/utils/bangkokDate';

const DEFAULT_QUESTIONS = [
  // Should scan_intermod: an aviation frequency, backed by real station data.
  'มีเรื่องร้องเรียนว่าความถี่การบิน 122.5 MHz ถูกรบกวน น่าจะมาจากคู่สถานี FM คู่ไหน',
  // Outside the database: should say so, then reason from allocation knowledge.
  'ร้องเรียนคลื่นรบกวนที่ 450 MHz ในเขตเมืองนครราชสีมา อุปกรณ์อะไรน่าจะเป็นตัวก่อกวน',
  // Pure technique: should not invent numbers at all.
  'จะใช้ HE400 กับเครื่องวิเคราะห์สเปกตรัมมือถือเดินหาต้นตอสัญญาณในอาคารอย่างไร',
  // Database lookup: should call find_stations, not guess.
  'สถานี FM ที่ 100.5 MHz ในนครราชสีมามีสถานีไหนบ้าง ตรวจแล้วหรือยัง',
  // Must resist: there is no such data, and it should refuse to make it up.
  'ช่วยบอกกำลังส่งจริงของสถานีที่ 95.5 MHz เป็นวัตต์',
];

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('DEEPSEEK_API_KEY is not set — run with `npx tsx --env-file=.env`');
    process.exit(1);
  }

  const argument = process.argv.slice(2).join(' ').trim();
  const questions = argument ? [argument] : DEFAULT_QUESTIONS;
  const today = bangkokToday();

  for (const [i, question] of questions.entries()) {
    console.log(`\n${'='.repeat(70)}\n[${i + 1}/${questions.length}] ${question}\n${'='.repeat(70)}`);
    const startedAt = Date.now();
    try {
      const { answer, toolsUsed, truncated } = await askAgent(question, today);
      console.log(answer);
      console.log(
        `\n— tools: ${toolsUsed.join(', ') || 'none'}` +
          `${truncated ? ' | TRUNCATED (hit the round cap)' : ''}` +
          ` | ${((Date.now() - startedAt) / 1000).toFixed(1)}s` +
          ` | ${answer.length} chars`,
      );
    } catch (error) {
      console.error('FAILED:', error instanceof Error ? error.message : error);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
