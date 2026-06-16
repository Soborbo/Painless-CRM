// Daily task digest (ADR-042). Fires at 08:10 and 09:10 UTC; the London-local
// guard lets only the 09:00-London run proceed, so it lands at 09:00 BST/GMT.
// Emits task.due / task.overdue in-app notifications to each assignee of every
// open task due by end of today; the notify-* sweeps email them per subscription.
//
// HMAC-guarded like every /api/cron/* route (fixed CRON_PAYLOAD).

import { guardCronRequest } from '@/lib/notifications/cron-route';
import { planLondonFlush } from '@/lib/notifications/delivery';
import { runTaskDigest } from '@/lib/notifications/task-digest';
import { NextResponse } from 'next/server';

const CRON_PAYLOAD = 'task-digest';

export async function POST(req: Request): Promise<Response> {
  const denied = await guardCronRequest(req, CRON_PAYLOAD);
  if (denied) return denied;

  try {
    const now = new Date();
    if (!planLondonFlush(now).isDaily9am) {
      return NextResponse.json({ ok: true, skipped: 'outside_london_window' });
    }
    const result = await runTaskDigest(now);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'task_digest_failed',
        message: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
