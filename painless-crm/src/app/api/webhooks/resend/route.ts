// Resend inbound delivery webhook (ADR-047 / INTEGRATION_CONTRACTS §8). Turns
// hard bounces and spam complaints into persistent review_suppression rows so we
// never email a bad/aggrieved address again, and closes any open requests for it.
// Svix-signed (see lib/reviews/resend-webhook). Tenant is the server-resolved
// WEBHOOK_COMPANY_ID, never a body value (audit H2). Suppression ops are
// idempotent, so an at-least-once retry is safe without explicit dedup.

import { serverEnv } from '@/lib/env';
import { addSuppression, closeActiveForEmail } from '@/lib/reviews/repo/suppression';
import { mapResendEvent, recipientOf, verifyResendSignature } from '@/lib/reviews/resend-webhook';
import { createAdminClient } from '@/lib/supabase/admin';
import { isFreshTimestamp } from '@/lib/webhooks/handler';
import { NextResponse } from 'next/server';

export async function POST(req: Request): Promise<Response> {
  const env = serverEnv();
  const secret = env.WEBHOOK_SECRET_RESEND;
  if (!secret) return NextResponse.json({ error: 'webhook_disabled' }, { status: 503 });
  const companyId = env.WEBHOOK_COMPANY_ID;
  if (!companyId) return NextResponse.json({ error: 'tenant_unconfigured' }, { status: 503 });

  const body = await req.text();
  const headers = {
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signature: req.headers.get('svix-signature'),
  };
  // Replay window first (Svix timestamp is unix seconds — same shape as our crons).
  if (!isFreshTimestamp(headers.timestamp, Date.now())) {
    return NextResponse.json({ error: 'stale_timestamp' }, { status: 401 });
  }
  if (!(await verifyResendSignature(secret, headers, body))) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const type = (json as { type?: unknown }).type;
  const effect = typeof type === 'string' ? mapResendEvent(type) : null;
  const email = recipientOf(json);
  if (effect && email) {
    const supabase = createAdminClient();
    await addSuppression(supabase, companyId, email, effect.reason);
    await closeActiveForEmail(supabase, companyId, email, effect.close);
  }
  return NextResponse.json({ ok: true });
}

export const runtime = 'nodejs';
