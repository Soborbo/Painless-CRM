import { createAdminClient } from '@/lib/supabase/admin';
import { getTranslations } from 'next-intl/server';
import { AcceptInviteForm } from './accept-form';

type Props = { searchParams: Promise<{ token?: string }> };

export default async function AcceptInvitePage({ searchParams }: Props) {
  const { token } = await searchParams;
  const t = await getTranslations('auth');

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t('inviteInvalid')}</h1>
      </main>
    );
  }

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from('user_invitations')
    .select('email, role, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle();

  if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t('inviteInvalid')}</h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          {t('inviteInvalidHelp')}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">{t('acceptInvite')}</h1>
      <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">
        {t('acceptInviteHelp', { email: invite.email })}
      </p>
      <AcceptInviteForm token={token} email={invite.email} />
    </main>
  );
}
