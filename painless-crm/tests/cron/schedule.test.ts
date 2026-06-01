import { verifyHmac } from '@/lib/webhooks/handler';
import { CRON_SCHEDULE, resolveCronJob, signCronPayload } from '@/worker-cron/schedule';
import { describe, expect, it } from 'vitest';

describe('cron schedule dispatch', () => {
  it('maps every scheduled expression to a distinct /api/cron route', () => {
    const paths = Object.values(CRON_SCHEDULE).map((j) => j.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const job of Object.values(CRON_SCHEDULE)) {
      expect(job.path.startsWith('/api/cron/')).toBe(true);
    }
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
