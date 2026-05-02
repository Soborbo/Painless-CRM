import { clientEnv } from '@/lib/env';
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const env = clientEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
