import { requireUser } from '@/lib/auth/require-role';
import { type SlaQueueRow, bucketSlaQueue, listSlaQueue } from '@/lib/queries/sla-queue';
import { customerDisplayName, formatDateTime } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { SlaAutoRefresh } from './sla-auto-refresh';
import { SlaCountdown } from './sla-countdown';

const SCOPED_ROLES = ['sales', 'surveyor'] as const;

export const dynamic = 'force-dynamic';

export default async function SlaPage() {
  const me = await requireUser();
  const t = await getTranslations('sla');

  const scoped = (SCOPED_ROLES as readonly string[]).includes(me.role);
  const rows = await listSlaQueue({ assignedToId: scoped ? me.id : null });
  const now = new Date();
  const { overdue, dueSoon, onTrack } = bucketSlaQueue(rows, now);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <SlaAutoRefresh />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {scoped ? t('subtitleSelf') : t('subtitleAll')}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryTile tone="danger" label={t('overdue')} value={overdue.length} />
        <SummaryTile tone="warning" label={t('dueSoon')} value={dueSoon.length} />
        <SummaryTile tone="muted" label={t('onTrack')} value={onTrack.length} />
      </section>

      {overdue.length > 0 ? (
        <Group title={t('overdueGroup')} tone="danger" rows={overdue} now={now} t={t} />
      ) : null}
      {dueSoon.length > 0 ? (
        <Group title={t('dueSoonGroup')} tone="warning" rows={dueSoon} now={now} t={t} />
      ) : null}
      {onTrack.length > 0 ? (
        <Group title={t('onTrackGroup')} tone="muted" rows={onTrack} now={now} t={t} />
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('empty')}
        </p>
      ) : null}
    </main>
  );
}

function SummaryTile({
  tone,
  label,
  value,
}: {
  tone: 'danger' | 'warning' | 'muted';
  label: string;
  value: number;
}) {
  const ring =
    tone === 'danger'
      ? 'border-red-300 bg-red-50 text-red-900'
      : tone === 'warning'
        ? 'border-yellow-300 bg-yellow-50 text-yellow-900'
        : 'border-zinc-200 bg-zinc-50 text-zinc-800';
  return (
    <div className={`rounded-md border p-4 ${ring}`}>
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Group({
  title,
  tone,
  rows,
  now,
  t,
}: {
  title: string;
  tone: 'danger' | 'warning' | 'muted';
  rows: SlaQueueRow[];
  now: Date;
  t: Awaited<ReturnType<typeof getTranslations<'sla'>>>;
}) {
  const tonClass =
    tone === 'danger'
      ? 'text-red-700'
      : tone === 'warning'
        ? 'text-yellow-800'
        : 'text-[var(--color-muted-foreground)]';
  return (
    <section className="rounded-md border">
      <h2 className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide">{title}</h2>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-[var(--color-muted-foreground)]">
          <tr>
            <th className="px-4 py-2">{t('columns.lead')}</th>
            <th className="px-4 py-2">{t('columns.customer')}</th>
            <th className="px-4 py-2">{t('columns.source')}</th>
            <th className="px-4 py-2">{t('columns.assigned')}</th>
            <th className="px-4 py-2">{t('columns.dueAt')}</th>
            <th className="px-4 py-2 text-right">{t('columns.remaining')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-2">
                <Link href={`/dashboard/jobs/${row.id}`} className="font-mono hover:underline">
                  {row.job_number}
                </Link>
              </td>
              <td className="px-4 py-2">
                {row.customer
                  ? customerDisplayName({
                      ...row.customer,
                      primary_email: row.customer.primary_email,
                    })
                  : '—'}
              </td>
              <td className="px-4 py-2">{row.acquisition_source ?? '—'}</td>
              <td className="px-4 py-2">{row.assigned_to?.full_name ?? '—'}</td>
              <td className="px-4 py-2">{formatDateTime(row.first_response_due_at)}</td>
              <td className="px-4 py-2 text-right">
                <SlaCountdown
                  dueAtMs={new Date(row.first_response_due_at).getTime()}
                  serverNowMs={now.getTime()}
                  baseTone={tonClass}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
