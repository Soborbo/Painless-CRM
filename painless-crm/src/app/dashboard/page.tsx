import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role, company_id')
    .eq('auth_id', user.id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
        Signed in as {profile?.full_name ?? user.email}
        {profile?.role ? ` · ${profile.role}` : null}
      </p>
      <section className="mt-8 rounded-md border p-6">
        <h2 className="text-lg font-medium">Empty state</h2>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Phase 00 placeholder. Domain UI lands in phases 03 and onwards.
        </p>
      </section>
    </main>
  );
}
