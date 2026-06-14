import type { PendingNotification, RecipientDelivery } from '@/lib/notifications/delivery';
import { parseEventPrefs } from '@/lib/notifications/prefs';
import { createAdminClient } from '@/lib/supabase/admin';

// Data layer for the notification email sweeps. Runs on the service-role client
// (no user session) so it spans every tenant; the pure delivery layer regroups
// per recipient. Reads are bounded by MAX_PENDING; stamping is chunked.

const MAX_PENDING = 5000;
const STAMP_CHUNK = 500;

// All notifications not yet considered for email, newest first.
export async function fetchPendingEmailNotifications(): Promise<PendingNotification[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('notifications')
    .select('id, recipient_user_id, type, title, link_url, created_at')
    .is('email_sent_at', null)
    .order('created_at', { ascending: false })
    .limit(MAX_PENDING);
  return (data ?? []) as PendingNotification[];
}

// Resolve delivery info for the given recipients: email + active flag from
// users, master switch + per-event prefs from notification_preferences. Users
// with no preference row default to enabled with empty prefs (catalog defaults).
export async function fetchRecipientDeliveries(
  userIds: readonly string[],
): Promise<Map<string, RecipientDelivery>> {
  const map = new Map<string, RecipientDelivery>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return map;

  const supabase = createAdminClient();
  const [{ data: userRows }, { data: prefRows }] = await Promise.all([
    supabase.from('users').select('id, email, active').in('id', ids),
    supabase
      .from('notification_preferences')
      .select('user_id, email_digest_enabled, event_prefs')
      .in('user_id', ids),
  ]);

  const prefByUser = new Map<string, { masterEnabled: boolean; prefs: ReturnType<typeof parseEventPrefs> }>();
  for (const p of (prefRows ?? []) as Array<{
    user_id: string;
    email_digest_enabled: boolean | null;
    event_prefs: unknown;
  }>) {
    prefByUser.set(p.user_id, {
      masterEnabled: p.email_digest_enabled ?? true,
      prefs: parseEventPrefs(p.event_prefs),
    });
  }

  for (const u of (userRows ?? []) as Array<{ id: string; email: string | null; active: boolean | null }>) {
    const pref = prefByUser.get(u.id);
    map.set(u.id, {
      email: u.email,
      active: u.active ?? false,
      masterEnabled: pref?.masterEnabled ?? true,
      prefs: pref?.prefs ?? {},
    });
  }
  return map;
}

// Stamp email_sent_at on the given notifications so no sweep re-sends them.
export async function stampEmailed(ids: readonly string[], nowIso: string): Promise<void> {
  if (ids.length === 0) return;
  const supabase = createAdminClient();
  for (let i = 0; i < ids.length; i += STAMP_CHUNK) {
    const chunk = ids.slice(i, i + STAMP_CHUNK);
    await supabase.from('notifications').update({ email_sent_at: nowIso }).in('id', chunk);
  }
}
