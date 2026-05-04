'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export function JobsViewToggle({ view }: { view: 'list' | 'kanban' }) {
  const t = useTranslations('jobs');
  const params = useSearchParams();

  function buildHref(target: 'list' | 'kanban') {
    const next = new URLSearchParams(params);
    if (target === 'list') {
      next.delete('view');
    } else {
      next.set('view', target);
    }
    next.delete('page');
    const qs = next.toString();
    return qs ? `/dashboard/jobs?${qs}` : '/dashboard/jobs';
  }

  return (
    <div className="inline-flex rounded-md border text-sm" role="tablist">
      <Link
        href={buildHref('list')}
        role="tab"
        aria-selected={view === 'list'}
        className={`rounded-l-md px-3 py-1.5 ${
          view === 'list'
            ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
            : 'hover:bg-[var(--color-muted)]'
        }`}
      >
        {t('viewList')}
      </Link>
      <Link
        href={buildHref('kanban')}
        role="tab"
        aria-selected={view === 'kanban'}
        className={`rounded-r-md px-3 py-1.5 ${
          view === 'kanban'
            ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
            : 'hover:bg-[var(--color-muted)]'
        }`}
      >
        {t('viewKanban')}
      </Link>
    </div>
  );
}
