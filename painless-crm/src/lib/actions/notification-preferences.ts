'use server';

import { hasRole, requireUser } from '@/lib/auth/require-role';
import { eventKeys } from '@/lib/notifications/events';
import { sanitiseEventPrefs } from '@/lib/notifications/prefs';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const PREF_MANAGER_ROLES = ['manager', 'admin', 'super_admin'] as const;

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

// Save the per-event email frequency matrix (ADR-040). A user can always edit
// their own; managers/admins can edit any user in their company. The write uses
// the admin client (to reach another user's row), gated by the role +
// same-company checks here.
export async function updateEventPrefs(
  _prev: PreferencesActionState,
  form: FormData,
): Promise<PreferencesActionState> {
  const me = await requireUser();

  const rawTarget = form.get('target_user_id');
  const targetUserId = typeof rawTarget === 'string' && rawTarget ? rawTarget : me.id;

  let companyId = me.company_id;
  if (targetUserId !== me.id) {
    if (!hasRole(me, PREF_MANAGER_ROLES)) {
      return { status: 'error', message: 'Not allowed to edit other users' };
    }
    const admin = createAdminClient();
    const { data: target } = await admin
      .from('users')
      .select('company_id')
      .eq('id', targetUserId)
      .maybeSingle();
    const targetCompany = (target as { company_id: string } | null)?.company_id;
    if (!targetCompany || targetCompany !== me.company_id) {
      return { status: 'error', message: 'User not found in your company' };
    }
    companyId = targetCompany;
  }

  // Collect freq_<eventKey> fields for catalog events only.
  const input: Record<string, string> = {};
  for (const key of eventKeys()) {
    const value = form.get(`freq_${key}`);
    if (typeof value === 'string') input[key] = value;
  }
  const eventPrefs = sanitiseEventPrefs(input);

  const supabase = createAdminClient();
  const { error } = await supabase.from('notification_preferences').upsert(
    {
      user_id: targetUserId,
      company_id: companyId,
      event_prefs: eventPrefs,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) return { status: 'error', message: 'Could not save subscriptions' };

  revalidatePath('/dashboard/settings/notifications');
  return { status: 'ok' };
}
