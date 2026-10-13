/* eslint-disable no-console */
/**
 * Eval for the Discord /ask bot. Deliberately NOT part of `npm test`: it calls
 * DeepSeek and the real database, so it costs money and needs the network.
 * The scoring itself (src/utils/askEval.ts) is unit-tested.
 *
 * Each case in scripts/ask-eval-cases.ts runs RUNS_PER_CASE times, because the
 * model is not deterministic. Checks are plain code — tool choice and arguments,
 * every number backed by a tool, safety rules. A case passes on 2 of 3 runs
 * with no safety slip in any. The full trace of every run goes to
 * reports/ask-eval-<timestamp>.json.
 *
 *   npx tsx --env-file=.env scripts/ask-eval.ts                     # all cases, compare with baseline
 *   npx tsx --env-file=.env scripts/ask-eval.ts --save-baseline     # ...and make this run the baseline
 *   npx tsx --env-file=.env scripts/ask-eval.ts --case gate-450,refuse-power --runs 1
 *   npx tsx --env-file=.env scripts/ask-eval.ts "คำถามของคุณเอง"     # one ad-hoc question, printed, not scored
 *
 * Run it after changing the system prompt, the tool set or the model. A change
 * is an improvement when the pass count goes up and no baseline pass regresses.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { AskTurn } from '../src/lib/askThread';
import { askAgent, type AskResult } from '../src/services/askAgent';
import { bangkokToday } from '../src/utils/bangkokDate';
import { buildSystemPrompt } from '../src/utils/askPrompt';
import {
  RUNS_PER_CASE,
  regressions,
  scoreRun,
  verdictFor,
  type CaseVerdict,
  type CheckResult,
  type EvalCase,
} from '../src/utils/askEval';
import { CASES } from './ask-eval-cases';

const BASELINE_PATH = 'reports/ask-eval-baseline.json';
const CONCURRENCY = 3;

interface RunRecord {
  answer: string;
  calls: AskResult['calls'];
  truncated: boolean;
  ms: number;
  checks: CheckResult[];
  error?: string;
}

interface CaseRecord {
  id: string;
  question: string;
  verdict: CaseVerdict;
  runs: RunRecord[];
}

interface Report {
  startedAt: string;
  runsPerCase: number;
  passed: number;
  total: number;
  cases: CaseRecord[];
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function runOnce(c: EvalCase, today: string, system: string): Promise<RunRecord> {
  const startedAt = Date.now();
  try {
    // A follow-up chain builds its history the way the route does, then only the last turn is scored.
    const history: AskTurn[] = [];
    const earlier: string[] = [];
    for (const question of c.before ?? []) {
      const turn = await askAgent(question, today, { history: [...history] });
      history.push({ question, answer: turn.answer, tools: turn.calls.map(({ name, input }) => ({ name, input })) });
      earlier.push(turn.answer, ...turn.calls.filter((call) => !call.isError).map((call) => call.output));
    }
    const result = await askAgent(c.question, today, { history });
    const checks = scoreRun(c, {
      question: [...(c.before ?? []), c.question].join('\n'),
      answer: result.answer,
      calls: result.calls,
      extraSources: [system, ...earlier],
    });
    return { answer: result.answer, calls: result.calls, truncated: result.truncated, ms: Date.now() - startedAt, checks };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      answer: '',
      calls: [],
      truncated: false,
      ms: Date.now() - startedAt,
      checks: [{ name: 'agent did not throw', severity: 'quality', pass: false, detail: message }],
      error: message,
    };
  }
}

/** Run jobs with at most `limit` in flight — DeepSeek is slow, one at a time takes too long. */
async function pool<T>(jobs: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const out: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, jobs.length) }, async () => {
      while (next < jobs.length) {
        const i = next++;
        out[i] = await jobs[i]();
      }
    }),
  );
  return out;
}

function printCase(record: CaseRecord, c: EvalCase) {
  const { verdict } = record;
  const mark = verdict.pass ? 'PASS' : 'FAIL';
  // For a follow-up chain this is the whole chain's time, not one turn's.
  const secs = record.runs.map((r) => (r.ms / 1000).toFixed(0)).join('/');
  console.log(`${mark}  ${record.id.padEnd(28)} ${verdict.runsPassed}/${verdict.runs} runs  ${secs}s${verdict.safetyFailed ? '  SAFETY' : ''}`);
  if (verdict.pass) return;
  console.log(`      why: ${c.why}`);
  const failures = new Map<string, number>();
  for (const run of record.runs) {
    for (const check of run.checks.filter((r) => !r.pass)) {
      const key = `[${check.severity}] ${check.name}${check.detail ? ` — ${check.detail}` : ''}`;
      failures.set(key, (failures.get(key) ?? 0) + 1);
    }
  }
  for (const [key, count] of failures) console.log(`      ${count}× ${key}`);
}

async function adHoc(question: string, today: string) {
  const startedAt = Date.now();
  const { answer, calls, truncated } = await askAgent(question, today);
  console.log(answer);
  for (const call of calls) console.log(`\n— ${call.name}(${JSON.stringify(call.input)}) ${call.ms}ms${call.isError ? ' ERROR' : ''}`);
  console.log(`\n${truncated ? 'TRUNCATED | ' : ''}${((Date.now() - startedAt) / 1000).toFixed(1)}s | ${answer.length} chars`);
}

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('DEEPSEEK_API_KEY is not set — run with `npx tsx --env-file=.env`');
    process.exit(1);
  }
  const today = bangkokToday();

  const positional = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--'));
  if (positional.length) return adHoc(positional.join(' '), today);

  const only = flag('--case')?.split(',');
  const runs = Number(flag('--runs') ?? RUNS_PER_CASE);
  const cases = only ? CASES.filter((c) => only.includes(c.id)) : CASES;
  if (!cases.length) throw new Error(`no case matches ${only?.join(', ')}`);

  const system = buildSystemPrompt(today);
  const startedAt = new Date().toISOString();
  console.log(`${cases.length} cases × ${runs} runs, ${CONCURRENCY} at a time\n`);

  const jobs = cases.flatMap((c) => Array.from({ length: runs }, () => () => runOnce(c, today, system)));
  const results = await pool(jobs, CONCURRENCY);

  const records: CaseRecord[] = cases.map((c, i) => {
    const caseRuns = results.slice(i * runs, (i + 1) * runs);
    return { id: c.id, question: c.question, verdict: verdictFor(caseRuns.map((r) => r.checks)), runs: caseRuns };
  });
  records.forEach((record, i) => printCase(record, cases[i]));

  const report: Report = {
    startedAt,
    runsPerCase: runs,
    passed: records.filter((r) => r.verdict.pass).length,
    total: records.length,
    cases: records,
  };
  const all = records.flatMap((r) => r.runs);
  const avgSecs = all.reduce((s, r) => s + r.ms, 0) / all.length / 1000;
  const maxSecs = Math.max(...all.map((r) => r.ms)) / 1000;
  console.log(`\n${report.passed}/${report.total} cases pass | latency avg ${avgSecs.toFixed(1)}s, max ${maxSecs.toFixed(1)}s | ${all.filter((r) => r.truncated).length} truncated`);

  const current = Object.fromEntries(records.map((r) => [r.id, r.verdict.pass]));
  if (existsSync(BASELINE_PATH)) {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Report;
    const before = Object.fromEntries(baseline.cases.map((r) => [r.id, r.verdict.pass]));
    const lost = regressions(before, current);
    const gained = Object.keys(current).filter((id) => before[id] === false && current[id]);
    console.log(`vs baseline (${baseline.startedAt}): ${baseline.passed}/${baseline.total} → ${report.passed}/${report.total}`);
    if (gained.length) console.log(`  fixed:     ${gained.join(', ')}`);
    if (lost.length) console.log(`  REGRESSED: ${lost.join(', ')}`);
  }

  const path = `reports/ask-eval-${startedAt.replace(/[:.]/g, '-')}.json`;
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(`trace: ${path}`);
  if (process.argv.includes('--save-baseline')) {
    writeFileSync(BASELINE_PATH, JSON.stringify(report, null, 2));
    console.log(`baseline saved: ${BASELINE_PATH}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
