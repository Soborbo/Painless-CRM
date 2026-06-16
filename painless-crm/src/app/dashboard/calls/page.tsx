import { CallRowActions } from '@/components/domain/call/call-row-actions';
import { CallsAutoRefresh } from '@/components/domain/call/calls-auto-refresh';
import { requireUser } from '@/lib/auth/require-role';
import { type CallInboxRow, listInboundCalls } from '@/lib/queries/calls-inbox';
import { customerDisplayName, formatDateTime } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CallsPage() {
  await requireUser();
  const [rows, t] = await Promise.all([listInboundCalls(), getTranslations('callsInbox')]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <CallsAutoRefresh />
      <header>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
            {t('live')}
          </span>
        </div>
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
                <th className="px-4 py-2">{t('columns.when')}</th>
                <th className="px-4 py-2">{t('columns.caller')}</th>
                <th className="px-4 py-2">{t('columns.customer')}</th>
                <th className="px-4 py-2">{t('columns.job')}</th>
                <th className="px-4 py-2">{t('columns.returned')}</th>
                <th className="px-4 py-2 text-right">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <CallRow key={row.id} row={row} t={t} />
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

function CallRow({
  row,
  t,
}: {
  row: CallInboxRow;
  t: Awaited<ReturnType<typeof getTranslations<'callsInbox'>>>;
}) {
  return (
    <tr className={row.returned_at ? 'opacity-60' : undefined}>
      <td className="px-4 py-2 whitespace-nowrap tabular-nums">{formatDateTime(row.occurred_at)}</td>
      <td className="px-4 py-2">
        <span className="font-mono">{row.caller_number ?? t('unknownCaller')}</span>
        {row.repeatCount > 1 ? (
          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
            {t('repeat', { count: row.repeatCount })}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-2">
        {row.customer && row.customer_id ? (
          <Link href={`/dashboard/customers/${row.customer_id}`} className="hover:underline">
            {customerDisplayName(row.customer)}
          </Link>
        ) : (
          <span className="text-[var(--color-muted-foreground)]">{t('noMatch')}</span>
        )}
      </td>
      <td className="px-4 py-2">
        {row.job_id ? (
          <Link href={`/dashboard/jobs/${row.job_id}`} className="font-mono hover:underline">
            {row.job_number ?? t('openJob')}
          </Link>
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-2 text-xs text-[var(--color-muted-foreground)]">
        {row.returned_at ? (
          <span>
            {t('returnedBy', { name: row.returned_by?.full_name ?? '—' })}
            <br />
            {formatDateTime(row.returned_at)}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-2 text-right">
        <CallRowActions callId={row.id} hasJob={Boolean(row.job_id)} returned={Boolean(row.returned_at)} />
      </td>
    </tr>
  );
}
