'use client';

import { signOut } from '@/lib/auth/actions';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

export function SignOutButton() {
  const t = useTranslations('auth');
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => signOut())}
      className="rounded-md border px-3 py-1.5 text-xs hover:bg-[var(--color-muted)] disabled:opacity-50"
    >
      {t('signOut')}
    </button>
  );
}
