import { runAllSmokeTests } from '@/lib/smoke/runner';
import type { SmokeTestStatus } from '@/lib/smoke/types';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

const STATUS_STYLES: Record<SmokeTestStatus, string> = {
  pending: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  running: 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]',
  pass: 'bg-[var(--color-success)]/20 text-[var(--color-success)]',
  fail: 'bg-[var(--color-danger)]/20 text-[var(--color-danger)]',
  partial: 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]',
};

export default async function SmokePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (profile?.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const results = await runAllSmokeTests();
  const allPass = results.every((r) => r.status === 'pass');

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Phase 00 smoke tests</h1>
      <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
        Phase 01 cannot start until all 4 pass on production Workers. If 2+ fail, switch to Vercel
        and document in DECISIONS.md.
      </p>

      <div
        className={`mt-6 rounded-md border p-4 text-sm font-medium ${
          allPass ? STATUS_STYLES.pass : STATUS_STYLES.partial
        }`}
      >
        {allPass ? 'All 4 tests passing — gate clear.' : 'Gate not yet cleared.'}
      </div>

      <ul className="mt-6 divide-y rounded-md border">
        {results.map((r) => (
          <li key={r.name} className="flex items-start justify-between gap-4 p-4">
            <div>
              <p className="font-medium capitalize">{r.name}</p>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{r.note}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide ${STATUS_STYLES[r.status]}`}
            >
              {r.status}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
