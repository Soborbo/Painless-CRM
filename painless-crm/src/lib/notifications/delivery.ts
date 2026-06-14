import { effectiveFreq, type EventPrefs, type Frequency } from './prefs';

// Pure email-delivery planning for the notification sweeps. Given the pending
// (un-emailed) notifications and each recipient's delivery prefs, decide — for
// one frequency bucket — which emails to send and which rows to "janitor"
// (stamp without sending). No Supabase/Resend/clock here, so it is fully
// unit-testable; the cron wrapper supplies rows and persists the result.

export interface PendingNotification {
  id: string;
  recipient_user_id: string;
  type: string;
  title: string;
  link_url: string | null;
  created_at: string;
}

export interface RecipientDelivery {
  email: string | null;
  active: boolean;
  /** notification_preferences.email_digest_enabled — master email kill-switch. */
  masterEnabled: boolean;
  prefs: EventPrefs;
}

export interface EmailPlan {
  userId: string;
  to: string;
  subject: string;
  text: string;
  ids: string[];
}

export interface SweepPlan {
  emails: EmailPlan[];
  /** Rows to stamp email_sent_at without sending (immediate sweep only). */
  janitorIds: string[];
}

function deliverable(r: RecipientDelivery | undefined): r is RecipientDelivery {
  return !!r && r.active && !!r.email && r.masterEnabled;
}

// Plan one frequency bucket. The 'immediate' sweep doubles as the janitor: it
// stamps rows that can never be emailed (no recipient / inactive / master-off)
// and rows the user set to 'off', so they don't accumulate as "pending email".
// Other buckets only ever pick up rows whose effective frequency matches them.
export function planSweep(
  bucket: Exclude<Frequency, 'off'>,
  notifications: readonly PendingNotification[],
  recipientsById: ReadonlyMap<string, RecipientDelivery>,
): SweepPlan {
  const isJanitor = bucket === 'immediate';
  const byUser = new Map<string, PendingNotification[]>();
  const janitorIds: string[] = [];

  for (const n of notifications) {
    const r = recipientsById.get(n.recipient_user_id);
    if (!deliverable(r)) {
      if (isJanitor) janitorIds.push(n.id);
      continue;
    }
    const freq = effectiveFreq(r.prefs, n.type);
    if (freq === bucket) {
      const list = byUser.get(n.recipient_user_id) ?? [];
      list.push(n);
      byUser.set(n.recipient_user_id, list);
    } else if (freq === 'off' && isJanitor) {
      janitorIds.push(n.id);
    }
  }

  const emails: EmailPlan[] = [];
  for (const [userId, items] of byUser) {
    const r = recipientsById.get(userId);
    if (!r?.email) continue;
    emails.push({
      userId,
      to: r.email,
      subject: subjectFor(bucket, items.length),
      text: composeText(bucket, items),
      ids: items.map((n) => n.id),
    });
  }

  return { emails, janitorIds };
}

const BUCKET_LEAD: Record<Exclude<Frequency, 'off'>, string> = {
  immediate: 'New CRM activity',
  hourly: 'CRM activity this hour',
  daily: 'Your CRM daily summary',
  weekly: 'Your CRM weekly summary',
};

function subjectFor(bucket: Exclude<Frequency, 'off'>, count: number): string {
  const noun = count === 1 ? '1 update' : `${count} updates`;
  return `${BUCKET_LEAD[bucket]} — ${noun}`;
}

function composeText(
  bucket: Exclude<Frequency, 'off'>,
  notifications: readonly PendingNotification[],
): string {
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return [
    `${BUCKET_LEAD[bucket]} (${sorted.length}):`,
    '',
    ...sorted.map((n) => `• ${n.title}`),
    '',
    'Open your notifications: /dashboard/notifications',
  ].join('\n');
}

// London-local flush windows for the daily/weekly notification crons. The crons
// fire at both 08:00 and 09:00 UTC; this guard lets exactly the run where London
// local time is 09:00 proceed, so the digest lands at 09:00 BST in summer and
// 09:00 GMT in winter without per-season config. email_sent_at makes it
// idempotent if both runs ever evaluate true.
export interface LondonFlush {
  isDaily9am: boolean;
  isWeeklyMon9am: boolean;
}

export function planLondonFlush(now: Date): LondonFlush {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '-1');
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const is9am = hour === 9;
  return { isDaily9am: is9am, isWeeklyMon9am: is9am && weekday === 'Mon' };
}
