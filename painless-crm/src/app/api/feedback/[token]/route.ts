// Phase 11 §5 — public complaints submission endpoint (no auth). Reached from
// the review email's complaints link via the /feedback/{token} form. Rate
// limited per IP (Gate-5 helper), validated with Zod, persisted with the
// service-role client. Notifies the complaints owner on success.

import { notifyNewComplaint } from '@/lib/complaints/notify';
import { persistFeedback } from '@/lib/complaints/record-feedback';
import { rateLimitCheck } from '@/lib/kv/rate-limit';
import { PublicFeedbackSchema } from '@/lib/schemas/complaint';
import { NextResponse } from 'next/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('cf-connecting-ip') ?? 'unknown';
}

type Params = { params: Promise<{ token: string }> };

export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { token } = await params;
  if (!UUID_RE.test(token)) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const limit = await rateLimitCheck(`feedback:${clientIp(req)}`, {
    windowSec: 3600,
    maxRequests: 10,
  });
  if (!limit.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const parsed = PublicFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', message: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const result = await persistFeedback(token, parsed.data);
  if (!result.ok) {
    const status =
      result.reason === 'not_found' ? 404 : result.reason === 'already_submitted' ? 409 : 500;
    return NextResponse.json({ error: result.reason }, { status });
  }

  await notifyNewComplaint(result.companyId);
  return NextResponse.json({ ok: true });
}

export const runtime = 'nodejs';
