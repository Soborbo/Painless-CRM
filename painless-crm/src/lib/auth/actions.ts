'use server';

import { serverEnv } from '@/lib/env';
import { type RateLimitOptions, rateLimitCheck } from '@/lib/kv/rate-limit';
import {
  MagicLinkSchema,
  RequestPasswordResetSchema,
  SetNewPasswordSchema,
  SignInSchema,
} from '@/lib/schemas/auth';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export type ActionState = { ok: boolean; message?: string };

const GENERIC_AUTH_ERROR: ActionState = { ok: false, message: 'Invalid credentials' };
// Only same-origin relative paths; rejects protocol-relative (//evil.com) and
// absolute URLs. Mirrors SAFE_NEXT in src/app/auth/callback/route.ts.
const SAFE_NEXT = /^\/(?!\/)/;
const RATE_LIMITED: ActionState = {
  ok: false,
  message: 'Too many attempts. Please wait a few minutes and try again.',
};

async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown';
  return h.get('cf-connecting-ip') ?? 'unknown';
}

// Brute-force / abuse gate for the unauthenticated auth actions. Counts every
// attempt per IP and per email in a fixed window (Cloudflare KV). Degrades open
// when no KV binding is present (local dev / tests), like the webhook gates.
async function authRateLimited(
  scope: string,
  email: string,
  ipOpts: RateLimitOptions,
  emailOpts: RateLimitOptions,
): Promise<boolean> {
  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimitCheck(`${scope}-ip:${ip}`, ipOpts),
    rateLimitCheck(`${scope}-email:${email.toLowerCase()}`, emailOpts),
  ]);
  return !byIp.ok || !byEmail.ok;
}

export async function signInWithPassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = SignInSchema.safeParse({
    email: form.get('email'),
    password: form.get('password'),
  });
  if (!parsed.success) return { ok: false, message: 'Check email and password' };

  if (
    await authRateLimited(
      'login',
      parsed.data.email,
      { windowSec: 300, maxRequests: 20 },
      { windowSec: 900, maxRequests: 6 },
    )
  ) {
    return RATE_LIMITED;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return GENERIC_AUTH_ERROR;

  const next = (form.get('next') as string | null) ?? '/dashboard';
  redirect(SAFE_NEXT.test(next) ? next : '/dashboard');
}

export async function sendMagicLink(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = MagicLinkSchema.safeParse({ email: form.get('email') });
  if (!parsed.success) return { ok: false, message: 'Enter a valid email' };

  if (
    await authRateLimited(
      'magiclink',
      parsed.data.email,
      { windowSec: 900, maxRequests: 5 },
      { windowSec: 900, maxRequests: 3 },
    )
  ) {
    return RATE_LIMITED;
  }

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

  // On abuse, return the same neutral message without sending — never reveal
  // whether the email exists, and don't let the endpoint be an email cannon.
  const NEUTRAL = { ok: true, message: 'If the email exists, a reset link is on its way.' };
  if (
    await authRateLimited(
      'pwreset',
      parsed.data.email,
      { windowSec: 900, maxRequests: 5 },
      { windowSec: 900, maxRequests: 3 },
    )
  ) {
    return NEUTRAL;
  }

  const supabase = await createClient();
  const env = serverEnv();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  });
  return NEUTRAL;
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
