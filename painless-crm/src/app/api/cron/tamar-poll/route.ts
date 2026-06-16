// Polls Tamar's Call Stats API (CDRs) and ingests calls into phone_calls
// (ADR-041). Pull-based — Tamar has no inbound webhook — so this runs on a
// schedule (recommended every 5 minutes via wrangler cron). Same auth shape as
// every other cron: HMAC over the literal payload string against
// CRM_WEBHOOK_SECRET. No-ops (still 200) when the Tamar key/number/tenant env
// is absent, so the schedule is safe to register before go-live.

import { serverEnv } from '@/lib/env';
import { runTamarPoll } from '@/lib/integrations/tamar/poll';
import { createAdminClient } from '@/lib/supabase/admin';
import { isFreshTimestamp, verifyHmac } from '@/lib/webhooks/handler';
import { NextResponse } from 'next/server';

const CRON_PAYLOAD = 'tamar-poll';

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
    const result = await runTamarPoll(new Date());
    // Diagnostic (temporary): surface the poll outcome both in Workers Logs and
    // in a Supabase table we can read directly (the MCP can't tail CF logs).
    console.log('[tamar-poll]', JSON.stringify(result));
    try {
      await createAdminClient().from('tamar_poll_diag').insert({ result });
    } catch {
      // best-effort diagnostic write
    }
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
