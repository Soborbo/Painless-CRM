import { requireUser } from '@/lib/auth/require-role';
import {
  getUpcomingAvailability,
  getWorkerById,
  getWorkerPendingInvite,
  getWorkerPerformance,
} from '@/lib/queries/workers';
import { formatDate, formatPence } from '@/lib/utils/format';
import { ASSIGNMENT_ROLES } from '@/lib/workers/performance';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteWorkerButton } from './delete-button';
import { InviteAppAccess } from './invite-app-access';

type Props = { params: Promise<{ id: string }> };

const MANAGE_ROLES = ['manager', 'admin', 'super_admin'] as const;
const ADMIN_ROLES = ['admin', 'super_admin'] as const;

export default async function WorkerProfilePage({ params }: Props) {
  const { id } = await params;
  const me = await requireUser();
  if (!(MANAGE_ROLES as readonly string[]).includes(me.role)) notFound();

  const worker = await getWorkerById(id);
  if (!worker) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const [performance, availability] = await Promise.all([
    getWorkerPerformance(id),
    getUpcomingAvailability(id, today),
  ]);

  const t = await getTranslations('workers');
  const isAdmin = (ADMIN_ROLES as readonly string[]).includes(me.role);
  const linked = worker.user_id != null;
  const pendingInvite = isAdmin && !linked ? await getWorkerPendingInvite(id) : null;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            <Link href="/dashboard/workers" className="hover:underline">
              {t('title')}
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{worker.full_name}</h1>
          {!worker.active ? (
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {t('inactiveBadge')}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/workers/${id}/edit`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            {t('edit')}
          </Link>
          {isAdmin ? <DeleteWorkerButton id={worker.id} version={worker.version} /> : null}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Detail label={t('fields.phone')}>{worker.phone ?? '—'}</Detail>
        <Detail label={t('fields.email')}>{worker.email ?? '—'}</Detail>
        <Detail label={t('fields.hourlyRatePounds')}>
          {worker.hourly_rate_pence != null ? `${formatPence(worker.hourly_rate_pence)}/hr` : '—'}
        </Detail>
        {worker.skills ? <Detail label={t('fields.skills')}>{worker.skills}</Detail> : null}
        {worker.notes ? <Detail label={t('fields.notes')}>{worker.notes}</Detail> : null}
      </section>

      {isAdmin ? (
        <section>
          <h2 className="mb-3 text-lg font-medium">{t('appAccess.heading')}</h2>
          {linked ? (
            <p className="rounded-md border border-[var(--color-success,#16a34a)]/40 px-4 py-3 text-sm text-[var(--color-success,#16a34a)]">
              {t('appAccess.linked')}
            </p>
          ) : pendingInvite ? (
            <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
              {t('appAccess.pending', { date: formatDate(pendingInvite.expires_at) })}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-[var(--color-muted-foreground)]">{t('appAccess.help')}</p>
              <InviteAppAccess workerId={worker.id} hasEmail={worker.email != null} />
            </div>
          )}
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-medium">{t('performanceHeading')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label={t('stats.assignments')} value={performance.totalAssignments} />
          <Stat label={t('stats.jobs')} value={performance.distinctJobs} />
          {ASSIGNMENT_ROLES.map((role) => (
            <Stat key={role} label={t(`roles.${role}`)} value={performance.byRole[role]} />
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">{t('performanceNote')}</p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">{t('availabilityHeading')}</h2>
        {availability.length === 0 ? (
          <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-6 text-center text-sm text-[var(--color-muted-foreground)]">
            {t('noAvailability')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availability.map((a) => (
              <span
                key={a.date}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  a.available
                    ? 'border-[var(--color-success,#16a34a)]/40 text-[var(--color-success,#16a34a)]'
                    : 'border-[var(--color-danger)]/40 text-[var(--color-danger)]'
                }`}
                title={a.notes ?? undefined}
              >
                {formatDate(a.date)} · {a.available ? t('available') : t('unavailable')}
              </span>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">{t('availabilityNote')}</p>
      </section>
    </main>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-4 py-3 text-center">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{label}</p>
    </div>
  );
}
