// Polls the Gmail API and ingests inbound mail into email_messages (ADR-044).
// Pull-based — no push subscription wired in this round — so this runs on a
// schedule (every 5 min via wrangler cron). Same auth shape as every other
// cron: HMAC over the literal payload string against CRM_WEBHOOK_SECRET.
// No-ops (still 200) when the Gmail creds / mailbox / tenant env is absent.

import { serverEnv } from '@/lib/env';
import { runGmailPoll } from '@/lib/integrations/gmail/poll';
import { isFreshTimestamp, verifyHmac } from '@/lib/webhooks/handler';
import { NextResponse } from 'next/server';

const CRON_PAYLOAD = 'gmail-poll';

export async function POST(req: Request): Promise<Response> {
  const env = serverEnv();
  const secret = env.CRM_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'cron_disabled' }, { status: 503 });
  }
  const ts = req.headers.get('x-cron-timestamp');
  if (!isFreshTimestamp(ts, Date.now())) {
    return NextResponse.json({ error: 'stale_timestamp' }, { status: 401 });
  }
  const valid = await verifyHmac(
    secret,
    `${ts}.${CRON_PAYLOAD}`,
    req.headers.get('x-cron-signature'),
  );
  if (!valid) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  try {
    const result = await runGmailPoll(new Date());
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'processor_failed',
        message: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
