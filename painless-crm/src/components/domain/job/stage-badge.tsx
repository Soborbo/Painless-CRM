import type { JobStage } from '@/lib/jobs/state-machine';
import { useTranslations } from 'next-intl';

const STAGE_STYLES: Record<JobStage, string> = {
  lead: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  contacted: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
  survey_scheduled: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
  quoted: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
  accepted: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
  confirmed: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
  in_progress: 'bg-[var(--color-success)]/25 text-[var(--color-success)]',
  completed: 'bg-[var(--color-success)]/25 text-[var(--color-success)]',
  invoiced: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
  paid: 'bg-[var(--color-success)]/30 text-[var(--color-success)]',
  declined: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
  dead: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  cancelled: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
};

export function StageBadge({ stage }: { stage: JobStage }) {
  const t = useTranslations('jobs');
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${STAGE_STYLES[stage]}`}
    >
      {t(`stages.${stage}`)}
    </span>
  );
}
