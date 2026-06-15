'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export type JobsView = 'grid' | 'list' | 'kanban';

const ICONS: Record<JobsView, string> = { grid: '▦', list: '☰', kanban: '⫿' };

export function JobsViewToggle({ view }: { view: JobsView }) {
  const t = useTranslations('jobs');
  const params = useSearchParams();

  function buildHref(target: JobsView) {
    const next = new URLSearchParams(params);
    if (target === 'grid') {
      next.delete('view');
    } else {
      next.set('view', target);
    }
    next.delete('page');
    const qs = next.toString();
    return qs ? `/dashboard/jobs?${qs}` : '/dashboard/jobs';
  }

  const labels: Record<JobsView, string> = {
    grid: t('viewGrid'),
    list: t('viewList'),
    kanban: t('viewKanban'),
  };

  return (
    <div
      className="inline-flex rounded-lg border bg-[var(--color-muted)]/40 p-0.5 text-sm"
      role="tablist"
    >
      {(['grid', 'list', 'kanban'] as const).map((target) => (
        <Link
          key={target}
          href={buildHref(target)}
          role="tab"
          aria-selected={view === target}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all duration-150 ${
            view === target
              ? 'bg-[var(--color-background)] font-medium shadow-sm'
              : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
          }`}
        >
          <span aria-hidden>{ICONS[target]}</span>
          {labels[target]}
        </Link>
      ))}
    </div>
  );
}
