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
