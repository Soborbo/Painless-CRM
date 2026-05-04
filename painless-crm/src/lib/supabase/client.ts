import { clientEnv } from '@/lib/env';
import { createBrowserClient } from '@supabase/ssr';

// TODO(phase-01): wire `<Database>` generic once @supabase/ssr upgrade lands.
// 0.5.2 imports GenericSchema from a stale subpath of supabase-js and clobbers
// the schema inference. Generated types live in src/lib/database.types.ts.
export function createClient() {
  const env = clientEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
