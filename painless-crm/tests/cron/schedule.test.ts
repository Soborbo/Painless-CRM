import { verifyHmac } from '@/lib/webhooks/handler';
import { CRON_SCHEDULE, resolveCronJob, signCronPayload } from '@/worker-cron/schedule';
import { describe, expect, it } from 'vitest';

describe('cron schedule dispatch', () => {
  it('maps every scheduled expression to a valid /api/cron route', () => {
    for (const job of Object.values(CRON_SCHEDULE)) {
      expect(job.path.startsWith('/api/cron/')).toBe(true);
    }
  });

  it('only the London-9am digests share a route across two UTC triggers (DST, ADR-040/042)', () => {
    // Each route is unique EXCEPT daily-digest, notify-weekly and task-digest,
    // which fire at both 08:xx and 09:xx UTC and let the route's London-local
    // guard pick the single 09:00-London run. Any other duplicate path is a bug.
    const byPath = new Map<string, number>();
    for (const job of Object.values(CRON_SCHEDULE)) {
      byPath.set(job.path, (byPath.get(job.path) ?? 0) + 1);
    }
    const dualTrigger = [...byPath.entries()].filter(([, n]) => n > 1).map(([p]) => p).sort();
    expect(dualTrigger).toEqual([
      '/api/cron/daily-digest',
      '/api/cron/notify-weekly',
      '/api/cron/task-digest',
    ]);
    expect(byPath.get('/api/cron/daily-digest')).toBe(2);
    expect(byPath.get('/api/cron/notify-weekly')).toBe(2);
    expect(byPath.get('/api/cron/task-digest')).toBe(2);
  });

  it('routes the Gmail inbound-mail poll (ADR-044) on its offset-4 slot', () => {
    expect(resolveCronJob('4-59/5 * * * *')).toEqual({
      path: '/api/cron/gmail-poll',
      payload: 'gmail-poll',
    });
  });

  it('routes the paid-review and complaint sweeps', () => {
    expect(resolveCronJob('15 * * * *')).toEqual({
      path: '/api/cron/review-requests',
      payload: 'review-requests',
    });
    expect(resolveCronJob('30 6 * * *')).toEqual({
      path: '/api/cron/complaint-sla',
      payload: 'complaint-sla',
    });
  });

  it('returns null for an unknown expression', () => {
    expect(resolveCronJob('7 7 7 7 7')).toBeNull();
  });

  it('produces a signature the route guard accepts (round-trips with verifyHmac)', async () => {
    const secret = 'a'.repeat(40);
    const job = resolveCronJob('15 * * * *');
    expect(job).not.toBeNull();
    const sig = await signCronPayload(secret, job?.payload ?? '');
    expect(await verifyHmac(secret, job?.payload ?? '', sig)).toBe(true);
    // A signature for the wrong payload must be rejected.
    expect(await verifyHmac(secret, 'complaint-sla', sig)).toBe(false);
  });
});
