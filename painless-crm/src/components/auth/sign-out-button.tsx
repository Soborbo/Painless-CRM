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
      className="rounded-[3px] border border-current/25 px-3 py-1.5 text-xs outline-none transition-colors hover:bg-current/10 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50"
    >
      {t('signOut')}
    </button>
  );
}
