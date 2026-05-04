import { serverEnv } from '@/lib/env';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// TODO(phase-01): wire `<Database>` generic once @supabase/ssr upgrade lands.
// 0.5.2 imports GenericSchema from a stale subpath of supabase-js and clobbers
// the schema inference. Generated types live in src/lib/database.types.ts.
export async function createClient() {
  const env = serverEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component context — cookies are read-only here. Handled by proxy.ts.
        }
      },
    },
  });
}
