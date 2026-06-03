'use server';

import { requireRole } from '@/lib/auth/require-role';
import { serverEnv } from '@/lib/env';
import { sendInviteEmail } from '@/lib/integrations/resend/invite';
import { AcceptInviteSchema, InviteUserSchema } from '@/lib/schemas/invite';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export type ActionState = { ok: boolean; message?: string };

const ADMIN_ROLES = ['admin', 'super_admin'] as const;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function inviteUser(_prev: ActionState, form: FormData): Promise<ActionState> {
  const inviter = await requireRole(ADMIN_ROLES);

  const parsed = InviteUserSchema.safeParse({
    email: form.get('email'),
    role: form.get('role'),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const token = generateToken();
  const { error } = await supabase.from('user_invitations').insert({
    company_id: inviter.company_id,
    email: parsed.data.email.toLowerCase(),
    role: parsed.data.role,
    invited_by_id: inviter.id,
    token,
  });
  if (error) return { ok: false, message: 'Could not create invitation' };

  const env = serverEnv();
  await sendInviteEmail({
    to: parsed.data.email,
    inviterName: inviter.full_name,
    acceptUrl: `${env.NEXT_PUBLIC_APP_URL}/auth/accept-invite?token=${token}`,
  });

  revalidatePath('/dashboard/settings/users');
  return { ok: true, message: 'Invitation sent' };
}

export async function revokeInvitation(_prev: ActionState, form: FormData): Promise<ActionState> {
  const inviter = await requireRole(ADMIN_ROLES);
  const id = form.get('id');
  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, message: 'Missing invitation id' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('user_invitations')
    .delete()
    .eq('id', id)
    .eq('company_id', inviter.company_id)
    .is('accepted_at', null);
  if (error) return { ok: false, message: 'Could not revoke invitation' };

  revalidatePath('/dashboard/settings/users');
  return { ok: true };
}

export async function acceptInvitation(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = AcceptInviteSchema.safeParse({
    token: form.get('token'),
    full_name: form.get('full_name'),
    password: form.get('password'),
    confirmPassword: form.get('confirmPassword'),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const admin = createAdminClient();
  const { data: invite, error: lookupError } = await admin
    .from('user_invitations')
    .select('id, company_id, email, role, expires_at, accepted_at')
    .eq('token', parsed.data.token)
    .maybeSingle();

  if (lookupError || !invite) return { ok: false, message: 'Invitation not found' };
  if (invite.accepted_at) return { ok: false, message: 'Invitation already used' };
  if (new Date(invite.expires_at) < new Date()) {
    return { ok: false, message: 'Invitation expired. Ask for a new one.' };
  }

  // Atomically CLAIM the invitation before provisioning so two concurrent
  // accepts of the same token can't both proceed (audit, TOCTOU). Mirrors the
  // atomic `.is('accepted_at', null)` pattern revokeInvitation already uses. We
  // release the claim below if provisioning fails so a genuine retry can succeed.
  const { data: claimed } = await admin
    .from('user_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)
    .is('accepted_at', null)
    .select('id')
    .maybeSingle();
  if (!claimed) return { ok: false, message: 'Invitation already used' };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: invite.email,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    await admin.from('user_invitations').update({ accepted_at: null }).eq('id', invite.id);
    return { ok: false, message: 'Could not create user' };
  }

  const { error: profileError } = await admin.from('users').insert({
    auth_id: created.user.id,
    company_id: invite.company_id,
    email: invite.email,
    full_name: parsed.data.full_name,
    role: invite.role,
  });
  if (profileError) {
    // Best-effort cleanup: delete the auth user we just created and release the
    // claim so the invitation can be retried.
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from('user_invitations').update({ accepted_at: null }).eq('id', invite.id);
    return { ok: false, message: 'Could not create profile' };
  }

  // Invitation was already claimed (accepted_at set) atomically above.

  // Sign the new user in via the SSR client so cookies are set.
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({
    email: invite.email,
    password: parsed.data.password,
  });

  redirect('/dashboard');
}
