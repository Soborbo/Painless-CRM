// Phase 09 — clock-in replay endpoint for the worker PWA offline queue.
// The queue POSTs each pending clock-in here (cookie-authenticated). Idempotent
// via persistClockIn() + the client_event_id dedup index, so retrying the same
// queued item never creates a duplicate. Returns 200 for both a fresh insert
// and a replayed duplicate, so the queue can safely drop the item.

import { getAuthedUser } from '@/lib/auth/require-role';
import { getWorkerForUser } from '@/lib/queries/worker-app';
import { ClockInSchema } from '@/lib/schemas/clock-in';
import { persistClockIn } from '@/lib/worker/record-clock-in';
import { NextResponse } from 'next/server';

const WORKER_APP_ROLES = ['loader', 'surveyor', 'manager', 'admin', 'super_admin'];

export async function POST(req: Request): Promise<Response> {
  const me = await getAuthedUser();
  if (!me) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  if (!WORKER_APP_ROLES.includes(me.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const worker = await getWorkerForUser(me.id);
  if (!worker) return NextResponse.json({ error: 'no_worker_profile' }, { status: 422 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const parsed = ClockInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', message: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const result = await persistClockIn(worker, parsed.data);
  if (result === 'not_assigned') {
    return NextResponse.json({ error: 'not_assigned' }, { status: 409 });
  }
  if (result === 'error') {
    return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export const runtime = 'nodejs';
