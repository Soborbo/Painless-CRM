import type { PhoneCallRow } from '@/lib/queries/phone-calls';
import { formatDateTime } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs ? `${mins}m ${secs}s` : `${mins}m`;
}

export async function CallsPanel({ rows }: { rows: PhoneCallRow[] }) {
  const t = await getTranslations('phoneCalls');

  if (rows.length === 0) {
    return (
      <Section title={t('panelTitle')}>
        <p className="text-sm text-[var(--color-muted-foreground)]">{t('empty')}</p>
      </Section>
    );
  }

  return (
    <Section title={t('panelTitle')}>
      <ul className="flex flex-col divide-y">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">
                {row.direction ? t(`directions.${row.direction}`) : '—'} ·{' '}
                {formatDuration(row.duration_seconds)}
              </span>
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {formatDateTime(row.occurred_at)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs text-[var(--color-muted-foreground)]">
              {row.user ? <span>{row.user.full_name}</span> : null}
              {row.source && row.source !== 'manual' ? (
                <span>· {t(`sources.${row.source}` as never)}</span>
              ) : null}
              {row.caller_number ? <span>· {t('from', { num: row.caller_number })}</span> : null}
              {row.called_number ? <span>· {t('to', { num: row.called_number })}</span> : null}
            </div>
            {row.notes ? <p className="whitespace-pre-wrap text-sm">{row.notes}</p> : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-4">
      <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {title}
      </h3>
      <div className="mt-3 text-sm">{children}</div>
    </div>
  );
}
