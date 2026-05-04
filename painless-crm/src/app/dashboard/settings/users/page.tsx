import { requireRole } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { InvitationsList } from './invitations-list';
import { InviteForm } from './invite-form';
import { UsersList } from './users-list';

export default async function UsersSettingsPage() {
  const me = await requireRole(['admin', 'super_admin']);
  const t = await getTranslations('users');

  const supabase = await createClient();
  const [usersResult, invitesResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, full_name, role, active, created_at')
      .eq('company_id', me.company_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_invitations')
      .select('id, email, role, expires_at, accepted_at, created_at')
      .eq('company_id', me.company_id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
  ]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>
      </header>

      <section className="flex flex-col gap-3 rounded-md border p-6">
        <h2 className="text-lg font-medium">{t('inviteTitle')}</h2>
        <InviteForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t('pendingInvites')}</h2>
        <InvitationsList rows={invitesResult.data ?? []} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t('teamMembers')}</h2>
        <UsersList rows={usersResult.data ?? []} currentUserId={me.id} />
      </section>
    </main>
  );
}
