import type { SLAStatus } from '@/lib/jobs/sla';
import { useTranslations } from 'next-intl';

const STYLES: Record<SLAStatus, string> = {
  on_track: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  warn: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
  breach: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
  cleared: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
  not_applicable: '',
};

export function SLABadge({ status }: { status: SLAStatus }) {
  const t = useTranslations('jobs');
  if (status === 'not_applicable' || status === 'on_track') return null;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STYLES[status]}`}
    >
      {t(`sla.${status}` as never)}
    </span>
  );
}

export const SLA_BORDER_CLASS: Record<SLAStatus, string> = {
  on_track: '',
  warn: 'border-l-4 border-l-[var(--color-warning)]',
  breach: 'border-l-4 border-l-[var(--color-danger)]',
  cleared: '',
  not_applicable: '',
};
