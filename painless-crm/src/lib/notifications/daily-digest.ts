// Phase 15 — daily notification digest. Pure composition: groups the last
// day's notifications per recipient and renders one plain-text email per user
// who has the digest enabled, an email, and at least one notification. The
// cron route + query layer supply already-resolved rows so this stays
// unit-testable without Supabase/Resend.

export interface DigestNotification {
  recipient_user_id: string;
  type: string;
  title: string;
  link_url: string | null;
  created_at: string;
}

export interface DigestRecipient {
  user_id: string;
  email: string;
  /** From notification_preferences.email_digest_enabled (default true). */
  digest_enabled: boolean;
}

export interface DailyDigest {
  userId: string;
  recipients: string[];
  subject: string;
  text: string;
}

function digestSubject(count: number): string {
  return count === 1 ? '1 new notification' : `${count} new notifications`;
}

function composeText(notifications: readonly DigestNotification[]): string {
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return [
    `Good morning — ${sorted.length} update${sorted.length === 1 ? '' : 's'} since yesterday:`,
    '',
    ...sorted.map((n) => `• ${n.title}`),
    '',
    'Open your notifications: /dashboard/notifications',
  ].join('\n');
}

export function buildDailyDigests(
  notifications: readonly DigestNotification[],
  recipients: readonly DigestRecipient[],
): DailyDigest[] {
  const byUser = new Map<string, DigestNotification[]>();
  for (const n of notifications) {
    const list = byUser.get(n.recipient_user_id) ?? [];
    list.push(n);
    byUser.set(n.recipient_user_id, list);
  }

  const digests: DailyDigest[] = [];
  for (const r of recipients) {
    if (!r.email || !r.digest_enabled) continue;
    const items = byUser.get(r.user_id);
    if (!items || items.length === 0) continue;
    digests.push({
      userId: r.user_id,
      recipients: [r.email],
      subject: digestSubject(items.length),
      text: composeText(items),
    });
  }
  return digests;
}
