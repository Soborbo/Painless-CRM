'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CustomerSearchForm({
  initialQuery,
  initialType,
}: {
  initialQuery: string;
  initialType: string;
}) {
  const router = useRouter();
  const t = useTranslations('customers');
  const [q, setQ] = useState(initialQuery);
  const [type, setType] = useState(initialType);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (type !== 'all') params.set('type', type);
    const qs = params.toString();
    router.push(qs ? `/dashboard/customers?${qs}` : '/dashboard/customers');
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-3 text-sm">
      <input
        type="search"
        placeholder={t('searchPlaceholder')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="min-w-64 flex-1 rounded-md border px-3 py-2 outline-none focus:ring-2"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2"
      >
        <option value="all">{t('typeAll')}</option>
        <option value="individual">{t('typeIndividual')}</option>
        <option value="business">{t('typeBusiness')}</option>
      </select>
      <button
        type="submit"
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
      >
        {t('search')}
      </button>
    </form>
  );
}
