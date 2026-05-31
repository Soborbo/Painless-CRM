import { CompleteCallbackButton } from '@/components/domain/job/complete-callback-button';
import { requireUser } from '@/lib/auth/require-role';
import { type CallbackRow, isCallbackOverdue, listOpenCallbacks } from '@/lib/queries/callbacks';
import { customerDisplayName, formatDateTime } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CallbacksPage() {
  await requireUser();
  const now = new Date();
  const [rows, t, tc] = await Promise.all([
    listOpenCallbacks(now),
    getTranslations('callbacks'),
    getTranslations('phoneCalls'),
  ]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('empty')}
        </p>
      ) : (
        <section className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--color-muted-foreground)]">
              <tr>
                <th className="px-4 py-2">{t('columns.dueAt')}</th>
                <th className="px-4 py-2">{t('columns.customer')}</th>
                <th className="px-4 py-2">{t('columns.job')}</th>
                <th className="px-4 py-2">{t('columns.action')}</th>
                <th className="px-4 py-2">{t('columns.outcome')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <CallbackTableRow
                  key={row.id}
                  row={row}
                  tc={tc}
                  overdue={isCallbackOverdue(row.next_action_due_at, now)}
                  t={t}
                />
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

function CallbackTableRow({
  row,
  tc,
  t,
  overdue,
}: {
  row: CallbackRow;
  tc: Awaited<ReturnType<typeof getTranslations<'phoneCalls'>>>;
  t: Awaited<ReturnType<typeof getTranslations<'callbacks'>>>;
  overdue: boolean;
}) {
  return (
    <tr>
      <td className="px-4 py-2 whitespace-nowrap tabular-nums">
        {formatDateTime(row.next_action_due_at)}
        {overdue ? (
          <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-700">
            {t('overdue')}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-2">{row.customer ? customerDisplayName(row.customer) : '—'}</td>
      <td className="px-4 py-2">
        {row.job_id ? (
          <Link href={`/dashboard/jobs/${row.job_id}`} className="font-mono hover:underline">
            {row.job_number ?? '—'}
          </Link>
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-2">{row.next_action ?? '—'}</td>
      <td className="px-4 py-2 text-[var(--color-muted-foreground)]">
        {row.outcome ? tc(`outcomes.${row.outcome}` as never) : '—'}
      </td>
      <td className="px-4 py-2 text-right">
        <CompleteCallbackButton phoneCallId={row.id} />
      </td>
    </tr>
  );
}
