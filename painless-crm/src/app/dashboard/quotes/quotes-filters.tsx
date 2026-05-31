'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

// Status filter for the office-wide quotes list. Navigating is enough to
// re-run the server component, so this is a controlled select that pushes on
// change — no submit button needed for a single dropdown.
export function QuotesFilters({
  initialStatus,
  statuses,
}: {
  initialStatus: string;
  statuses: string[];
}) {
  const router = useRouter();
  const t = useTranslations('quotes');

  function onChange(value: string) {
    const params = new URLSearchParams();
    if (value !== 'all') params.set('status', value);
    const qs = params.toString();
    router.push(qs ? `/dashboard/quotes?${qs}` : '/dashboard/quotes');
  }

  return (
    <form className="flex flex-wrap items-center gap-3 text-sm">
      <label className="text-[var(--color-muted-foreground)]" htmlFor="quote-status">
        {t('list.statusFilter')}
      </label>
      <select
        id="quote-status"
        defaultValue={initialStatus}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2"
      >
        <option value="all">{t('list.statusAll')}</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {t(`status.${s}` as never)}
          </option>
        ))}
      </select>
    </form>
  );
}
