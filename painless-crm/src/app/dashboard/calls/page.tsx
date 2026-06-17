import { CallCard } from '@/components/domain/call/call-card';
import { CallsAutoRefresh } from '@/components/domain/call/calls-auto-refresh';
import { requireUser } from '@/lib/auth/require-role';
import { listInboundCalls } from '@/lib/queries/calls-inbox';
import { customerDisplayName } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export default async function CallsPage() {
  await requireUser();
  const [rows, t] = await Promise.all([listInboundCalls(), getTranslations('callsInbox')]);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
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
        <section className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <CallCard
              key={row.id}
              callId={row.id}
              caller={row.caller_number}
              occurredAt={row.occurred_at}
              durationSeconds={row.duration_seconds}
              repeatCount={row.repeatCount}
              customerName={row.customer ? customerDisplayName(row.customer) : null}
              customerId={row.customer_id}
              jobId={row.job_id}
              jobNumber={row.job_number}
              returnedAt={row.returned_at}
              returnedByName={row.returned_by?.full_name ?? null}
            />
          ))}
        </section>
      )}
    </main>
  );
}
