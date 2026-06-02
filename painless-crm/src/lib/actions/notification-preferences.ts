'use server';

import { requireUser } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Phase 15 — update the signed-in user's notification preferences. Upserts on
// user_id (the table's PK). The notification_preferences_self RLS policy is the
// boundary; company_id is taken from the authenticated profile, never the form.
// Checkboxes are absent from FormData when unticked, so a missing field = off.

export type PreferencesActionState =
  | { status: 'idle' }
  | { status: 'ok' }
  | { status: 'error'; message: string };

export const INITIAL_PREFERENCES_STATE: PreferencesActionState = { status: 'idle' };

export async function updateNotificationPreferences(
  _prev: PreferencesActionState,
  form: FormData,
): Promise<PreferencesActionState> {
  const me = await requireUser();

  const emailDigestEnabled = form.get('email_digest_enabled') === 'on';
  const pushEnabled = form.get('push_enabled') === 'on';

  const supabase = await createClient();
  const { error } = await supabase.from('notification_preferences').upsert(
    {
      user_id: me.id,
      company_id: me.company_id,
      email_digest_enabled: emailDigestEnabled,
      push_enabled: pushEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) return { status: 'error', message: 'Could not save preferences' };

  revalidatePath('/dashboard/settings/notifications');
  return { status: 'ok' };
}
