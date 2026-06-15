import { type EventPrefs, parseEventPrefs } from '@/lib/notifications/prefs';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// Phase 15 — current user's notification preferences. RLS (notification_
// preferences_self) scopes the read to the caller. No row yet means the user
// has never changed defaults, so we return the column defaults (all enabled).

export interface MyNotificationPreferences {
  emailDigestEnabled: boolean;
  pushEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: MyNotificationPreferences = {
  emailDigestEnabled: true,
  pushEnabled: true,
};

export async function getMyNotificationPreferences(
  userId: string,
): Promise<MyNotificationPreferences> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('notification_preferences')
    .select('email_digest_enabled, push_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return DEFAULT_NOTIFICATION_PREFERENCES;
  return {
    emailDigestEnabled: data.email_digest_enabled ?? true,
    pushEnabled: data.push_enabled ?? true,
  };
}

// Per-event email frequency prefs for a user (ADR-040). Read on the admin
// client so a manager can view/edit another company user's subscriptions; the
// caller is responsible for the role + same-company check (see the action).
export async function getEventPrefsFor(userId: string): Promise<EventPrefs> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('notification_preferences')
    .select('event_prefs')
    .eq('user_id', userId)
    .maybeSingle();
  return parseEventPrefs((data as { event_prefs?: unknown } | null)?.event_prefs);
}

export interface CompanyUserOption {
  id: string;
  label: string;
}

// Active users in the company, for the admin "edit subscriptions for…" picker.
export async function listCompanyUsers(companyId: string): Promise<CompanyUserOption[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('company_id', companyId)
    .eq('active', true)
    .order('full_name', { ascending: true });
  return ((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map(
    (u) => ({ id: u.id, label: u.full_name || u.email || u.id }),
  );
}
