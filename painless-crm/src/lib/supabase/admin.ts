import { serverEnv } from '@/lib/env';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Admin (service-role) Supabase client. Bypasses RLS.
 * Only use in dedicated admin endpoints, webhooks, or background jobs.
 * Never import this from app routes that handle user requests directly
 * unless you've authorized the caller as super_admin.
 */
export function createAdminClient() {
  const env = serverEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin client');
  }
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
