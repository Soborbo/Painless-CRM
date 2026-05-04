'use server';

import { serverEnv } from '@/lib/env';
import {
  MagicLinkSchema,
  RequestPasswordResetSchema,
  SetNewPasswordSchema,
  SignInSchema,
} from '@/lib/schemas/auth';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export type ActionState = { ok: boolean; message?: string };

const GENERIC_AUTH_ERROR: ActionState = { ok: false, message: 'Invalid credentials' };

export async function signInWithPassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = SignInSchema.safeParse({
    email: form.get('email'),
    password: form.get('password'),
  });
  if (!parsed.success) return { ok: false, message: 'Check email and password' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return GENERIC_AUTH_ERROR;

  const next = (form.get('next') as string | null) ?? '/dashboard';
  redirect(next.startsWith('/') ? next : '/dashboard');
}

export async function sendMagicLink(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = MagicLinkSchema.safeParse({ email: form.get('email') });
  if (!parsed.success) return { ok: false, message: 'Enter a valid email' };

  const supabase = await createClient();
  const env = serverEnv();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback` },
  });
  if (error) return { ok: false, message: 'Could not send magic link' };

  return { ok: true, message: 'Magic link sent. Check your inbox.' };
}

export async function requestPasswordReset(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = RequestPasswordResetSchema.safeParse({ email: form.get('email') });
  if (!parsed.success) return { ok: false, message: 'Enter a valid email' };

  const supabase = await createClient();
  const env = serverEnv();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  });
  return { ok: true, message: 'If the email exists, a reset link is on its way.' };
}

export async function setNewPassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = SetNewPasswordSchema.safeParse({
    password: form.get('password'),
    confirmPassword: form.get('confirmPassword'),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Session expired. Open the link from email again.' };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: 'Could not update password' };

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
