import { verifyHmac } from '@/lib/webhooks/handler';
import { prepareCronDispatch } from '@/worker-cron/dispatch';
import { resolveCronJob } from '@/worker-cron/schedule';
import { describe, expect, it } from 'vitest';

const SECRET = 'a'.repeat(40);
const NOW = 1_700_000_000_000; // fixed clock (ms)
const TS = String(Math.floor(NOW / 1000)); // "1700000000"

describe('prepareCronDispatch', () => {
  it('builds a timestamped, canonically-signed request the route guard accepts', async () => {
    const cron = '0 9 * * *'; // sla-digest
    const job = resolveCronJob(cron);
    const result = await prepareCronDispatch(
      cron,
      { CRM_WEBHOOK_SECRET: SECRET, NEXT_PUBLIC_APP_URL: 'https://crm.example.com' },
      NOW,
    );
    expect(result.kind).toBe('dispatch');
    if (result.kind !== 'dispatch') return;
    expect(result.url).toBe('https://crm.example.com/api/cron/sla-digest');
    expect(result.timestamp).toBe(TS);
    // Signature is over the canonical `{timestamp}.{payload}` (audit M7).
    expect(await verifyHmac(SECRET, `${result.timestamp}.${job?.payload}`, result.signature)).toBe(
      true,
    );
    // The bare payload (the old replayable scheme) must NOT validate.
    expect(await verifyHmac(SECRET, job?.payload ?? '', result.signature)).toBe(false);
  });

  it('strips a trailing slash on the base URL', async () => {
    const result = await prepareCronDispatch(
      '* * * * *',
      { CRM_WEBHOOK_SECRET: SECRET, NEXT_PUBLIC_APP_URL: 'https://crm.example.com/' },
      NOW,
    );
    expect(result.kind === 'dispatch' && result.url).toBe(
      'https://crm.example.com/api/cron/automation-queue',
    );
  });

  it('falls back to the production base URL when none is set', async () => {
    const result = await prepareCronDispatch('0 9 * * *', { CRM_WEBHOOK_SECRET: SECRET }, NOW);
    expect(result.kind === 'dispatch' && result.url).toBe(
      'https://crm.painlessremovals.com/api/cron/sla-digest',
    );
  });

  it('skips an unknown cron expression', async () => {
    const result = await prepareCronDispatch('7 7 7 7 7', { CRM_WEBHOOK_SECRET: SECRET }, NOW);
    expect(result).toEqual({ kind: 'skip', reason: 'unknown_cron' });
  });

  it('skips when the webhook secret is unset', async () => {
    const result = await prepareCronDispatch('0 9 * * *', {}, NOW);
    expect(result).toEqual({ kind: 'skip', reason: 'no_secret' });
  });

  it('signs distinct payloads per route (signature is route-bound)', async () => {
    const a = await prepareCronDispatch('0 9 * * *', { CRM_WEBHOOK_SECRET: SECRET }, NOW);
    const b = await prepareCronDispatch('0 2 * * *', { CRM_WEBHOOK_SECRET: SECRET }, NOW);
    if (a.kind !== 'dispatch' || b.kind !== 'dispatch') throw new Error('expected dispatch');
    expect(a.signature).not.toBe(b.signature);
    // a's signature must NOT validate b's canonical payload.
    expect(await verifyHmac(SECRET, `${b.timestamp}.expire-quotes`, a.signature)).toBe(false);
  });
});
