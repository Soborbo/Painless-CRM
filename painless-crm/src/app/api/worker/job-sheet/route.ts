// Phase 09 — end-of-job-sheet replay endpoint for the worker PWA offline queue.
// Cookie-auth, idempotent via persistJobSheet + the client_event_id dedup index.

import { getAuthedUser } from '@/lib/auth/require-role';
import { getWorkerForUser } from '@/lib/queries/worker-app';
import { JobSheetSchema } from '@/lib/schemas/job-sheet';
import { persistJobSheet } from '@/lib/worker/record-job-sheet';
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

  const parsed = JobSheetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', message: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const result = await persistJobSheet(worker, parsed.data);
  if (result === 'not_assigned')
    return NextResponse.json({ error: 'not_assigned' }, { status: 409 });
  if (result === 'error') return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export const runtime = 'nodejs';
