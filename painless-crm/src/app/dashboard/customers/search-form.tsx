'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CustomerSearchForm({
  initialQuery,
  initialType,
  initialCreatedFrom,
  initialCreatedTo,
}: {
  initialQuery: string;
  initialType: string;
  initialCreatedFrom: string;
  initialCreatedTo: string;
}) {
  const router = useRouter();
  const t = useTranslations('customers');
  const [q, setQ] = useState(initialQuery);
  const [type, setType] = useState(initialType);
  const [createdFrom, setCreatedFrom] = useState(initialCreatedFrom);
  const [createdTo, setCreatedTo] = useState(initialCreatedTo);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (type !== 'all') params.set('type', type);
    if (createdFrom) params.set('created_from', createdFrom);
    if (createdTo) params.set('created_to', createdTo);
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
      <label className="flex items-center gap-1.5 text-[var(--color-muted-foreground)]">
        {t('createdFrom')}
        <input
          type="date"
          value={createdFrom}
          max={createdTo || undefined}
          onChange={(e) => setCreatedFrom(e.target.value)}
          className="rounded-md border bg-transparent px-2 py-2 text-[var(--color-foreground)] outline-none focus:ring-2"
        />
      </label>
      <label className="flex items-center gap-1.5 text-[var(--color-muted-foreground)]">
        {t('createdTo')}
        <input
          type="date"
          value={createdTo}
          min={createdFrom || undefined}
          onChange={(e) => setCreatedTo(e.target.value)}
          className="rounded-md border bg-transparent px-2 py-2 text-[var(--color-foreground)] outline-none focus:ring-2"
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
      >
        {t('search')}
      </button>
    </form>
  );
}
