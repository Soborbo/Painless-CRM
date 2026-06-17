'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

// One year, in seconds — the locale choice should outlive the session.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const LOCALES = ['en', 'hu'] as const;

// Persists the UI language in the NEXT_LOCALE cookie (read server-side by
// src/i18n/request.ts) and refreshes the server tree so the new messages and
// <html lang> take effect without a full reload.
export function LanguageToggle({ current }: { current: string }) {
  const t = useTranslations('language');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <label className="flex items-center gap-1 text-xs">
      <span className="sr-only">{t('label')}</span>
      <select
        aria-label={t('label')}
        value={LOCALES.includes(current as (typeof LOCALES)[number]) ? current : 'en'}
        onChange={onChange}
        disabled={pending}
        className="rounded-[3px] border border-current/25 bg-transparent px-2 py-1.5 text-xs outline-none transition-colors hover:bg-current/10 focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] disabled:opacity-50"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {t(l)}
          </option>
        ))}
      </select>
    </label>
  );
}
