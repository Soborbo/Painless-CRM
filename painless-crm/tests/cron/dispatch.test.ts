import { verifyHmac } from '@/lib/webhooks/handler';
import { prepareCronDispatch } from '@/worker-cron/dispatch';
import { resolveCronJob } from '@/worker-cron/schedule';
import { describe, expect, it } from 'vitest';

const SECRET = 'a'.repeat(40);

describe('prepareCronDispatch', () => {
  it('builds a signed request the route guard accepts', async () => {
    const cron = '0 9 * * *'; // sla-digest
    const job = resolveCronJob(cron);
    const result = await prepareCronDispatch(cron, {
      CRM_WEBHOOK_SECRET: SECRET,
      NEXT_PUBLIC_APP_URL: 'https://crm.example.com',
    });
    expect(result.kind).toBe('dispatch');
    if (result.kind !== 'dispatch') return;
    expect(result.url).toBe('https://crm.example.com/api/cron/sla-digest');
    expect(await verifyHmac(SECRET, job?.payload ?? '', result.signature)).toBe(true);
  });

  it('strips a trailing slash on the base URL', async () => {
    const result = await prepareCronDispatch('* * * * *', {
      CRM_WEBHOOK_SECRET: SECRET,
      NEXT_PUBLIC_APP_URL: 'https://crm.example.com/',
    });
    expect(result.kind === 'dispatch' && result.url).toBe(
      'https://crm.example.com/api/cron/automation-queue',
    );
  });

  it('falls back to the production base URL when none is set', async () => {
    const result = await prepareCronDispatch('0 9 * * *', { CRM_WEBHOOK_SECRET: SECRET });
    expect(result.kind === 'dispatch' && result.url).toBe(
      'https://crm.painlessremovals.com/api/cron/sla-digest',
    );
  });

  it('skips an unknown cron expression', async () => {
    const result = await prepareCronDispatch('7 7 7 7 7', { CRM_WEBHOOK_SECRET: SECRET });
    expect(result).toEqual({ kind: 'skip', reason: 'unknown_cron' });
  });

  it('skips when the webhook secret is unset', async () => {
    const result = await prepareCronDispatch('0 9 * * *', {});
    expect(result).toEqual({ kind: 'skip', reason: 'no_secret' });
  });

  it('signs distinct payloads per route (signature is route-bound)', async () => {
    const a = await prepareCronDispatch('0 9 * * *', { CRM_WEBHOOK_SECRET: SECRET });
    const b = await prepareCronDispatch('0 2 * * *', { CRM_WEBHOOK_SECRET: SECRET });
    if (a.kind !== 'dispatch' || b.kind !== 'dispatch') throw new Error('expected dispatch');
    expect(a.signature).not.toBe(b.signature);
    // a's signature must NOT validate b's payload
    expect(await verifyHmac(SECRET, 'expire-quotes', a.signature)).toBe(false);
  });
});
