'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Search (by job number) + status filter for the office-wide quotes list.
// Submitting navigates, which re-runs the server component with the new
// querystring — mirrors the jobs list filter bar.
export function QuotesFilters({
  initialQ,
  initialStatus,
  statuses,
}: {
  initialQ: string;
  initialStatus: string;
  statuses: string[];
}) {
  const router = useRouter();
  const t = useTranslations('quotes');
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (status !== 'all') params.set('status', status);
    const qs = params.toString();
    router.push(qs ? `/dashboard/quotes?${qs}` : '/dashboard/quotes');
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-3 text-sm">
      <input
        type="search"
        placeholder={t('list.searchPlaceholder')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="min-w-64 flex-1 rounded-md border px-3 py-2 outline-none focus:ring-2"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2"
      >
        <option value="all">{t('list.statusAll')}</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {t(`status.${s}` as never)}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
      >
        {t('list.filter')}
      </button>
    </form>
  );
}
