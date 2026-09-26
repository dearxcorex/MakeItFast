import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { consumeAskQuota, dailyLimit, __resetAskQuotaForTests } from '@/lib/askQuota';

beforeEach(() => {
  __resetAskQuotaForTests();
  delete process.env.ASK_DAILY_LIMIT;
});

afterEach(() => {
  delete process.env.ASK_DAILY_LIMIT;
});

describe('dailyLimit', () => {
  it('defaults to 30', () => {
    expect(dailyLimit()).toBe(30);
  });

  it('honours ASK_DAILY_LIMIT', () => {
    process.env.ASK_DAILY_LIMIT = '3';
    expect(dailyLimit()).toBe(3);
  });

  it('ignores a nonsense value rather than capping at zero', () => {
    process.env.ASK_DAILY_LIMIT = 'lots';
    expect(dailyLimit()).toBe(30);
    process.env.ASK_DAILY_LIMIT = '0';
    expect(dailyLimit()).toBe(30);
  });
});

describe('consumeAskQuota', () => {
  it('allows calls up to the limit and refuses the next one', async () => {
    process.env.ASK_DAILY_LIMIT = '2';
    expect(await consumeAskQuota('u1', '2026-09-20')).toEqual({ allowed: true, used: 1, limit: 2 });
    expect(await consumeAskQuota('u1', '2026-09-20')).toEqual({ allowed: true, used: 2, limit: 2 });
    expect(await consumeAskQuota('u1', '2026-09-20')).toEqual({ allowed: false, used: 3, limit: 2 });
  });

  it('keeps counting refused attempts, so retrying does not reset anything', async () => {
    process.env.ASK_DAILY_LIMIT = '1';
    await consumeAskQuota('u1', '2026-09-20');
    await consumeAskQuota('u1', '2026-09-20');
    expect((await consumeAskQuota('u1', '2026-09-20')).used).toBe(3);
  });

  it('counts each user separately', async () => {
    process.env.ASK_DAILY_LIMIT = '1';
    await consumeAskQuota('u1', '2026-09-20');
    expect((await consumeAskQuota('u2', '2026-09-20')).allowed).toBe(true);
  });

  it('starts over on the next Bangkok day', async () => {
    process.env.ASK_DAILY_LIMIT = '1';
    await consumeAskQuota('u1', '2026-09-20');
    expect(await consumeAskQuota('u1', '2026-09-21')).toEqual({ allowed: true, used: 1, limit: 1 });
  });
});
