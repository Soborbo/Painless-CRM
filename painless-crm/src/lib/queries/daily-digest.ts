import type { DigestNotification, DigestRecipient } from '@/lib/notifications/daily-digest';
import { createAdminClient } from '@/lib/supabase/admin';

// Data layer for the daily digest cron (Phase 15). Runs on the service-role
// client — no user session — so reads span every tenant; the pure layer regroups
// per recipient. Only users who actually received a notification in the window
// are loaded (with their email + digest preference), so the recipient set stays
// bounded regardless of org size.

const MAX_NOTIFICATIONS = 5000;

export interface DailyDigestData {
  notifications: DigestNotification[];
  recipients: DigestRecipient[];
}

export async function fetchDailyDigestData(sinceIso: string): Promise<DailyDigestData> {
  const supabase = createAdminClient();

  const { data: notifRows } = await supabase
    .from('notifications')
    .select('recipient_user_id, type, title, link_url, created_at')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(MAX_NOTIFICATIONS);

  const notifications = (notifRows ?? []) as DigestNotification[];
  const recipientIds = [...new Set(notifications.map((n) => n.recipient_user_id))];
  if (recipientIds.length === 0) return { notifications, recipients: [] };

  const [{ data: userRows }, { data: prefRows }] = await Promise.all([
    supabase.from('users').select('id, email').eq('active', true).in('id', recipientIds),
    supabase
      .from('notification_preferences')
      .select('user_id, email_digest_enabled')
      .in('user_id', recipientIds),
  ]);

  // Default to enabled when no preference row exists (matches the column default).
  const enabledByUser = new Map<string, boolean>();
  for (const p of (prefRows ?? []) as Array<{
    user_id: string;
    email_digest_enabled: boolean | null;
  }>) {
    enabledByUser.set(p.user_id, p.email_digest_enabled ?? true);
  }

  const recipients: DigestRecipient[] = ((userRows ?? []) as Array<{
    id: string;
    email: string | null;
  }>)
    .filter((u) => !!u.email)
    .map((u) => ({
      user_id: u.id,
      email: u.email as string,
      digest_enabled: enabledByUser.get(u.id) ?? true,
    }));

  return { notifications, recipients };
}
